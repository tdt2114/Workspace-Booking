import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewSpaceOwnerRequestDto {
  @ApiProperty({
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @ApiPropertyOptional({
    maxLength: 1000,
    example: 'Approved for managing the product team spaces.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
