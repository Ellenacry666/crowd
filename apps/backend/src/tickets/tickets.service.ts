import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QrSigner } from '../common/qr/qr-signer';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { pageMeta, paginate } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTicketsQueryDto } from './dto/admin-tickets-query.dto';

const TICKET_INCLUDE = {
  event: {
    select: { id: true, title: true, slug: true, location: true, startAt: true, endAt: true, posterUrl: true },
  },
  orderItem: {
    select: {
      ticketCategory: { select: { name: true } },
      order: { select: { orderNumber: true, status: true } },
    },
  },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrSigner,
  ) {}

  private toResponse(t: TicketWithRelations, includeQr: boolean) {
    return {
      id: t.id,
      ticketCode: t.ticketCode,
      ...(includeQr ? { qrPayload: this.qr.buildPayload(t.ticketCode) } : {}),
      status: t.status, // status penggunaan: ACTIVE | USED | CANCELLED | EXPIRED
      paymentStatus: t.orderItem.order.status,
      orderNumber: t.orderItem.order.orderNumber,
      categoryName: t.orderItem.ticketCategory.name,
      event: t.event,
      issuedAt: t.issuedAt,
      checkedInAt: t.checkedInAt,
      hasHolderPhoto: t.holderPhotoId !== null,
    };
  }

  async listMine(user: AuthenticatedUser) {
    const tickets = await this.prisma.ticket.findMany({
      where: { ownerId: user.id },
      include: TICKET_INCLUDE,
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    return tickets.map((t) => this.toResponse(t, true));
  }

  async findMine(user: AuthenticatedUser, id: string) {
    // Filter ownerId di query: tiket orang lain tidak dapat dibedakan dari tiket yang tidak ada.
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, ownerId: user.id },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException({ message: 'Tiket tidak ditemukan', code: 'TICKET_NOT_FOUND' });
    }
    return this.toResponse(ticket, true);
  }

  async listAdmin(q: AdminTicketsQueryDto) {
    const where: Prisma.TicketWhereInput = {};
    if (q.eventId) where.eventId = q.eventId;
    if (q.status) where.status = q.status;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: { ...TICKET_INCLUDE, owner: { select: { id: true, name: true, email: true } } },
        orderBy: { issuedAt: 'desc' },
        ...paginate(q),
      }),
    ]);
    return {
      // Admin tidak menerima qrPayload (token tidak perlu bocor ke dashboard).
      items: rows.map((t) => ({ ...this.toResponse(t, false), owner: t.owner })),
      meta: pageMeta(q, total),
    };
  }
}
