import { IsISO8601, IsOptional } from 'class-validator';

export class RunCompletionDto {
  @IsOptional()
  @IsISO8601()
  effectiveAt?: string;
}
