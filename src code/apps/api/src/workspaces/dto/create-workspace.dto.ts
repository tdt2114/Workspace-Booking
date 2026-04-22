import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { WORKSPACE_STATUSES, WORKSPACE_TYPES } from './workspace.constants';

export class CreateWorkspaceDto {
  @IsUUID()
  floorId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsIn(WORKSPACE_TYPES)
  type?: (typeof WORKSPACE_TYPES)[number];

  @IsOptional()
  @IsIn(WORKSPACE_STATUSES)
  status?: (typeof WORKSPACE_STATUSES)[number];

  @IsString()
  @IsNotEmpty()
  svgElementId!: string;

  @IsString()
  @IsNotEmpty()
  qrCodeValue!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
