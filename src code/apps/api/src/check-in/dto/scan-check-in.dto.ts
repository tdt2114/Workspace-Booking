import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class ScanCheckInDto {
  @IsString()
  @MinLength(1)
  qrCodeValue!: string;

  @IsOptional()
  @IsISO8601()
  scannedAt?: string;
}
