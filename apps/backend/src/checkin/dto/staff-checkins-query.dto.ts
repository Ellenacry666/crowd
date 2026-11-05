import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CheckInResult } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class StaffCheckInsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsEnum(CheckInResult)
  result?: CheckInResult;
}
