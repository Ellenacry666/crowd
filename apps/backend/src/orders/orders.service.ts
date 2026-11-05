import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { isUUID } from 'class-validator';
import { randomBytes } from 'crypto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { pageMeta, paginate } from '../common/utils/pagination';
import {
  MAX_TICKETS_PER_ORDER,
  maxTicketsPerUserPerEvent,
  orderExpiryMinutes,
} from '../config/runtime-flags';
import { OrderPhotosService } from '../photos/order-photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { releaseReserved } from './stock.util';

const ORDER_INCLUDE = {
  items: {
    include: {
      ticketCategory: {
        select: {
          id: true,
          name: true,
          event: {
            select: { id: true, title: true, slug: true, startAt: true, location: true },
          },
        },
      },
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export function toOrderResponse(o: OrderWithRelations) {
  const event = o.items[0]?.ticketCategory.event ?? null;
  const payment = o.payments[0] ?? null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: o.totalAmount,
    expiresAt: o.expiresAt,
    createdAt: o.createdAt,
    event,
    items: o.items.map((i) => ({
      ticketCategoryId: i.ticketCategoryId,
      categoryName: i.ticketCategory.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
    lastPayment: payment
      ? { reference: payment.reference, status: payment.status, method: payment.method, createdAt: payment.createdAt }
      : null,
  };
}

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `CP-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photos: OrderPhotosService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateOrderDto) {
    const ids = dto.items.map((i) => i.ticketCategoryId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        message: 'Kategori tiket yang sama tidak boleh muncul dua kali dalam satu order',
        code: 'DUPLICATE_ITEM',
      });
    }
    const totalQty = dto.items.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQty > MAX_TICKETS_PER_ORDER) {
      throw new BadRequestException({
        message: `Maksimum ${MAX_TICKETS_PER_ORDER} tiket per order`,
        code: 'TOO_MANY_TICKETS',
      });
    }

    const expiresAt = new Date(Date.now() + orderExpiryMinutes() * 60_000);
    const orderNumber = generateOrderNumber();

    return this.prisma.$transaction(
      async (tx) => {
        // Harga dan event selalu dibaca dari database, tidak pernah dari klien.
        const categories = await tx.ticketCategory.findMany({
          where: { id: { in: ids } },
          include: { event: true },
        });
        if (categories.length !== ids.length) {
          throw new NotFoundException({
            message: 'Kategori tiket tidak ditemukan',
            code: 'CATEGORY_NOT_FOUND',
          });
        }
        if (new Set(categories.map((c) => c.eventId)).size > 1) {
          throw new BadRequestException({
            message: 'Satu order hanya boleh berisi tiket dari satu acara',
            code: 'MIXED_EVENTS',
          });
        }
        const event = categories[0].event;
        if (event.status !== 'PUBLISHED' || event.endAt.getTime() <= Date.now()) {
          throw new ConflictException({
            message: 'Acara tidak tersedia untuk pembelian',
            code: 'EVENT_NOT_AVAILABLE',
          });
        }
        const byId = new Map(categories.map((c) => [c.id, c]));

        // Batas per akun per acara. Kunci advisory per (akun, acara) menyerialkan order yang
        // dikirim bersamaan oleh akun yang sama, sehingga hitungan di bawah tidak dapat dilewati
        // dengan dua permintaan paralel. Kunci dilepas otomatis saat transaksi selesai.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.id}:${event.id}`}))`;
        const used = await this.countTicketsForEvent(tx, user.id, event.id);
        const limit = maxTicketsPerUserPerEvent();
        if (used + totalQty > limit) {
          const remaining = Math.max(0, limit - used);
          throw new ConflictException({
            message:
              remaining === 0
                ? `Batas pembelian ${limit} tiket per acara sudah tercapai. Anda sudah memiliki atau memesan ${used} tiket untuk acara ini.`
                : `Batas pembelian ${limit} tiket per acara. Anda sudah memiliki atau memesan ${used} tiket, sisa jatah ${remaining} tiket.`,
            code: 'TICKET_LIMIT_REACHED',
          });
        }

        // Urutkan berdasarkan id agar urutan lock konsisten (mencegah deadlock).
        const ordered = [...dto.items].sort((a, b) =>
          a.ticketCategoryId.localeCompare(b.ticketCategoryId),
        );
        for (const item of ordered) {
          // Pencadangan atomik: gagal (0 baris) jika stok tidak cukup.
          const affected = await tx.$executeRaw`
            UPDATE "ticket_categories"
            SET "reservedCount" = "reservedCount" + ${item.quantity}::int,
                "updatedAt" = (NOW() AT TIME ZONE 'UTC')
            WHERE "id" = ${item.ticketCategoryId}::uuid
              AND "soldCount" + "reservedCount" + ${item.quantity}::int <= "quota"`;
          if (affected !== 1) {
            throw new ConflictException({
              message: `Stok tiket "${byId.get(item.ticketCategoryId)!.name}" tidak mencukupi`,
              code: 'INSUFFICIENT_STOCK',
            });
          }
        }

        const lines = dto.items.map((i) => {
          const c = byId.get(i.ticketCategoryId)!;
          return {
            ticketCategoryId: c.id,
            quantity: i.quantity,
            unitPrice: c.price,
            subtotal: c.price * i.quantity,
          };
        });
        const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0);

        const order = await tx.order.create({
          data: {
            userId: user.id,
            orderNumber,
            totalAmount,
            status: OrderStatus.PENDING,
            expiresAt,
            items: { create: lines },
          },
          include: ORDER_INCLUDE,
        });
        return toOrderResponse(order);
      },
      { timeout: 15_000, maxWait: 15_000 },
    );
  }

  /** Jumlah tiket akun pada satu acara: order PAID + order PENDING yang belum kedaluwarsa. */
  private async countTicketsForEvent(
    db: Prisma.TransactionClient,
    userId: string,
    eventId: string,
    now = new Date(),
  ): Promise<number> {
    const agg = await db.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        ticketCategory: { eventId },
        order: {
          userId,
          OR: [
            { status: OrderStatus.PAID },
            { status: OrderStatus.PENDING, expiresAt: { gt: now } },
          ],
        },
      },
    });
    return agg._sum.quantity ?? 0;
  }

  /** Sisa jatah pembelian akun untuk satu acara (dipakai UI agar tidak menawarkan yang pasti ditolak). */
  async quotaFor(user: AuthenticatedUser, idOrSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }
    const used = await this.countTicketsForEvent(this.prisma, user.id, event.id);
    const limit = maxTicketsPerUserPerEvent();
    return { limit, used, remaining: Math.max(0, limit - used) };
  }

  async findMine(user: AuthenticatedUser) {
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return orders.map(toOrderResponse);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.order.findFirst({
      // Customer hanya boleh melihat order miliknya; yang lain dijawab 404 (bukan 403).
      where: user.role === Role.ADMIN ? { id } : { id, userId: user.id },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException({ message: 'Order tidak ditemukan', code: 'ORDER_NOT_FOUND' });
    }
    return toOrderResponse(order);
  }

  async listAdmin(q: AdminOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.eventId) where.items = { some: { ticketCategory: { eventId: q.eventId } } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { ...ORDER_INCLUDE, user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        ...paginate(q),
      }),
    ]);
    return {
      items: rows.map((o) => ({ ...toOrderResponse(o), user: o.user })),
      meta: pageMeta(q, total),
    };
  }

  /** Menandai order PENDING yang lewat batas waktu sebagai EXPIRED dan melepas stok. Idempoten. */
  async expireOrder(orderId: string, now = new Date()): Promise<boolean> {
    const expired = await this.prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING, expiresAt: { lte: now } },
        data: { status: OrderStatus.EXPIRED },
      });
      if (r.count !== 1) return false;
      const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { ticketCategoryId: true, quantity: true },
      });
      await releaseReserved(tx, items);
      return true;
    });
    // Tidak ada tiket yang terbit, jadi foto pemegang tiket dihapus (minimisasi data pribadi).
    if (expired) await this.photos.deleteForOrder(orderId);
    return expired;
  }

  async expireOverdueOrders(now = new Date(), batchSize = 100): Promise<number> {
    const overdue = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING, expiresAt: { lte: now } },
      select: { id: true },
      take: batchSize,
    });
    let expired = 0;
    for (const { id } of overdue) {
      if (await this.expireOrder(id, now)) expired++;
    }
    return expired;
  }
}
