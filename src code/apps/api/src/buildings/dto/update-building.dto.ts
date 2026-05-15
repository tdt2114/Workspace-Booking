import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BUILDING_TIME_PATTERN } from './building-time.constant';

export class UpdateBuildingDto {
  @ApiPropertyOptional({ example: 'Head Office' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '123 Business Street, Bangkok' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  totalFloors?: number;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'openTime must be in HH:mm or HH:mm:ss format',
  })
  openTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'closeTime must be in HH:mm or HH:mm:ss format',
  })
  closeTime?: string;
}
