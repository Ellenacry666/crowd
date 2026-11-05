import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  staffAssignments: { select: { eventId: true } },
} as const;

@Injectable()
export class StaffAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private shape<T extends { staffAssignments: { eventId: string }[] }>(u: T) {
    const { staffAssignments, ...rest } = u;
    return { ...rest, eventIds: staffAssignments.map((a) => a.eventId) };
  }

  async create(dto: CreateStaffDto) {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash, role: Role.GATE_STAFF },
        select: STAFF_SELECT,
      });
      return this.shape(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ message: 'Email sudah terdaftar', code: 'EMAIL_ALREADY_REGISTERED' });
      }
      throw error;
    }
  }

  async list() {
    const users = await this.prisma.user.findMany({
      where: { role: Role.GATE_STAFF },
      select: STAFF_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.shape(u));
  }

  async update(id: string, dto: UpdateStaffDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: Role.GATE_STAFF },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ message: 'Petugas tidak ditemukan', code: 'STAFF_NOT_FOUND' });
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        isActive: dto.isActive,
        passwordHash: dto.password ? await argon2.hash(dto.password) : undefined,
      },
      select: STAFF_SELECT,
    });
    return this.shape(user);
  }

  async assign(eventId: string, staffIds: string[]) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }
    const staff = await this.prisma.user.findMany({
      where: { id: { in: staffIds }, role: Role.GATE_STAFF },
      select: { id: true },
    });
    if (staff.length !== staffIds.length) {
      throw new BadRequestException({
        message: 'Beberapa id bukan akun petugas (GATE_STAFF)',
        code: 'INVALID_STAFF',
      });
    }
    await this.prisma.$transaction([
      this.prisma.staffAssignment.deleteMany({ where: { eventId } }),
      this.prisma.staffAssignment.createMany({
        data: staffIds.map((staffId) => ({ staffId, eventId })),
      }),
    ]);
    return { eventId, staffIds };
  }
}
