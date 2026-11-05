import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import request from 'supertest';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createUser,
  fakeJpeg,
  login,
  resetDatabase,
  seedEvent,
  uploadPhoto,
  url,
} from './helpers';

const uploadDir = () => resolve(process.env.UPLOAD_DIR!);
const fileExists = (key: string) => existsSync(join(uploadDir(), key));

describe('Foto pemegang tiket / anti-calo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let admin: string;
  let alice: string;
  let bob: string;
  let staffA: string;
  let staffB: string;
  let categoryId: string;
  let eventId: string;

  const newOrder = async (token: string, quantity: number) => {
    const res = await request(server)
      .post(url('/orders'))
      .set(bearer(token))
      .send({ items: [{ ticketCategoryId: categoryId, quantity }] });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  const pay = (token: string, orderId: string, outcome = 'SUCCESS') =>
    request(server).post(url(`/payments/${orderId}/simulate`)).set(bearer(token)).send({ outcome });

  const getBinary = (path: string, token?: string) => {
    const req = request(server).get(url(path));
    if (token) req.set(bearer(token));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return req.buffer(true).parse((res: any, cb: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@ph.local', Role.ADMIN);
    await createUser(prisma, 'alice@ph.local', Role.CUSTOMER);
    await createUser(prisma, 'bob@ph.local', Role.CUSTOMER);
    const a = await createUser(prisma, 'staffa@ph.local', Role.GATE_STAFF);
    await createUser(prisma, 'staffb@ph.local', Role.GATE_STAFF);
    const { event, categories } = await seedEvent(prisma, {
      categories: [{ name: 'Reg', price: 10000, quota: 100 }],
    });
    eventId = event.id;
    categoryId = categories[0].id;
    await prisma.staffAssignment.create({ data: { staffId: a.id, eventId } });
    admin = await login(app, 'admin@ph.local');
    alice = await login(app, 'alice@ph.local');
    bob = await login(app, 'bob@ph.local');
    staffA = await login(app, 'staffa@ph.local');
    staffB = await login(app, 'staffb@ph.local');
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  describe('Syarat pembayaran', () => {
    it('pembayaran sukses ditolak sampai SEMUA foto (satu per tiket) terunggah', async () => {
      const orderId = await newOrder(alice, 3);

      const none = await pay(alice, orderId);
      expect(none.status).toBe(409);
      expect(none.body.code).toBe('PHOTOS_REQUIRED');
      expect(none.body.message).toContain('0 dari 3');

      expect((await uploadPhoto(app, alice, orderId, 1)).status).toBe(200);
      expect((await uploadPhoto(app, alice, orderId, 2)).status).toBe(200);
      const partial = await pay(alice, orderId);
      expect(partial.status).toBe(409);
      expect(partial.body.message).toContain('2 dari 3');

      // order tetap PENDING, stok tetap dicadangkan, tidak ada tiket
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.status).toBe('PENDING');
      expect(await prisma.ticket.count({ where: { orderItem: { orderId } } })).toBe(0);

      expect((await uploadPhoto(app, alice, orderId, 3)).status).toBe(200);
      const ok = await pay(alice, orderId);
      expect(ok.status).toBe(200);
      expect(ok.body.ticketsIssued).toBe(3);
    });

    it('lima tiket membutuhkan lima foto berbeda dan tiap tiket tertaut ke fotonya sendiri', async () => {
      const orderId = await newOrder(alice, 5);
      for (let slot = 1; slot <= 5; slot++) {
        expect((await uploadPhoto(app, alice, orderId, slot)).status).toBe(200);
      }
      const status = await request(server).get(url(`/orders/${orderId}/photos`)).set(bearer(alice));
      expect(status.body).toMatchObject({ required: 5, uploaded: 5 });
      expect(status.body.slots.every((s: any) => s.uploaded)).toBe(true);

      expect((await pay(alice, orderId)).body.ticketsIssued).toBe(5);
      const tickets = await prisma.ticket.findMany({ where: { orderItem: { orderId } } });
      expect(tickets).toHaveLength(5);
      expect(new Set(tickets.map((t) => t.holderPhotoId)).size).toBe(5);
      expect(tickets.every((t) => t.holderPhotoId !== null)).toBe(true);
    });

    it('pembayaran GAGAL tidak butuh foto dan menghapus foto yang sudah diunggah', async () => {
      const orderId = await newOrder(alice, 2);
      await uploadPhoto(app, alice, orderId, 1);
      const before = await prisma.orderPhoto.findMany({ where: { orderId } });
      expect(before).toHaveLength(1);
      expect(fileExists(before[0].storageKey)).toBe(true);

      expect((await pay(alice, orderId, 'FAILED')).status).toBe(200);
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(0);
      expect(fileExists(before[0].storageKey)).toBe(false);
    });

    it('order kedaluwarsa menghapus foto (baris dan berkas)', async () => {
      const orderId = await newOrder(alice, 1);
      await uploadPhoto(app, alice, orderId, 1);
      const [photo] = await prisma.orderPhoto.findMany({ where: { orderId } });
      await prisma.order.update({ where: { id: orderId }, data: { expiresAt: new Date(Date.now() - 1000) } });

      expect(await app.get(OrdersService).expireOrder(orderId)).toBe(true);
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(0);
      expect(fileExists(photo.storageKey)).toBe(false);

      // unggah ke order yang sudah kedaluwarsa ditolak
      const late = await uploadPhoto(app, alice, orderId, 1);
      expect(late.status).toBe(409);
    });
  });

  describe('Validasi unggahan', () => {
    let orderId: string;
    beforeAll(async () => {
      orderId = await newOrder(alice, 2);
    });

    it('wajib login sebagai pengunjung pemilik order', async () => {
      const noToken = await request(server).put(url(`/orders/${orderId}/photos/1`)).attach('photo', fakeJpeg(), 'a.jpg');
      expect(noToken.status).toBe(401);
      expect((await uploadPhoto(app, admin, orderId, 1)).status).toBe(403);
      const other = await uploadPhoto(app, bob, orderId, 1);
      expect(other.status).toBe(404);
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(0);
    });

    it('menolak slot di luar jumlah tiket', async () => {
      for (const slot of [0, 3, 99]) {
        const res = await uploadPhoto(app, alice, orderId, slot);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_SLOT');
      }
    });

    it('menolak tanpa persetujuan', async () => {
      const none = await uploadPhoto(app, alice, orderId, 1, fakeJpeg(), { consent: null });
      expect(none.status).toBe(400);
      expect(none.body.code).toBe('CONSENT_REQUIRED');
      const no = await uploadPhoto(app, alice, orderId, 1, fakeJpeg(), { consent: 'false' });
      expect(no.body.code).toBe('CONSENT_REQUIRED');
    });

    it('menolak berkas yang bukan gambar walau Content-Type dan ekstensi mengaku JPEG', async () => {
      const fakeText = Buffer.from('ini hanya teks, bukan gambar sama sekali');
      const text = await uploadPhoto(app, alice, orderId, 1, fakeText, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
      expect(text.status).toBe(400);
      expect(text.body.code).toBe('INVALID_IMAGE');
      const html = await uploadPhoto(app, alice, orderId, 1, Buffer.from('<script>alert(1)</script>'), {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      });
      expect(html.body.code).toBe('INVALID_IMAGE');
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(0);
    });

    it('menolak berkas tanpa isi dan tanpa field photo', async () => {
      const noFile = await request(server).put(url(`/orders/${orderId}/photos/1`)).set(bearer(alice)).field('consent', 'true');
      expect(noFile.status).toBe(400);
      expect(noFile.body.code).toBe('PHOTO_REQUIRED');
    });

    it('menolak berkas lebih dari 5 MB (413) tanpa meninggalkan file', async () => {
      const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
      const res = await uploadPhoto(app, alice, orderId, 1, big);
      expect(res.status).toBe(413);
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(0);
    });

    it('foto identik pada dua slot dalam satu order ditolak (409); mengunggah ulang ke slot yang sama boleh', async () => {
      const same = fakeJpeg();
      expect((await uploadPhoto(app, alice, orderId, 1, same)).status).toBe(200);
      const dup = await uploadPhoto(app, alice, orderId, 2, same);
      expect(dup.status).toBe(409);
      expect(dup.body.code).toBe('DUPLICATE_PHOTO');
      expect(await prisma.orderPhoto.count({ where: { orderId } })).toBe(1);

      expect((await uploadPhoto(app, alice, orderId, 1, same)).status).toBe(200);
      expect((await uploadPhoto(app, alice, orderId, 2, fakeJpeg())).status).toBe(200);
    });

    it('mengganti foto pada slot menghapus berkas lama dan memakai berkas baru', async () => {
      const id = await newOrder(alice, 1);
      const first = fakeJpeg(100);
      const second = fakeJpeg(200);
      await uploadPhoto(app, alice, id, 1, first);
      const [before] = await prisma.orderPhoto.findMany({ where: { orderId: id } });

      expect((await uploadPhoto(app, alice, id, 1, second)).status).toBe(200);
      const after = await prisma.orderPhoto.findMany({ where: { orderId: id } });
      expect(after).toHaveLength(1);
      expect(after[0].storageKey).not.toBe(before.storageKey);
      expect(fileExists(before.storageKey)).toBe(false);

      const img = await getBinary(`/orders/${id}/photos/1/image`, alice);
      expect(img.status).toBe(200);
      expect(Buffer.compare(img.body, second)).toBe(0);
    });

    it('order yang sudah dibayar tidak dapat diubah fotonya', async () => {
      const id = await newOrder(alice, 1);
      await uploadPhoto(app, alice, id, 1);
      expect((await pay(alice, id)).status).toBe(200);
      const res = await uploadPhoto(app, alice, id, 1);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ORDER_NOT_PENDING');
    });
  });

  describe('Hak akses melihat foto', () => {
    let orderId: string;
    let photos: Buffer[];
    let tickets: Array<{ id: string; holderPhotoId: string | null }>;

    beforeAll(async () => {
      orderId = await newOrder(alice, 2);
      photos = [fakeJpeg(80), fakeJpeg(90)];
      await uploadPhoto(app, alice, orderId, 1, photos[0]);
      await uploadPhoto(app, alice, orderId, 2, photos[1]);
      expect((await pay(alice, orderId)).status).toBe(200);
      tickets = await prisma.ticket.findMany({ where: { orderItem: { orderId } } });
    });

    it('daftar tiket menandai tiket yang memiliki foto, tanpa membocorkan foto', async () => {
      const mine = await request(server).get(url('/tickets/my')).set(bearer(alice));
      const own = mine.body.filter((t: any) => tickets.some((x) => x.id === t.id));
      expect(own).toHaveLength(2);
      expect(own.every((t: any) => t.hasHolderPhoto === true)).toBe(true);
      expect(JSON.stringify(own)).not.toContain('storageKey');
    });

    it('pemilik melihat foto tiketnya (isi sama persis, tidak di-cache)', async () => {
      const seen: Buffer[] = [];
      for (const t of tickets) {
        const res = await getBinary(`/tickets/${t.id}/photo`, alice);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/image\/jpeg/);
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        seen.push(res.body);
      }
      const expected = photos.map((p) => p.toString('hex')).sort();
      expect(seen.map((b) => b.toString('hex')).sort()).toEqual(expected);
    });

    it('pengunjung lain, petugas yang tidak ditugaskan, dan tanpa token tidak dapat melihat', async () => {
      const t = tickets[0];
      expect((await getBinary(`/tickets/${t.id}/photo`, bob)).status).toBe(404);
      expect((await getBinary(`/tickets/${t.id}/photo`, staffB)).status).toBe(404);
      expect((await getBinary(`/tickets/${t.id}/photo`)).status).toBe(401);
    });

    it('petugas yang ditugaskan ke acara dan admin dapat melihat', async () => {
      const t = tickets[0];
      expect((await getBinary(`/tickets/${t.id}/photo`, staffA)).status).toBe(200);
      expect((await getBinary(`/tickets/${t.id}/photo`, admin)).status).toBe(200);
    });

    it('foto order: hanya pemilik dan admin; pengunjung lain 404', async () => {
      expect((await getBinary(`/orders/${orderId}/photos/1/image`, alice)).status).toBe(200);
      expect((await getBinary(`/orders/${orderId}/photos/1/image`, admin)).status).toBe(200);
      expect((await getBinary(`/orders/${orderId}/photos/1/image`, bob)).status).toBe(404);
      expect((await request(server).get(url(`/orders/${orderId}/photos`)).set(bearer(bob))).status).toBe(404);
      expect((await request(server).get(url(`/orders/${orderId}/photos`)).set(bearer(admin))).status).toBe(200);
    });

    it('check-in menandai tiket yang punya foto agar petugas dapat membandingkannya', async () => {
      const t = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
      const { QrSigner } = await import('../src/common/qr/qr-signer');
      const payload = app.get(QrSigner).buildPayload(t.ticketCode);
      const res = await request(server)
        .post(url('/checkin'))
        .set(bearer(staffA))
        .send({ eventId, qrPayload: payload });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, result: 'SUCCESS' });
      expect(res.body.ticket).toMatchObject({ id: t.id, hasHolderPhoto: true });
    });
  });
});
