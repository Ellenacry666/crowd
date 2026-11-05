import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { createHash } from 'crypto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from './image-validation';
import { PhotoStorageService } from './photo-storage.service';

export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}

const photoNotFound = () =>
  new NotFoundException({ message: 'Foto tidak ditemukan', code: 'PHOTO_NOT_FOUND' });
const orderNotFound = () =>
  new NotFoundException({ message: 'Order tidak ditemukan', code: 'ORDER_NOT_FOUND' });

@Injectable()
export class OrderPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorageService,
  ) {}

  /** Mengunggah (atau mengganti) foto pemegang tiket pada slot tertentu milik order PENDING. */
  async upload(
    user: AuthenticatedUser,
    orderId: string,
    slot: number,
    file: UploadedPhoto | undefined,
    consent: string | undefined,
  ) {
    if (consent !== 'true') {
      throw new BadRequestException({
        message: 'Persetujuan penggunaan foto wajib diberikan',
        code: 'CONSENT_REQUIRED',
      });
    }
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({ message: 'Berkas foto wajib dikirim', code: 'PHOTO_REQUIRED' });
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException({
        message: 'Berkas bukan gambar JPG, PNG, atau WebP yang valid',
        code: 'INVALID_IMAGE',
      });
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      select: { status: true, expiresAt: true, items: { select: { quantity: true } } },
    });
    if (!order) throw orderNotFound();
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException({ message: 'Order tidak lagi menunggu pembayaran', code: 'ORDER_NOT_PENDING' });
    }
    if (order.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ message: 'Waktu pembayaran telah habis', code: 'ORDER_EXPIRED' });
    }
    const required = order.items.reduce((sum, i) => sum + i.quantity, 0);
    if (!Number.isInteger(slot) || slot < 1 || slot > required) {
      throw new BadRequestException({
        message: `Slot foto harus antara 1 dan ${required}`,
        code: 'INVALID_SLOT',
      });
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const key = await this.storage.save(file.buffer, type.ext);

    let replacedKey: string | null = null;
    try {
      replacedKey = await this.prisma.$transaction(async (tx) => {
        // Mengunci baris order: pembayaran tidak dapat selesai di tengah penulisan foto,
        // sehingga foto yang sudah ditautkan ke tiket tidak mungkin berubah.
        const lock = await tx.order.updateMany({
          where: { id: orderId, userId: user.id, status: OrderStatus.PENDING, expiresAt: { gt: new Date() } },
          data: { updatedAt: new Date() },
        });
        if (lock.count !== 1) {
          throw new ConflictException({ message: 'Order tidak lagi menunggu pembayaran', code: 'ORDER_NOT_PENDING' });
        }

        const duplicate = await tx.orderPhoto.findFirst({
          where: { orderId, sha256, slot: { not: slot } },
          select: { slot: true },
        });
        if (duplicate) {
          throw new ConflictException({
            message: `Foto ini identik dengan foto pemegang tiket ${duplicate.slot}. Gunakan foto orang yang berbeda.`,
            code: 'DUPLICATE_PHOTO',
          });
        }

        const data = {
          storageKey: key,
          mimeType: type.mime,
          sizeBytes: file.buffer.length,
          sha256,
          consentAt: new Date(),
        };
        const existing = await tx.orderPhoto.findUnique({
          where: { orderId_slot: { orderId, slot } },
          select: { id: true, storageKey: true },
        });
        if (existing) {
          await tx.orderPhoto.update({ where: { id: existing.id }, data });
          return existing.storageKey;
        }
        await tx.orderPhoto.create({ data: { orderId, slot, ...data } });
        return null;
      });
    } catch (error) {
      await this.storage.remove(key); // jangan tinggalkan file yatim
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: 'Foto identik atau terjadi konflik unggahan. Coba lagi dengan foto yang berbeda.',
          code: 'DUPLICATE_PHOTO',
        });
      }
      throw error;
    }

    if (replacedKey) await this.storage.remove(replacedKey);
    return { slot, uploaded: true };
  }

  async status(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: user.role === Role.ADMIN ? { id: orderId } : { id: orderId, userId: user.id },
      select: {
        items: { select: { quantity: true } },
        photos: { select: { id: true, slot: true, updatedAt: true }, orderBy: { slot: 'asc' } },
      },
    });
    if (!order) throw orderNotFound();
    const required = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const bySlot = new Map(order.photos.map((p) => [p.slot, p]));
    const slots = Array.from({ length: required }, (_, i) => {
      const photo = bySlot.get(i + 1);
      return { slot: i + 1, uploaded: Boolean(photo), photoId: photo?.id ?? null, updatedAt: photo?.updatedAt ?? null };
    });
    return { required, uploaded: order.photos.length, slots };
  }

  async orderImage(user: AuthenticatedUser, orderId: string, slot: number) {
    const photo = await this.prisma.orderPhoto.findFirst({
      where: {
        orderId,
        slot,
        order: user.role === Role.ADMIN ? {} : { userId: user.id },
      },
      select: { storageKey: true, mimeType: true },
    });
    if (!photo) throw photoNotFound();
    return this.readPhoto(photo);
  }

  /**
   * Foto pemegang tiket. Boleh dilihat oleh: pemilik tiket, admin, dan petugas yang
   * ditugaskan ke acara tiket tersebut. Selain itu dijawab 404 (bukan 403) agar keberadaan
   * tiket tidak dapat ditebak.
   */
  async ticketPhoto(user: AuthenticatedUser, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ownerId: true,
        eventId: true,
        holderPhoto: { select: { storageKey: true, mimeType: true } },
      },
    });
    if (!ticket || !ticket.holderPhoto) throw photoNotFound();

    let allowed = false;
    if (user.role === Role.ADMIN) allowed = true;
    else if (user.role === Role.CUSTOMER) allowed = ticket.ownerId === user.id;
    else if (user.role === Role.GATE_STAFF) {
      const assignment = await this.prisma.staffAssignment.findUnique({
        where: { staffId_eventId: { staffId: user.id, eventId: ticket.eventId } },
      });
      allowed = assignment !== null;
    }
    if (!allowed) throw photoNotFound();
    return this.readPhoto(ticket.holderPhoto);
  }

  /** Menghapus semua foto sebuah order (pembayaran gagal atau order kedaluwarsa). Best effort. */
  async deleteForOrder(orderId: string): Promise<void> {
    const photos = await this.prisma.orderPhoto.findMany({
      where: { orderId },
      select: { id: true, storageKey: true },
    });
    if (photos.length === 0) return;
    await this.prisma.orderPhoto.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });
    await Promise.all(photos.map((p) => this.storage.remove(p.storageKey)));
  }

  private async readPhoto(photo: { storageKey: string; mimeType: string }) {
    try {
      return { buffer: await this.storage.read(photo.storageKey), mime: photo.mimeType };
    } catch {
      throw photoNotFound();
    }
  }
}
