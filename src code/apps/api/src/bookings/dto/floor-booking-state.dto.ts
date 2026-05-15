import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

export class FloorBookingStateDto {
  @ApiProperty({
    description: 'Floor id whose workspace booking state should be calculated.',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsUUID()
  floorId!: string;

  @ApiProperty({
    description: 'Start of the inspected time range.',
    example: '2026-05-15T09:00:00.000Z',
  })
  @IsISO8601()
  startTime!: string;

  @ApiProperty({
    description: 'End of the inspected time range.',
    example: '2026-05-15T11:00:00.000Z',
  })
  @IsISO8601()
  endTime!: string;
}
