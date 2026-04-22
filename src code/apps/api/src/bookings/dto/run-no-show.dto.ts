import { IsISO8601, IsOptional } from 'class-validator';

export class RunNoShowDto {
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}
