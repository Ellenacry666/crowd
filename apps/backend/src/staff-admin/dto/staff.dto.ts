import { PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/utils/transformers';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateStaffDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password harus mengandung minimal satu huruf dan satu angka',
  })
  password!: string;
}

export class UpdateStaffDto extends PartialType(OmitType(CreateStaffDto, ['email'] as const)) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignStaffDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  staffIds!: string[];
}
