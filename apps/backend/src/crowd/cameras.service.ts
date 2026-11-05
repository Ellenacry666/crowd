import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Camera } from '@prisma/client';
import { isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { generateCameraKey, hashCameraKey } from './camera-key.util';
import { CreateCameraDto, UpdateCameraDto } from './dto/crowd.dto';

/** Kamera dianggap online bila mengirim data dalam 30 detik terakhir. */
export const ONLINE_WINDOW_MS = 30_000;

export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'NEVER' | 'DISABLED';

export function toCameraResponse(c: Camera, now = Date.now()) {
  let status: CameraStatus;
  if (!c.isActive) status = 'DISABLED';
  else if (!c.lastSeenAt) status = 'NEVER';
  else status = now - c.lastSeenAt.getTime() <= ONLINE_WINDOW_MS ? 'ONLINE' : 'OFFLINE';
  return {
    id: c.id,
    eventId: c.eventId,
    type: c.type,
    name: c.name,
    streamUrl: c.streamUrl,
    capacity: c.capacity,
    isActive: c.isActive,
    lastSeenAt: c.lastSeenAt,
    status,
  };
}

@Injectable()
export class CamerasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(eventId: string) {
    await this.assertEvent(eventId);
    const rows = await this.prisma.camera.findMany({ where: { eventId }, orderBy: { type: 'asc' } });
    return rows.map((c) => toCameraResponse(c));
  }

  /** API key hanya dikembalikan sekali di sini; yang tersimpan hanya hash-nya. */
  async create(eventId: string, dto: CreateCameraDto) {
    await this.assertEvent(eventId);
    const apiKey = generateCameraKey();
    try {
      const camera = await this.prisma.camera.create({
        data: {
          eventId,
          type: dto.type,
          name: dto.name,
          streamUrl: dto.streamUrl ?? null,
          capacity: dto.capacity ?? null,
          apiKeyHash: hashCameraKey(apiKey),
        },
      });
      return { ...toCameraResponse(camera), apiKey };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          message: `Acara ini sudah memiliki kamera ${dto.type}`,
          code: 'CAMERA_TYPE_EXISTS',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCameraDto) {
    await this.assertCamera(id);
    const camera = await this.prisma.camera.update({ where: { id }, data: { ...dto } });
    return toCameraResponse(camera);
  }

  async rotateKey(id: string) {
    await this.assertCamera(id);
    const apiKey = generateCameraKey();
    const camera = await this.prisma.camera.update({
      where: { id },
      data: { apiKeyHash: hashCameraKey(apiKey) },
    });
    return { ...toCameraResponse(camera), apiKey };
  }

  async remove(id: string) {
    await this.assertCamera(id);
    // Snapshot ikut terhapus (ON DELETE CASCADE).
    await this.prisma.camera.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertEvent(eventId: string) {
    const e = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!e) throw new NotFoundException({ message: 'Acara tidak ditemukan', code: 'EVENT_NOT_FOUND' });
  }

  private async assertCamera(id: string) {
    const c = await this.prisma.camera.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException({ message: 'Kamera tidak ditemukan', code: 'CAMERA_NOT_FOUND' });
  }
}
