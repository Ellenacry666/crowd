import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, TicketStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { QrSigner } from '../common/qr/qr-signer';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { isPaymentSimulationEnabled } from '../config/runtime-flags';
import { OrdersService } from '../orders/orders.service';
import { commitReservedToSold, releaseReserved } from '../orders/stock.util';
import { OrderPhotosService } from '../photos/order-photos.service';
import { PrismaService } from '../prisma/prisma.service';
import { SimulatedOutcome } from './dto/simulate-payment.dto';

const NOTICE = 'SIMULASI pembayaran untuk demonstrasi akademik, bukan transaksi uang sungguhan.';

type SimulationResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'not_pending'; status: OrderStatus }
  | {
      kind: 'ok';
      order: { id: string; orderNumber: string; status: OrderStatus; totalAmount: number };
      reference: string;
      paymentStatus: PaymentStatus;
      ticketsIssued: number;
    };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly photos: OrderPhotosService,
    private readonly qr: QrSigner,
  ) {}

  async simulate(user: AuthenticatedUser, orderId: string, outcome: SimulatedOutcome) {
    // Di luar lingkungan demo endpoint ini seolah tidak ada.
    if (!isPaymentSimulationEnabled()) throw new NotFoundException();

    const result = await this.prisma.$transaction<SimulationResult>(
      async (tx) => {
        const success = outcome === SimulatedOutcome.SUCCESS;

        // Klaim atomik: hanya satu request yang dapat memindahkan order dari PENDING.
        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            userId: user.id,
            status: OrderStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
          data: { status: success ? OrderStatus.PAID : OrderStatus.FAILED },
        });

        if (claimed.count !== 1) {
          const existing = await tx.order.findFirst({
            where: { id: orderId, userId: user.id },
            select: { status: true },
          });
          if (!existing) return { kind: 'not_found' };
          if (existing.status === OrderStatus.PENDING) return { kind: 'expired' };
          return { kind: 'not_pending', status: existing.status };
        }

        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: { include: { ticketCategory: { select: { eventId: true } } } } },
        });
        const lines = order.items.map((i) => ({
          ticketCategoryId: i.ticketCategoryId,
          quantity: i.quantity,
        }));
        const reference = `SIM-${randomBytes(8).toString('hex').toUpperCase()}`;
        const summary = {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
        };

        if (success) {
          // Syarat anti-calo: satu foto pemegang untuk setiap tiket. Melempar error di sini
          // membatalkan seluruh transaksi (order kembali PENDING, tanpa tiket).
          const required = order.items.reduce((sum, i) => sum + i.quantity, 0);
          const photos = await tx.orderPhoto.findMany({
            where: { orderId },
            orderBy: { slot: 'asc' },
            select: { id: true },
          });
          if (photos.length < required) {
            throw new ConflictException({
              message: `Foto pemegang tiket belum lengkap (${photos.length} dari ${required})`,
              code: 'PHOTOS_REQUIRED',
            });
          }

          await commitReservedToSold(tx, lines);
          await tx.paymentTransaction.create({
            data: { orderId, method: 'SIMULATION', status: PaymentStatus.SUCCESS, reference },
          });

          // Foto slot ke-k ditautkan ke tiket ke-k (urutan item, lalu urutan unit).
          let index = 0;
          const tickets = order.items.flatMap((item) =>
            Array.from({ length: item.quantity }, () => ({
              orderItemId: item.id,
              eventId: item.ticketCategory.eventId,
              ownerId: user.id,
              ticketCode: this.qr.generateTicketCode(),
              qrVersion: 1,
              status: TicketStatus.ACTIVE,
              holderPhotoId: photos[index++].id,
            })),
          );
          await tx.ticket.createMany({ data: tickets });
          return {
            kind: 'ok',
            order: summary,
            reference,
            paymentStatus: PaymentStatus.SUCCESS,
            ticketsIssued: tickets.length,
          };
        }

        await releaseReserved(tx, lines);
        await tx.paymentTransaction.create({
          data: { orderId, method: 'SIMULATION', status: PaymentStatus.FAILED, reference },
        });
        return {
          kind: 'ok',
          order: summary,
          reference,
          paymentStatus: PaymentStatus.FAILED,
          ticketsIssued: 0,
        };
      },
      { timeout: 15_000, maxWait: 15_000 },
    );

    switch (result.kind) {
      case 'not_found':
        throw new NotFoundException({ message: 'Order tidak ditemukan', code: 'ORDER_NOT_FOUND' });
      case 'expired':
        await this.orders.expireOrder(orderId); // lepas stok dan hapus foto
        throw new GoneException({ message: 'Waktu pembayaran telah habis', code: 'ORDER_EXPIRED' });
      case 'not_pending':
        throw new ConflictException({
          message: `Order sudah berstatus ${result.status}`,
          code: 'ORDER_NOT_PENDING',
        });
      default:
        // Pembayaran gagal: tidak ada tiket, jadi foto yang sudah diunggah dihapus (minimisasi data).
        if (result.paymentStatus === PaymentStatus.FAILED) {
          await this.photos.deleteForOrder(orderId);
        }
        return {
          order: result.order,
          payment: { reference: result.reference, method: 'SIMULATION', status: result.paymentStatus },
          ticketsIssued: result.ticketsIssued,
          notice: NOTICE,
        };
    }
  }
}
