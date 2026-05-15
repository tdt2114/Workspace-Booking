import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BUILDING_TIME_PATTERN } from './building-time.constant';

export class CreateBuildingDto {
  @ApiProperty({ example: 'Head Office' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: '123 Business Street, Bangkok' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 200 })
  @IsInt()
  @Min(1)
  @Max(200)
  totalFloors!: number;

  @ApiPropertyOptional({
    description: 'Building opening time in HH:mm or HH:mm:ss format.',
    example: '08:00',
  })
  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'openTime must be in HH:mm or HH:mm:ss format',
  })
  openTime?: string;

  @ApiPropertyOptional({
    description: 'Building closing time in HH:mm or HH:mm:ss format.',
    example: '18:00',
  })
  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'closeTime must be in HH:mm or HH:mm:ss format',
  })
  closeTime?: string;
}
