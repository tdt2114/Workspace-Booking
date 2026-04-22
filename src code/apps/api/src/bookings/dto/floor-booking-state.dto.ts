import { IsISO8601, IsUUID } from 'class-validator';

export class FloorBookingStateDto {
  @IsUUID()
  floorId!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;
}
