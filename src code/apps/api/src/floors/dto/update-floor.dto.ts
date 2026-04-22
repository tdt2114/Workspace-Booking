import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateFloorDto {
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(300)
  floorNumber?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  svgMapUrl?: string;
}
