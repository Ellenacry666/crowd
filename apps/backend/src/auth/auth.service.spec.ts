import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRecord: any;

  const users = { findByEmail: jest.fn(), createCustomer: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const config = { get: jest.fn().mockReturnValue(3600) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    await service.onModuleInit();

    userRecord = {
      id: 'user-1',
      name: 'Budi',
      email: 'budi@test.local',
      passwordHash: await argon2.hash('Passw0rd!'),
      role: Role.CUSTOMER,
      isActive: true,
    };
  });

  beforeEach(() => jest.clearAllMocks());

  it('login berhasil mengembalikan token tanpa passwordHash', async () => {
    users.findByEmail.mockResolvedValue(userRecord);
    const result = await service.login({ email: 'budi@test.local', password: 'Passw0rd!' });
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Budi',
      email: 'budi@test.local',
      role: Role.CUSTOMER,
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('login gagal jika password salah', async () => {
    users.findByEmail.mockResolvedValue(userRecord);
    await expect(
      service.login({ email: 'budi@test.local', password: 'SalahBanget1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login gagal jika email tidak terdaftar', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'tidakada@test.local', password: 'Passw0rd!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login gagal jika akun nonaktif', async () => {
    users.findByEmail.mockResolvedValue({ ...userRecord, isActive: false });
    await expect(
      service.login({ email: 'budi@test.local', password: 'Passw0rd!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('register menyimpan hash argon2, bukan password asli', async () => {
    users.createCustomer.mockImplementation(async (data: any) => ({
      ...userRecord,
      ...data,
      id: 'new-id',
    }));
    await service.register({ name: 'Siti', email: 'siti@test.local', password: 'Passw0rd!' });
    const saved = users.createCustomer.mock.calls[0][0];
    expect(saved.passwordHash).toMatch(/^\$argon2/);
    expect(saved.passwordHash).not.toContain('Passw0rd!');
  });

  it('register dengan email duplikat melempar ConflictException', async () => {
    users.createCustomer.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.register({ name: 'Siti', email: 'siti@test.local', password: 'Passw0rd!' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
