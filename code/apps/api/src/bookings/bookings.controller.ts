import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FloorBookingStateDto } from './dto/floor-booking-state.dto';

@Controller('bookings')
@UseGuards(SupabaseAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findMine(user.id);
  }

  @Get('floor-state')
  findFloorState(@Query() dto: FloorBookingStateDto) {
    return this.bookingsService.findFloorState(dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user, dto);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user, dto);
  }
}
