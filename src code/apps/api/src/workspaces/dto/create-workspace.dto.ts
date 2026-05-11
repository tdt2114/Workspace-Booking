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
import {
  WORKSPACE_APPROVAL_STATUSES,
  WORKSPACE_STATUSES,
  WORKSPACE_TYPES,
} from './workspace.constants';

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

  @IsOptional()
  @IsIn(WORKSPACE_APPROVAL_STATUSES)
  approvalStatus?: (typeof WORKSPACE_APPROVAL_STATUSES)[number];

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
