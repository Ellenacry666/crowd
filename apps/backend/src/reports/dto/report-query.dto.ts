import { IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
