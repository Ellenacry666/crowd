import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventStatus, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/constants';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'Passw0rd!';
export const url = (path: string) => `/${API_PREFIX}${path}`;
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  return app;
}

/** Aman: test/setup-env.ts menjamin DATABASE_URL mengarah ke database *_test. */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.crowdSnapshot.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.lineup.deleteMany();
  await prisma.checkInLog.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.orderPhoto.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketCategory.deleteMany();
  await prisma.staffAssignment.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

let cachedHash: string | undefined;
async function passwordHash() {
  cachedHash ??= await argon2.hash(PASSWORD);
  return cachedHash;
}

export async function createUser(prisma: PrismaService, email: string, role: Role) {
  return prisma.user.create({
    data: { name: email.split('@')[0], email, role, passwordHash: await passwordHash() },
  });
}

export async function login(app: INestApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(url('/auth/login'))
    .send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body.accessToken;
}

export interface SeedCategory {
  name: string;
  price: number;
  quota: number;
}

/** Membuat acara + kategori langsung lewat database (cepat). */
export async function seedEvent(
  prisma: PrismaService,
  opts: { title?: string; status?: EventStatus; categories?: SeedCategory[]; daysAhead?: number } = {},
) {
  const title = opts.title ?? `Event ${Math.random().toString(36).slice(2, 8)}`;
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(Date.now() + (opts.daysAhead ?? 7) * day);
  const event = await prisma.event.create({
    data: {
      title,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'Music',
      description: 'Deskripsi acara uji',
      location: 'Lokasi uji',
      startAt: start,
      endAt: new Date(start.getTime() + 3 * 60 * 60 * 1000),
      status: opts.status ?? EventStatus.PUBLISHED,
      ticketCategories: {
        create: opts.categories ?? [{ name: 'Regular', price: 100000, quota: 50 }],
      },
    },
    include: { ticketCategories: true },
  });
  return { event, categories: event.ticketCategories };
}

/** Gambar JPEG palsu (hanya magic bytes + isi acak): cukup untuk validasi server, unik per panggilan. */
export function fakeJpeg(size = 64): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), randomBytes(size)]);
}

export function uploadPhoto(
  app: INestApplication,
  token: string,
  orderId: string,
  slot: number,
  buffer: Buffer = fakeJpeg(),
  opts: { consent?: string | null; filename?: string; contentType?: string } = {},
) {
  const req = request(app.getHttpServer())
    .put(url(`/orders/${orderId}/photos/${slot}`))
    .set(bearer(token));
  const consent = opts.consent === undefined ? 'true' : opts.consent;
  if (consent !== null) req.field('consent', consent);
  return req.attach('photo', buffer, {
    filename: opts.filename ?? 'selfie.jpg',
    contentType: opts.contentType ?? 'image/jpeg',
  });
}

/** Mengunggah foto untuk semua slot yang masih kosong. Mengembalikan false bila tidak bisa (tanpa melempar). */
export async function uploadAllPhotos(app: INestApplication, token: string, orderId: string): Promise<boolean> {
  const status = await request(app.getHttpServer()).get(url(`/orders/${orderId}/photos`)).set(bearer(token));
  if (status.status !== 200) return false;
  for (const s of status.body.slots as Array<{ slot: number; uploaded: boolean }>) {
    if (s.uploaded) continue;
    const res = await uploadPhoto(app, token, orderId, s.slot);
    if (res.status !== 200) return false;
  }
  return true;
}

/** Membeli tiket lewat API (order -> bayar simulasi sukses) dan mengembalikan tiket yang terbit. */
export async function purchaseTickets(
  app: INestApplication,
  token: string,
  ticketCategoryId: string,
  quantity = 1,
) {
  const server = app.getHttpServer();
  const order = await request(server)
    .post(url('/orders'))
    .set(bearer(token))
    .send({ items: [{ ticketCategoryId, quantity }] });
  if (order.status !== 201) throw new Error(`create order failed: ${order.status} ${JSON.stringify(order.body)}`);

  if (!(await uploadAllPhotos(app, token, order.body.id))) throw new Error('upload photos failed');

  const pay = await request(server)
    .post(url(`/payments/${order.body.id}/simulate`))
    .set(bearer(token))
    .send({ outcome: 'SUCCESS' });
  if (pay.status !== 200) throw new Error(`payment failed: ${pay.status} ${JSON.stringify(pay.body)}`);

  const mine = await request(server).get(url('/tickets/my')).set(bearer(token));
  const tickets = (mine.body as any[]).filter((t) => t.orderNumber === order.body.orderNumber);
  return { order: order.body, tickets };
}

export function scan(app: INestApplication, token: string, eventId: string, qrPayload: string) {
  return request(app.getHttpServer())
    .post(url('/checkin'))
    .set(bearer(token))
    .send({ eventId, qrPayload });
}
