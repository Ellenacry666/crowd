import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function countMap(rows: Array<Record<string, any>>, key: 'status' | 'result') {
  const map: Record<string, number> = {};
  for (const r of rows) map[String(r[key])] = r._count._all;
  return map;
}

export interface CheckInStats {
  issued: number;
  checkedIn: number;
  notCheckedIn: number;
  percentage: number;
  invalidTickets: number;
}

/**
 * Statistik check-in murni dari status tiket (tanpa data kamera).
 *   notCheckedIn = issued - checkedIn
 *   percentage   = checkedIn / issued * 100  (0 bila belum ada tiket, 1 desimal)
 * `issued` = semua tiket acara, sama dengan definisi di GET /staff/events agar angka admin dan APK konsisten.
 */
export function buildCheckInStats(byStatus: Partial<Record<TicketStatus, number>>): CheckInStats {
  const issued = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0);
  const checkedIn = byStatus[TicketStatus.USED] ?? 0;
  return {
    issued,
    checkedIn,
    notCheckedIn: Math.max(0, issued - checkedIn),
    percentage: issued > 0 ? Math.round((checkedIn / issued) * 1000) / 10 : 0,
    invalidTickets: (byStatus[TicketStatus.CANCELLED] ?? 0) + (byStatus[TicketStatus.EXPIRED] ?? 0),
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [events, orders, revenue, tickets] = await Promise.all([
      this.prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { status: OrderStatus.PAID }, _sum: { totalAmount: true } }),
      this.prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
    const eventsByStatus = countMap(events, 'status');
    const ordersByStatus = countMap(orders, 'status');
    const ticketsByStatus = countMap(tickets, 'status');
    return {
      events: { total: sum(eventsByStatus), byStatus: eventsByStatus },
      orders: { total: sum(ordersByStatus), byStatus: ordersByStatus },
      tickets: { issued: sum(ticketsByStatus), byStatus: ticketsByStatus },
      // Nilai simulasi, bukan uang sungguhan.
      simulatedRevenue: revenue._sum.totalAmount ?? 0,
    };
  }

  async sales(eventId?: string) {
    const categories = await this.prisma.ticketCategory.findMany({
      where: eventId ? { eventId } : {},
      include: { event: { select: { title: true } } },
      orderBy: [{ eventId: 'asc' }, { createdAt: 'asc' }],
    });
    const paid = await this.prisma.orderItem.groupBy({
      by: ['ticketCategoryId'],
      where: {
        order: { status: OrderStatus.PAID },
        ...(eventId ? { ticketCategory: { eventId } } : {}),
      },
      _sum: { quantity: true, subtotal: true },
    });
    const paidById = new Map(paid.map((p) => [p.ticketCategoryId, p._sum]));
    return categories.map((c) => ({
      ticketCategoryId: c.id,
      eventId: c.eventId,
      eventTitle: c.event.title,
      name: c.name,
      price: c.price,
      quota: c.quota,
      soldCount: c.soldCount,
      reservedCount: c.reservedCount,
      available: Math.max(0, c.quota - c.soldCount - c.reservedCount),
      ticketsPaid: paidById.get(c.id)?.quantity ?? 0,
      simulatedRevenue: paidById.get(c.id)?.subtotal ?? 0,
    }));
  }

  /** Independen dari crowd monitoring: hanya membaca tabel tickets. */
  async eventCheckInStats(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }
    const [grouped, last] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where: { eventId }, _count: { _all: true } }),
      this.prisma.ticket.aggregate({
        where: { eventId, status: TicketStatus.USED },
        _max: { checkedInAt: true },
      }),
    ]);
    const byStatus: Partial<Record<TicketStatus, number>> = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;
    return {
      eventId,
      ...buildCheckInStats(byStatus),
      lastCheckInAt: last._max.checkedInAt,
      generatedAt: new Date().toISOString(),
    };
  }

  async checkins(eventId?: string) {
    const ticketWhere: Prisma.TicketWhereInput = eventId ? { eventId } : {};
    const logWhere: Prisma.CheckInLogWhereInput = eventId ? { eventId } : {};
    const [issued, used, byResult, recent] = await Promise.all([
      this.prisma.ticket.count({ where: ticketWhere }),
      this.prisma.ticket.count({ where: { ...ticketWhere, status: TicketStatus.USED } }),
      this.prisma.checkInLog.groupBy({ by: ['result'], where: logWhere, _count: { _all: true } }),
      this.prisma.checkInLog.findMany({
        where: logWhere,
        include: {
          staff: { select: { name: true } },
          event: { select: { title: true } },
          ticket: { select: { ticketCode: true } },
        },
        orderBy: { scannedAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      ticketsIssued: issued,
      ticketsCheckedIn: used,
      byResult: countMap(byResult, 'result'),
      recent: recent.map((l) => ({
        id: l.id,
        result: l.result,
        reason: l.reason,
        scannedAt: l.scannedAt,
        staffName: l.staff.name,
        eventTitle: l.event.title,
        ticketCode: l.ticket?.ticketCode ?? null,
      })),
    };
  }
}
