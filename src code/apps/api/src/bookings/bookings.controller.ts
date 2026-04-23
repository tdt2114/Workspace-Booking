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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FloorBookingStateDto } from './dto/floor-booking-state.dto';
import { RunCompletionDto } from './dto/run-completion.dto';
import { RunNoShowDto } from './dto/run-no-show.dto';

@Controller('bookings')
@UseGuards(SupabaseAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findMine(user.id);
  }

  @Get('manage')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  findManageable() {
    return this.bookingsService.findManageable();
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

  @Patch(':id/release')
  release(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.release(id, user);
  }

  @Post('run-no-show')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  runNoShow(@Body() dto: RunNoShowDto) {
    return this.bookingsService.runNoShow(dto);
  }

  @Post('run-completed')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  runCompleted(@Body() dto: RunCompletionDto) {
    return this.bookingsService.runCompleted(dto);
  }
}
