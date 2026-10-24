import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createCustomer(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase(), role: Role.CUSTOMER },
    });
  }
}
