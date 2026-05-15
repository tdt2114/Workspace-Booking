import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class RunNoShowDto {
  @ApiPropertyOptional({
    description: 'Override lifecycle evaluation time. Defaults to now.',
    example: '2026-05-15T09:45:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}
