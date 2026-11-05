import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../common/utils/transformers';

export class CreateLineupDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  artistName!: string;

  @IsOptional()
  @IsBoolean()
  isGuestStar?: boolean;

  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @Type(() => Date)
  @IsDate()
  endAt!: Date;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateLineupDto extends PartialType(CreateLineupDto) {}
