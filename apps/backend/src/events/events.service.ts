import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { randomBytes } from 'crypto';
import { pageMeta, paginate } from '../common/utils/pagination';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { slugify } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AdminListEventsQueryDto, ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type EventWithCategories = Prisma.EventGetPayload<{ include: { ticketCategories: true } }>;

export function toEventResponse(e: EventWithCategories, admin = false) {
  const categories = [...e.ticketCategories]
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      price: c.price,
      quota: c.quota,
      available: Math.max(0, c.quota - c.soldCount - c.reservedCount),
      ...(admin ? { soldCount: c.soldCount, reservedCount: c.reservedCount } : {}),
    }));
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    category: e.category,
    description: e.description,
    location: e.location,
    startAt: e.startAt,
    endAt: e.endAt,
    posterUrl: e.posterUrl,
    status: e.status,
    minPrice: categories.length ? Math.min(...categories.map((c) => c.price)) : null,
    ticketCategories: categories,
  };
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Publik ----------
  async listPublic(q: ListEventsQueryDto) {
    const where: Prisma.EventWhereInput = {
      status: EventStatus.PUBLISHED,
      endAt: { gt: new Date() },
    };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { location: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.category) where.category = { equals: q.category, mode: 'insensitive' };
    if (q.dateFrom || q.dateTo) {
      const range: Prisma.DateTimeFilter = {};
      if (q.dateFrom) range.gte = q.dateFrom;
      if (q.dateTo) range.lte = q.dateTo;
      where.startAt = range;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { ticketCategories: true },
        orderBy: { startAt: 'asc' },
        ...paginate(q),
      }),
    ]);
    return { items: rows.map((e) => toEventResponse(e)), meta: pageMeta(q, total) };
  }

  async findPublic(idOrSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        status: EventStatus.PUBLISHED,
        ...(isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug }),
      },
      include: { ticketCategories: true },
    });
    if (!event) throw this.notFound();
    return toEventResponse(event);
  }

  // ---------- Admin ----------
  async listAdmin(q: AdminListEventsQueryDto) {
    const where: Prisma.EventWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { ticketCategories: true },
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
    ]);
    return { items: rows.map((e) => toEventResponse(e, true)), meta: pageMeta(q, total) };
  }

  async findAdmin(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { ticketCategories: true },
    });
    if (!event) throw this.notFound();
    return toEventResponse(event, true);
  }

  async create(dto: CreateEventDto) {
    this.assertTimeRange(dto.startAt, dto.endAt);
    const explicitSlug = Boolean(dto.slug);
    const baseSlug = dto.slug ?? slugify(dto.title);
    let slug = baseSlug;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await this.prisma.event.create({
          data: {
            title: dto.title,
            slug,
            category: dto.category,
            description: dto.description,
            location: dto.location,
            startAt: dto.startAt,
            endAt: dto.endAt,
            posterUrl: dto.posterUrl ?? null,
            status: dto.status ?? EventStatus.DRAFT,
          },
          include: { ticketCategories: true },
        });
        return toEventResponse(created, true);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        if (explicitSlug) {
          throw new ConflictException({ message: 'Slug sudah dipakai', code: 'SLUG_TAKEN' });
        }
        slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
      }
    }
    throw new ConflictException({ message: 'Gagal membuat slug unik', code: 'SLUG_TAKEN' });
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw this.notFound();
    this.assertTimeRange(dto.startAt ?? existing.startAt, dto.endAt ?? existing.endAt);

    try {
      const updated = await this.prisma.event.update({
        where: { id },
        data: { ...dto },
        include: { ticketCategories: true },
      });
      return toEventResponse(updated, true);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ message: 'Slug sudah dipakai', code: 'SLUG_TAKEN' });
      }
      throw error;
    }
  }

  /**
   * Menandai acara PUBLISHED yang sudah berakhir sebagai FINISHED. Hanya status PUBLISHED yang diubah:
   * DRAFT dan CANCELLED tidak disentuh. Masa tenggang (menit) dapat diatur lewat
   * EVENT_AUTO_FINISH_GRACE_MINUTES (default 0) bila acara sering molor.
   */
  async finishEndedEvents(now = new Date()): Promise<number> {
    const raw = Number(process.env.EVENT_AUTO_FINISH_GRACE_MINUTES ?? 0);
    const graceMs = Number.isFinite(raw) && raw > 0 ? raw * 60_000 : 0;
    const res = await this.prisma.event.updateMany({
      where: { status: EventStatus.PUBLISHED, endAt: { lt: new Date(now.getTime() - graceMs) } },
      data: { status: EventStatus.FINISHED },
    });
    return res.count;
  }

  async remove(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) throw this.notFound();

    const orderItems = await this.prisma.orderItem.count({
      where: { ticketCategory: { eventId: id } },
    });
    if (orderItems > 0) {
      throw new ConflictException({
        message: 'Acara sudah memiliki order. Ubah status menjadi CANCELLED, jangan dihapus.',
        code: 'EVENT_HAS_ORDERS',
      });
    }
    await this.prisma.$transaction([
      this.prisma.checkInLog.deleteMany({ where: { eventId: id } }),
      this.prisma.crowdSnapshot.deleteMany({ where: { eventId: id } }),
      this.prisma.camera.deleteMany({ where: { eventId: id } }),
      this.prisma.lineup.deleteMany({ where: { eventId: id } }),
      this.prisma.ticketCategory.deleteMany({ where: { eventId: id } }),
      this.prisma.event.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  private assertTimeRange(startAt: Date, endAt: Date) {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException({
        message: 'endAt harus setelah startAt',
        code: 'INVALID_TIME_RANGE',
      });
    }
  }

  private notFound() {
    return new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
  }
}
