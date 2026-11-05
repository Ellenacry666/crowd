import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { MAX_TICKETS_PER_ORDER } from '../../config/runtime-flags';

export class CreateOrderItemDto {
  @IsUUID()
  ticketCategoryId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_TICKETS_PER_ORDER)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TICKETS_PER_ORDER)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
