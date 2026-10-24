import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  private readonly expiresIn: number;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.expiresIn = Number(config.get('JWT_EXPIRES_IN_SECONDS') ?? 3600);
  }

  async onModuleInit() {
    // Hash palsu agar waktu respons login tidak membocorkan apakah email terdaftar.
    this.dummyHash = await argon2.hash('dummy-password-for-timing-equalization');
  }

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.users.createCustomer({
        name: dto.name,
        email: dto.email,
        passwordHash,
      });
      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          message: 'Email sudah terdaftar',
          code: 'EMAIL_ALREADY_REGISTERED',
        });
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const hash = user?.passwordHash ?? this.dummyHash;
    const passwordOk = await argon2.verify(hash, dto.password);

    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException({
        message: 'Email atau password salah',
        code: 'INVALID_CREDENTIALS',
      });
    }
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
