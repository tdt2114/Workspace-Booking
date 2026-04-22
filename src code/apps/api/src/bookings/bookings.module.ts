import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingsLifecycleService } from './bookings-lifecycle.service';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsLifecycleService],
})
export class BookingsModule {}
