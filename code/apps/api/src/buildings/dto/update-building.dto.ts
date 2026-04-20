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
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  totalFloors?: number;

  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'openTime must be in HH:mm or HH:mm:ss format',
  })
  openTime?: string;

  @IsOptional()
  @Matches(BUILDING_TIME_PATTERN, {
    message: 'closeTime must be in HH:mm or HH:mm:ss format',
  })
  closeTime?: string;
}
