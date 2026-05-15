import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @ApiPropertyOptional({
    description: 'Optional user-facing reason for cancellation.',
    maxLength: 500,
    example: 'Schedule changed',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}
