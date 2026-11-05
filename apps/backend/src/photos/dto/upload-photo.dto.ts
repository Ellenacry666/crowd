import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Field teks pada permintaan multipart. Persetujuan diperiksa di service agar kodenya jelas. */
export class UploadPhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  consent?: string;
}
