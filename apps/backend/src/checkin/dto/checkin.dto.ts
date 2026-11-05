import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  qrPayload!: string;
}
