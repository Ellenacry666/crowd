import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  bearer,
  createTestApp,
  createUser,
  login,
  purchaseTickets,
  resetDatabase,
  seedEvent,
  uploadAllPhotos,
  url,
} from './helpers';

describe('Batas 5 tiket per akun per acara (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let admin: string;
  let previousLimit: string | undefined;

  // Setiap tes memakai akun dan acara sendiri agar saling bebas.
  let seq = 0;
  async function fresh() {
    seq += 1;
    await createUser(prisma, `buyer${seq}@lim.local`, Role.CUSTOMER);
    const token = await login(app, `buyer${seq}@lim.local`);
    const { event, categories } = await seedEvent(prisma, {
      title: `Acara Batas ${seq}`,
      categories: [{ name: 'Reg', price: 1000, quota: 100 }],
    });
    return { token, event, category: categories[0] };
  }

  const order = (token: string, categoryId: string, quantity: number) =>
    request(server)
      .post(url('/orders'))
      .set(bearer(token))
      .send({ items: [{ ticketCategoryId: categoryId, quantity }] });
  const quota = (token: string, key: string) =>
    request(server).get(url(`/orders/quota/${key}`)).set(bearer(token));
  const reserved = async (categoryId: string) =>
    (await prisma.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } })).reservedCount;

  beforeAll(async () => {
    // setup-env menaikkan batas ke 1000 untuk spec lain; di sini dipakai nilai sebenarnya.
    previousLimit = process.env.MAX_TICKETS_PER_USER_PER_EVENT;
    process.env.MAX_TICKETS_PER_USER_PER_EVENT = '5';

    app = await createTestApp();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
    await resetDatabase(prisma);
    await createUser(prisma, 'admin@lim.local', Role.ADMIN);
    admin = await login(app, 'admin@lim.local');
  });

  afterAll(async () => {
    if (previousLimit === undefined) delete process.env.MAX_TICKETS_PER_USER_PER_EVENT;
    else process.env.MAX_TICKETS_PER_USER_PER_EVENT = previousLimit;
    await resetDatabase(prisma);
    await app.close();
  });

  it('BUG ASAL: setelah punya 5 tiket LUNAS, membeli lagi di acara yang sama ditolak', async () => {
    const { token, event, category } = await fresh();
    const bought = await purchaseTickets(app, token, category.id, 5);
    expect(bought.tickets).toHaveLength(5);

    const again = await order(token, category.id, 1);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('TICKET_LIMIT_REACHED');
    expect(again.body.message).toContain('5');

    // tidak ada order atau stok baru yang tercipta
    expect(await prisma.order.count({ where: { items: { some: { ticketCategory: { eventId: event.id } } } } })).toBe(1);
    expect(await reserved(category.id)).toBe(0);

    const q = await quota(token, event.slug);
    expect(q.body).toEqual({ limit: 5, used: 5, remaining: 0 });
  });

  it('jatah dihitung kumulatif dari beberapa order: 2 + 3 diterima, order ke-3 ditolak', async () => {
    const { token, category } = await fresh();
    expect((await order(token, category.id, 2)).status).toBe(201);
    expect((await order(token, category.id, 3)).status).toBe(201);
    const third = await order(token, category.id, 1);
    expect(third.status).toBe(409);
    expect(third.body.code).toBe('TICKET_LIMIT_REACHED');
    expect(await reserved(category.id)).toBe(5);
  });

  it('order yang melebihi sisa jatah ditolak, yang pas dengan sisa diterima', async () => {
    const { token, category } = await fresh();
    expect((await order(token, category.id, 4)).status).toBe(201);

    const tooMany = await order(token, category.id, 2);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.message).toContain('sisa jatah 1');

    expect((await order(token, category.id, 1)).status).toBe(201);
  });

  it('order PENDING menghitung terhadap jatah (tidak perlu menunggu bayar)', async () => {
    const { token, event, category } = await fresh();
    expect((await order(token, category.id, 5)).status).toBe(201);
    expect((await quota(token, event.id)).body).toEqual({ limit: 5, used: 5, remaining: 0 });
    expect((await order(token, category.id, 1)).status).toBe(409);
  });

  it('pembayaran gagal mengembalikan jatah', async () => {
    const { token, event, category } = await fresh();
    const first = await order(token, category.id, 5);
    expect((await order(token, category.id, 1)).status).toBe(409);

    const pay = await request(server)
      .post(url(`/payments/${first.body.id}/simulate`))
      .set(bearer(token))
      .send({ outcome: 'FAILED' });
    expect(pay.status).toBe(200);

    expect((await quota(token, event.id)).body.remaining).toBe(5);
    expect((await order(token, category.id, 5)).status).toBe(201);
  });

  it('order PENDING yang sudah kedaluwarsa tidak lagi menghitung', async () => {
    const { token, event, category } = await fresh();
    const first = await order(token, category.id, 5);
    await prisma.order.update({ where: { id: first.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    expect((await quota(token, event.id)).body.remaining).toBe(5);
    expect((await order(token, category.id, 3)).status).toBe(201);
  });

  it('batas berlaku per acara dan per akun: acara lain dan akun lain tidak terpengaruh', async () => {
    const a = await fresh();
    const other = await seedEvent(prisma, { title: 'Acara Lain', categories: [{ name: 'Reg', price: 1000, quota: 100 }] });
    await createUser(prisma, 'second@lim.local', Role.CUSTOMER);
    const secondToken = await login(app, 'second@lim.local');

    expect((await order(a.token, a.category.id, 5)).status).toBe(201);
    expect((await order(a.token, a.category.id, 1)).status).toBe(409);

    // acara lain: akun yang sama boleh membeli
    expect((await order(a.token, other.categories[0].id, 5)).status).toBe(201);
    // akun lain pada acara yang sama: boleh
    expect((await order(secondToken, a.category.id, 5)).status).toBe(201);
  });

  it('order paralel dari akun yang sama tidak dapat menembus batas', async () => {
    const { token, event, category } = await fresh();
    const results = await Promise.all(Array.from({ length: 8 }, () => order(token, category.id, 1)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(3);
    expect(await reserved(category.id)).toBe(5);
    expect((await quota(token, event.id)).body.used).toBe(5);
  });

  it('order paralel berukuran berbeda: total tidak pernah melebihi 5', async () => {
    const { token, event, category } = await fresh();
    const sizes = [3, 3, 2, 2, 1, 1];
    await Promise.all(sizes.map((n) => order(token, category.id, n)));
    const used = (await quota(token, event.id)).body.used;
    expect(used).toBeLessThanOrEqual(5);
    expect(await reserved(category.id)).toBe(used);
  });

  it('pembayaran sukses pada order yang sudah dibuat tetap berjalan (tidak terpengaruh batas)', async () => {
    const { token, category } = await fresh();
    const first = await order(token, category.id, 5);
    expect(await uploadAllPhotos(app, token, first.body.id)).toBe(true);
    const pay = await request(server)
      .post(url(`/payments/${first.body.id}/simulate`))
      .set(bearer(token))
      .send({ outcome: 'SUCCESS' });
    expect(pay.status).toBe(200);
    expect(pay.body.ticketsIssued).toBe(5);
  });

  describe('Endpoint jatah', () => {
    it('hanya untuk pengunjung yang login; acara tidak ada 404', async () => {
      const { token, event } = await fresh();
      expect((await request(server).get(url(`/orders/quota/${event.id}`))).status).toBe(401);
      expect((await quota(admin, event.id)).status).toBe(403);
      expect((await quota(token, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
      expect((await quota(token, 'slug-yang-tidak-ada')).status).toBe(404);
    });

    it('menampilkan jatah awal penuh dan dapat dicari lewat id maupun slug', async () => {
      const { token, event } = await fresh();
      expect((await quota(token, event.id)).body).toEqual({ limit: 5, used: 0, remaining: 5 });
      expect((await quota(token, event.slug)).body).toEqual({ limit: 5, used: 0, remaining: 5 });
    });
  });
});
