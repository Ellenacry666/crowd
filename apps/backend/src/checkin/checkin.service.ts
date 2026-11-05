import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckInResult, EventStatus, OrderStatus, Prisma, TicketStatus } from '@prisma/client';
import { QrSigner } from '../common/qr/qr-signer';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { pageMeta, paginate } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/checkin.dto';
import { StaffCheckInsQueryDto } from './dto/staff-checkins-query.dto';

export const CHECKIN_MESSAGES: Record<CheckInResult, string> = {
  SUCCESS: 'Check-in berhasil',
  ALREADY_USED: 'Tiket sudah digunakan',
  INVALID_TOKEN: 'Tiket tidak valid',
  NOT_PAID: 'Pembayaran belum berhasil',
  CANCELLED_OR_EXPIRED: 'Tiket dibatalkan atau kedaluwarsa',
  WRONG_EVENT: 'Tiket bukan untuk acara ini',
  NOT_AUTHORIZED: 'Anda tidak memiliki izin untuk acara ini',
};

const TICKET_INCLUDE = {
  event: { select: { title: true } },
  owner: { select: { name: true } },
  orderItem: {
    select: {
      ticketCategory: { select: { name: true } },
      order: { select: { status: true } },
    },
  },
} satisfies Prisma.TicketInclude;

type InspectedTicket = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

type Rejection = { success: false; result: CheckInResult; message: string } & Record<string, unknown>;
type Inspection = { ok: false; response: Rejection } | { ok: true; ticket: InspectedTicket };

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrSigner,
  ) {}

  /**
   * Pratinjau: memeriksa tiket TANPA mengubah apa pun (status tetap ACTIVE, tidak ada log check-in).
   * Dipakai APK agar petugas dapat mencocokkan foto pemegang sebelum mengizinkan masuk.
   * Data yang dikembalikan sengaja minimal: nama pembeli dan penanda foto; tidak ada email,
   * nomor order, atau token QR.
   */
  async preview(staff: AuthenticatedUser, dto: CheckInDto) {
    const inspection = await this.inspect(staff, dto, false);
    if (!inspection.ok) return inspection.response;

    const t = inspection.ticket;
    const info = {
      id: t.id,
      ticketCode: t.ticketCode,
      categoryName: t.orderItem.ticketCategory.name,
      eventTitle: t.event.title,
      buyerName: t.owner.name,
      hasHolderPhoto: t.holderPhotoId !== null,
      status: t.status,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
    };

    if (t.status === TicketStatus.USED) {
      return {
        success: false,
        result: CheckInResult.ALREADY_USED,
        message: CHECKIN_MESSAGES.ALREADY_USED,
        firstCheckedInAt: info.checkedInAt,
        ticket: info,
      };
    }
    if (t.status === TicketStatus.CANCELLED || t.status === TicketStatus.EXPIRED) {
      return {
        success: false,
        result: CheckInResult.CANCELLED_OR_EXPIRED,
        message: CHECKIN_MESSAGES.CANCELLED_OR_EXPIRED,
      };
    }
    return {
      success: true,
      result: 'READY',
      message: 'Tiket valid. Cocokkan foto pemegang, lalu konfirmasi masuk.',
      ticket: info,
    };
  }

  async checkIn(staff: AuthenticatedUser, dto: CheckInDto) {
    const inspection = await this.inspect(staff, dto, true);
    if (!inspection.ok) return inspection.response;
    const ticket = inspection.ticket;

    // Conditional update atomik: hanya satu request yang dapat mengubah ACTIVE -> USED.
    const now = new Date();
    const won = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: { id: ticket.id, eventId: dto.eventId, status: TicketStatus.ACTIVE },
        data: { status: TicketStatus.USED, checkedInAt: now, checkedInById: staff.id },
      });
      if (updated.count !== 1) return false;
      await tx.checkInLog.create({
        data: {
          ticketId: ticket.id,
          eventId: dto.eventId,
          staffId: staff.id,
          result: CheckInResult.SUCCESS,
          scannedAt: now,
        },
      });
      return true;
    });

    if (won) {
      return {
        success: true,
        result: CheckInResult.SUCCESS,
        message: CHECKIN_MESSAGES.SUCCESS,
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          categoryName: ticket.orderItem.ticketCategory.name,
          eventTitle: ticket.event.title,
          checkedInAt: now.toISOString(),
          hasHolderPhoto: ticket.holderPhotoId !== null,
        },
      };
    }

    // Kalah balapan atau status bukan ACTIVE: baca status terkini untuk menentukan alasan.
    const current = await this.prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, checkedInAt: true },
    });
    if (current?.status === TicketStatus.USED) {
      return this.fail(true, staff.id, dto.eventId, CheckInResult.ALREADY_USED, ticket.id, 'tiket sudah digunakan', {
        firstCheckedInAt: current.checkedInAt?.toISOString() ?? null,
      });
    }
    if (current?.status === TicketStatus.CANCELLED || current?.status === TicketStatus.EXPIRED) {
      return this.fail(true, staff.id, dto.eventId, CheckInResult.CANCELLED_OR_EXPIRED, ticket.id, `status tiket ${current.status}`);
    }
    return this.fail(true, staff.id, dto.eventId, CheckInResult.INVALID_TOKEN, ticket.id, 'status tiket tidak dikenal');
  }

  /**
   * Pemeriksaan bersama untuk pratinjau dan check-in: acara ada, petugas ditugaskan,
   * signature QR valid, tiket ada, acara cocok, dan order sudah PAID.
   * `audit=true` mencatat penolakan ke log check-in; pratinjau tidak mencatat (kecuali upaya tanpa izin).
   */
  private async inspect(staff: AuthenticatedUser, dto: CheckInDto, audit: boolean): Promise<Inspection> {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
    }

    const assignment = await this.prisma.staffAssignment.findUnique({
      where: { staffId_eventId: { staffId: staff.id, eventId: dto.eventId } },
    });
    if (!assignment) {
      // Upaya tanpa izin selalu dicatat, juga pada pratinjau.
      await this.record(staff.id, dto.eventId, CheckInResult.NOT_AUTHORIZED, null, 'petugas tidak ditugaskan');
      throw new ForbiddenException({
        message: CHECKIN_MESSAGES.NOT_AUTHORIZED,
        code: CheckInResult.NOT_AUTHORIZED,
      });
    }

    // Signature diverifikasi sebelum menyentuh database.
    const parsed = this.qr.parsePayload(dto.qrPayload);
    if (!parsed) {
      return { ok: false, response: await this.fail(audit, staff.id, dto.eventId, CheckInResult.INVALID_TOKEN, null, 'format atau signature tidak valid') };
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketCode: parsed.ticketCode },
      include: TICKET_INCLUDE,
    });
    if (!ticket) {
      return { ok: false, response: await this.fail(audit, staff.id, dto.eventId, CheckInResult.INVALID_TOKEN, null, 'tiket tidak ditemukan') };
    }
    if (ticket.eventId !== dto.eventId) {
      return { ok: false, response: await this.fail(audit, staff.id, dto.eventId, CheckInResult.WRONG_EVENT, ticket.id, 'tiket milik acara lain') };
    }
    if (ticket.orderItem.order.status !== OrderStatus.PAID) {
      return { ok: false, response: await this.fail(audit, staff.id, dto.eventId, CheckInResult.NOT_PAID, ticket.id, 'order belum PAID') };
    }
    return { ok: true, ticket };
  }

  async listMyEvents(staff: AuthenticatedUser) {
    const assignments = await this.prisma.staffAssignment.findMany({
      where: { staffId: staff.id, event: { status: EventStatus.PUBLISHED } },
      include: { event: true },
      orderBy: { event: { startAt: 'asc' } },
    });
    const ids = assignments.map((a) => a.eventId);
    const stats = new Map<string, { issued: number; checkedIn: number }>();
    if (ids.length > 0) {
      const grouped = await this.prisma.ticket.groupBy({
        by: ['eventId', 'status'],
        where: { eventId: { in: ids } },
        _count: { _all: true },
      });
      for (const g of grouped) {
        const s = stats.get(g.eventId) ?? { issued: 0, checkedIn: 0 };
        s.issued += g._count._all;
        if (g.status === TicketStatus.USED) s.checkedIn += g._count._all;
        stats.set(g.eventId, s);
      }
    }
    return assignments.map((a) => ({
      id: a.event.id,
      title: a.event.title,
      location: a.event.location,
      startAt: a.event.startAt,
      endAt: a.event.endAt,
      status: a.event.status,
      stats: stats.get(a.eventId) ?? { issued: 0, checkedIn: 0 },
    }));
  }

  async listMyCheckIns(staff: AuthenticatedUser, q: StaffCheckInsQueryDto) {
    const where: Prisma.CheckInLogWhereInput = { staffId: staff.id };
    if (q.eventId) where.eventId = q.eventId;
    if (q.result) where.result = q.result;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.checkInLog.count({ where }),
      this.prisma.checkInLog.findMany({
        where,
        include: {
          event: { select: { title: true } },
          ticket: {
            select: {
              ticketCode: true,
              orderItem: { select: { ticketCategory: { select: { name: true } } } },
            },
          },
        },
        orderBy: { scannedAt: 'desc' },
        ...paginate(q),
      }),
    ]);
    return {
      items: rows.map((l) => ({
        id: l.id,
        result: l.result,
        reason: l.reason,
        scannedAt: l.scannedAt,
        eventId: l.eventId,
        eventTitle: l.event.title,
        ticket: l.ticket
          ? { ticketCode: l.ticket.ticketCode, categoryName: l.ticket.orderItem.ticketCategory.name }
          : null,
      })),
      meta: pageMeta(q, total),
    };
  }

  private async record(
    staffId: string,
    eventId: string,
    result: CheckInResult,
    ticketId: string | null,
    reason: string,
  ) {
    await this.prisma.checkInLog.create({ data: { staffId, eventId, result, ticketId, reason } });
  }

  private async fail(
    audit: boolean,
    staffId: string,
    eventId: string,
    result: CheckInResult,
    ticketId: string | null,
    reason: string,
    extra: Record<string, unknown> = {},
  ): Promise<Rejection> {
    if (audit) await this.record(staffId, eventId, result, ticketId, reason);
    return { success: false, result, message: CHECKIN_MESSAGES[result], ...extra };
  }
}
