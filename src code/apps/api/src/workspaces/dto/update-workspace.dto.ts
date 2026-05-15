import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
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

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsOptional()
  @IsUUID()
  floorId?: string;

  @ApiPropertyOptional({ example: 'Desk T-01' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: WORKSPACE_TYPES, example: 'desk' })
  @IsOptional()
  @IsIn(WORKSPACE_TYPES)
  type?: (typeof WORKSPACE_TYPES)[number];

  @ApiPropertyOptional({ enum: WORKSPACE_STATUSES, example: 'available' })
  @IsOptional()
  @IsIn(WORKSPACE_STATUSES)
  status?: (typeof WORKSPACE_STATUSES)[number];

  @ApiPropertyOptional({
    enum: WORKSPACE_APPROVAL_STATUSES,
    example: 'approved',
  })
  @IsOptional()
  @IsIn(WORKSPACE_APPROVAL_STATUSES)
  approvalStatus?: (typeof WORKSPACE_APPROVAL_STATUSES)[number];

  @ApiPropertyOptional({ example: 'SVG id does not match the submitted map.' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ example: 'desk_t_01' })
  @IsOptional()
  @IsString()
  svgElementId?: string;

  @ApiPropertyOptional({ example: 'desk_t_01' })
  @IsOptional()
  @IsString()
  qrCodeValue?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({
    example: { monitor: true, near_window: false },
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
