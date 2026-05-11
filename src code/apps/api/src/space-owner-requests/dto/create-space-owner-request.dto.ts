import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSpaceOwnerRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
