import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSpaceOwnerRequestDto {
  @ApiPropertyOptional({
    description:
      'Optional message explaining why the user needs space owner access.',
    maxLength: 1000,
    example: 'I manage the product team area and need to publish workspaces.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
