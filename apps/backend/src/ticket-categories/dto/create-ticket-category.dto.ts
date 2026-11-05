import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../../common/utils/transformers';

export class CreateTicketCategoryDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  /** Harga dalam Rupiah (integer). */
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quota!: number;
}
