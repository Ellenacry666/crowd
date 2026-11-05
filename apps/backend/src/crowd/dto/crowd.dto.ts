import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CameraType } from '@prisma/client';
import { trim } from '../../common/utils/transformers';

export class CreateCameraDto {
  @IsEnum(CameraType)
  type!: CameraType;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https', 'rtsp', 'rtmp'] })
  @MaxLength(500)
  streamUrl?: string;

  /** Kapasitas aman area (orang), dipakai menghitung level kepadatan. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity?: number;
}

export class UpdateCameraDto extends PartialType(OmitType(CreateCameraDto, ['type'] as const)) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Payload dari layanan analisis (computer vision). Kamera dikenali lewat header x-camera-key. */
export class IngestDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  capturedAt?: Date;

  /** Wajib untuk kamera CROWD: jumlah orang yang terdeteksi di area. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  peopleCount?: number;

  /** Kamera GATE: orang masuk sejak laporan sebelumnya. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  inCount?: number;

  /** Kamera GATE: orang keluar sejak laporan sebelumnya. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  outCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  density?: number;
}

export class DashboardQueryDto {
  /** Lebar jendela waktu grafik, dalam menit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  minutes: number = 60;
}
