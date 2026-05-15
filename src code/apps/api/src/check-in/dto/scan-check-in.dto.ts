import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class ScanCheckInDto {
  @ApiProperty({
    description: 'Static QR value assigned to a workspace.',
    example: 'desk_t_01',
  })
  @IsString()
  @MinLength(1)
  qrCodeValue!: string;

  @ApiPropertyOptional({
    description: 'Override scan time. Defaults to server time.',
    example: '2026-05-15T09:05:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  scannedAt?: string;
}
