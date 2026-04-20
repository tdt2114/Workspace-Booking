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
  @IsUUID()
  buildingId!: string;

  @IsInt()
  @Min(-10)
  @Max(300)
  floorNumber!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  svgMapUrl?: string;
}
