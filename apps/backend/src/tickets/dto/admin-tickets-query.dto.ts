import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TicketStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminTicketsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
