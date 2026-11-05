import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventStatus } from '@prisma/client';
import { trim } from '../../common/utils/transformers';

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung',
  })
  @MaxLength(100)
  slug?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location!: string;

  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @Type(() => Date)
  @IsDate()
  endAt!: Date;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  posterUrl?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
