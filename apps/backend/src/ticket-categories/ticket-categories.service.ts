import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketCategory } from '@prisma/client';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';

function toResponse(c: TicketCategory) {
  return {
    id: c.id,
    eventId: c.eventId,
    name: c.name,
    price: c.price,
    quota: c.quota,
    soldCount: c.soldCount,
    reservedCount: c.reservedCount,
    available: Math.max(0, c.quota - c.soldCount - c.reservedCount),
  };
}

@Injectable()
export class TicketCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(eventId: string, dto: CreateTicketCategoryDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }
    try {
      const created = await this.prisma.ticketCategory.create({
        data: { eventId, name: dto.name, price: dto.price, quota: dto.quota },
      });
      return toResponse(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw this.nameTaken();
      throw error;
    }
  }

  async update(id: string, dto: UpdateTicketCategoryDto) {
    const existing = await this.prisma.ticketCategory.findUnique({ where: { id } });
    if (!existing) throw this.notFound();

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.quota !== undefined) {
          // Atomik: kuota baru tidak boleh lebih kecil dari terjual + dicadangkan.
          const affected = await tx.$executeRaw`
            UPDATE "ticket_categories"
            SET "quota" = ${dto.quota}::int, "updatedAt" = (NOW() AT TIME ZONE 'UTC')
            WHERE "id" = ${id}::uuid AND "soldCount" + "reservedCount" <= ${dto.quota}::int`;
          if (affected !== 1) {
            throw new ConflictException({
              message: 'Kuota tidak boleh lebih kecil dari jumlah tiket terjual + dicadangkan',
              code: 'QUOTA_BELOW_SOLD',
            });
          }
        }
        return tx.ticketCategory.update({
          where: { id },
          data: { name: dto.name, price: dto.price },
        });
      });
      return toResponse(updated);
    } catch (error) {
      if (isUniqueViolation(error)) throw this.nameTaken();
      throw error;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.ticketCategory.findUnique({ where: { id } });
    if (!existing) throw this.notFound();
    const used = await this.prisma.orderItem.count({ where: { ticketCategoryId: id } });
    if (used > 0) {
      throw new ConflictException({
        message: 'Kategori sudah dipakai di order dan tidak dapat dihapus',
        code: 'CATEGORY_HAS_ORDERS',
      });
    }
    await this.prisma.ticketCategory.delete({ where: { id } });
    return { deleted: true };
  }

  private notFound() {
    return new NotFoundException({ message: 'Kategori tiket tidak ditemukan', code: 'CATEGORY_NOT_FOUND' });
  }

  private nameTaken() {
    return new ConflictException({
      message: 'Nama kategori sudah dipakai pada acara ini',
      code: 'CATEGORY_NAME_TAKEN',
    });
  }
}
