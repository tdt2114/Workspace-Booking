import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateFloorDto {
  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ example: 1, minimum: -10, maximum: 300 })
  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(300)
  floorNumber?: number;

  @ApiPropertyOptional({ example: 'Floor 1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'floor-maps/floor-1.svg' })
  @IsOptional()
  @IsString()
  svgMapUrl?: string;
}
