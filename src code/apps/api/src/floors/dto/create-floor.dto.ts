import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({
    description: 'Building id this floor belongs to.',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @IsUUID()
  buildingId!: string;

  @ApiProperty({ example: 1, minimum: -10, maximum: 300 })
  @IsInt()
  @Min(-10)
  @Max(300)
  floorNumber!: number;

  @ApiPropertyOptional({ example: 'Floor 1' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Stored SVG map URL.',
    example: 'floor-maps/floor-1.svg',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  svgMapUrl?: string;
}
