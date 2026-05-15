import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Floor id this workspace belongs to.',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsUUID()
  floorId!: string;

  @ApiProperty({ example: 'Desk T-01' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    enum: WORKSPACE_TYPES,
    example: 'desk',
  })
  @IsOptional()
  @IsIn(WORKSPACE_TYPES)
  type?: (typeof WORKSPACE_TYPES)[number];

  @ApiPropertyOptional({
    enum: WORKSPACE_STATUSES,
    example: 'available',
  })
  @IsOptional()
  @IsIn(WORKSPACE_STATUSES)
  status?: (typeof WORKSPACE_STATUSES)[number];

  @ApiPropertyOptional({
    enum: WORKSPACE_APPROVAL_STATUSES,
    example: 'pending_approval',
  })
  @IsOptional()
  @IsIn(WORKSPACE_APPROVAL_STATUSES)
  approvalStatus?: (typeof WORKSPACE_APPROVAL_STATUSES)[number];

  @ApiProperty({
    description: 'SVG element id from the floor map.',
    example: 'desk_t_01',
  })
  @IsString()
  @IsNotEmpty()
  svgElementId!: string;

  @ApiProperty({
    description: 'Static QR code value assigned to this workspace.',
    example: 'desk_t_01',
  })
  @IsString()
  @IsNotEmpty()
  qrCodeValue!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Free-form workspace feature metadata.',
    example: { monitor: true, near_window: false },
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
