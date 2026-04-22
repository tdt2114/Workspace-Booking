import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CheckInService } from './check-in.service';
import { ScanCheckInDto } from './dto/scan-check-in.dto';

@Controller('check-in')
@UseGuards(SupabaseAuthGuard)
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('scan')
  scan(@CurrentUser() user: AuthenticatedUser, @Body() dto: ScanCheckInDto) {
    return this.checkInService.scan(user, dto);
  }
}
