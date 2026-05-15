import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Workspace id to reserve.',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsUUID()
  workspaceId!: string;

  @ApiProperty({
    description: 'Booking start time in ISO 8601 format.',
    example: '2026-05-15T09:00:00.000Z',
  })
  @IsISO8601()
  startTime!: string;

  @ApiProperty({
    description: 'Booking end time in ISO 8601 format.',
    example: '2026-05-15T11:00:00.000Z',
  })
  @IsISO8601()
  endTime!: string;
}
