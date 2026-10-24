import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/constants';
import { PrismaService } from '../src/prisma/prisma.service';

const PASSWORD = 'Passw0rd!';
const url = (path: string) => `/${API_PREFIX}${path}`;

describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function login(email: string, password = PASSWORD) {
    return request(app.getHttpServer()).post(url('/auth/login')).send({ email, password });
  }

  async function tokenOf(email: string): Promise<string> {
    const res = await login(email);
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany(); // aman: setup-env menjamin ini database *_test

    const passwordHash = await argon2.hash(PASSWORD);
    await prisma.user.createMany({
      data: [
        { name: 'Admin', email: 'admin@e2e.local', passwordHash, role: Role.ADMIN },
        { name: 'Staff', email: 'staff@e2e.local', passwordHash, role: Role.GATE_STAFF },
        { name: 'Staff Dua', email: 'staff2@e2e.local', passwordHash, role: Role.GATE_STAFF },
        { name: 'Customer', email: 'customer@e2e.local', passwordHash, role: Role.CUSTOMER },
        {
          name: 'Nonaktif',
          email: 'inactive@e2e.local',
          passwordHash,
          role: Role.GATE_STAFF,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('Health', () => {
    it('GET /health publik dan database up', async () => {
      const res = await request(app.getHttpServer()).get(url('/health'));
      expect(res.status).toBe(200);
      expect(res.body.database).toBe('up');
    });
  });

  describe('Registrasi', () => {
    it('berhasil sebagai CUSTOMER, hash tersimpan, tanpa passwordHash di respons', async () => {
      const res = await request(app.getHttpServer())
        .post(url('/auth/register'))
        .send({ name: 'Budi', email: 'Budi@E2E.local', password: PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('CUSTOMER');
      expect(res.body.user.email).toBe('budi@e2e.local');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      const inDb = await prisma.user.findUnique({ where: { email: 'budi@e2e.local' } });
      expect(inDb?.passwordHash).toMatch(/^\$argon2/);
    });

    it('menolak field role (mencegah privilege escalation)', async () => {
      const res = await request(app.getHttpServer())
        .post(url('/auth/register'))
        .send({ name: 'Hacker', email: 'hacker@e2e.local', password: PASSWORD, role: 'ADMIN' });
      expect(res.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { email: 'hacker@e2e.local' } })).toBeNull();
    });

    it('menolak email duplikat dengan 409', async () => {
      const res = await request(app.getHttpServer())
        .post(url('/auth/register'))
        .send({ name: 'Budi 2', email: 'budi@e2e.local', password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('menolak password lemah dan email tidak valid', async () => {
      const weak = await request(app.getHttpServer())
        .post(url('/auth/register'))
        .send({ name: 'Lemah', email: 'lemah@e2e.local', password: 'abcdefgh' });
      expect(weak.status).toBe(400);

      const badEmail = await request(app.getHttpServer())
        .post(url('/auth/register'))
        .send({ name: 'Salah', email: 'bukan-email', password: PASSWORD });
      expect(badEmail.status).toBe(400);
    });
  });

  describe('Login dan JWT', () => {
    it('login berhasil untuk tiga role', async () => {
      for (const [email, role] of [
        ['admin@e2e.local', 'ADMIN'],
        ['staff@e2e.local', 'GATE_STAFF'],
        ['customer@e2e.local', 'CUSTOMER'],
      ]) {
        const res = await login(email);
        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe(role);
        expect(res.body.accessToken).toBeDefined();
      }
    });

    it('login gagal: password salah, email tidak ada, akun nonaktif', async () => {
      expect((await login('admin@e2e.local', 'SalahBanget1')).status).toBe(401);
      expect((await login('tidakada@e2e.local')).status).toBe(401);
      expect((await login('inactive@e2e.local')).status).toBe(401);
    });

    it('GET /auth/me: tanpa token 401, token valid 200, token sampah 401', async () => {
      const server = app.getHttpServer();
      expect((await request(server).get(url('/auth/me'))).status).toBe(401);

      const token = await tokenOf('customer@e2e.local');
      const ok = await request(server).get(url('/auth/me')).set('Authorization', `Bearer ${token}`);
      expect(ok.status).toBe(200);
      expect(ok.body.email).toBe('customer@e2e.local');

      const bad = await request(server).get(url('/auth/me')).set('Authorization', 'Bearer abc.def.ghi');
      expect(bad.status).toBe(401);
    });

    it('menolak token yang ditandatangani dengan secret lain (forged ADMIN)', async () => {
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@e2e.local' } });
      const forged = await new JwtService({
        secret: 'secret-palsu-secret-palsu-secret-palsu-123456',
      }).signAsync({ sub: customer.id, role: 'ADMIN' });

      const res = await request(app.getHttpServer())
        .get(url('/admin/ping'))
        .set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it('token dari akun yang dinonaktifkan langsung ditolak', async () => {
      const token = await tokenOf('staff2@e2e.local');
      const server = app.getHttpServer();
      expect(
        (await request(server).get(url('/auth/me')).set('Authorization', `Bearer ${token}`)).status,
      ).toBe(200);

      await prisma.user.update({ where: { email: 'staff2@e2e.local' }, data: { isActive: false } });

      expect(
        (await request(server).get(url('/auth/me')).set('Authorization', `Bearer ${token}`)).status,
      ).toBe(401);
    });
  });

  describe('RBAC', () => {
    const matrix: Array<[string, string, number]> = [
      // [path, user email (atau 'none'), expected status]
      ['/admin/ping', 'none', 401],
      ['/admin/ping', 'admin@e2e.local', 200],
      ['/admin/ping', 'customer@e2e.local', 403],
      ['/admin/ping', 'staff@e2e.local', 403],
      ['/staff/ping', 'none', 401],
      ['/staff/ping', 'staff@e2e.local', 200],
      ['/staff/ping', 'admin@e2e.local', 403],
      ['/staff/ping', 'customer@e2e.local', 403],
      ['/customer/ping', 'customer@e2e.local', 200],
      ['/customer/ping', 'admin@e2e.local', 403],
      ['/customer/ping', 'staff@e2e.local', 403],
    ];

    
    it.each(matrix)('%s sebagai %s -> %i', async (path, email, expected) => {
      let token: string | undefined;

      // Dapatkan token terlebih dahulu sebelum membuat request RBAC.
      if (email !== 'none') {
        token = await tokenOf(email);
      }

      // Buat request setelah proses login selesai.
      const req = request(app.getHttpServer()).get(url(path));

      if (token) {
        req.set('Authorization', `Bearer ${token}`);
      }

      const res = await req;
      expect(res.status).toBe(expected);
    });


    it('respons 403 memakai format error seragam', async () => {
      const token = await tokenOf('customer@e2e.local');
      const res = await request(app.getHttpServer())
        .get(url('/admin/ping'))
        .set('Authorization', `Bearer ${token}`);
      expect(res.body).toMatchObject({ statusCode: 403, error: 'FORBIDDEN', code: 'FORBIDDEN' });
    });
  });
});
