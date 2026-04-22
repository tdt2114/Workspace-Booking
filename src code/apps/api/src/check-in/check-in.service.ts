import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { ScanCheckInDto } from './dto/scan-check-in.dto';

const CHECK_IN_EARLY_MINUTES = 10;
const CHECK_IN_LATE_MAX_MINUTES = 30;

type WorkspaceQrRecord = {
  id: string;
  floor_id: string;
  name: string;
  status: string;
  svg_element_id: string;
  qr_code_value: string;
};

type BookingRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  start_time: string;
  end_time: string;
  status: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

@Injectable()
export class CheckInService {
  async scan(user: AuthenticatedUser, dto: ScanCheckInDto) {
    const scannedAt = dto.scannedAt ? new Date(dto.scannedAt) : new Date();

    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('scannedAt must be a valid ISO datetime');
    }

    const workspace = await this.findWorkspaceByQrCode(dto.qrCodeValue.trim());
    const bookings = await this.findCandidateBookings(user.id, workspace.id);
    const matchedBooking = bookings.find((booking) =>
      this.isWithinCheckInWindow(booking, scannedAt),
    );

    if (!matchedBooking) {
      throw new BadRequestException(
        'No confirmed booking was found for this workspace in the current check-in window',
      );
    }

    if (matchedBooking.status === 'checked_in') {
      return {
        message: 'Booking already checked in',
        alreadyCheckedIn: true,
        scannedAt: scannedAt.toISOString(),
        workspace,
        booking: matchedBooking,
      };
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'checked_in',
        checked_in_at: scannedAt.toISOString(),
      })
      .eq('id', matchedBooking.id)
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .single<BookingRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to update booking check-in status',
        details: error?.message,
      });
    }

    return {
      message: 'Check-in successful',
      alreadyCheckedIn: false,
      scannedAt: scannedAt.toISOString(),
      workspace,
      booking: data,
    };
  }

  private async findWorkspaceByQrCode(qrCodeValue: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, floor_id, name, status, svg_element_id, qr_code_value')
      .eq('qr_code_value', qrCodeValue)
      .single<WorkspaceQrRecord>();

    if (error || !data) {
      throw new NotFoundException('Workspace QR code was not found');
    }

    return data;
  }

  private async findCandidateBookings(userId: string, workspaceId: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .in('status', ['confirmed', 'checked_in'])
      .order('start_time', { ascending: true })
      .returns<BookingRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch candidate bookings for check-in',
        details: error.message,
      });
    }

    return data;
  }

  private isWithinCheckInWindow(booking: BookingRecord, scannedAt: Date) {
    const bookingStart = new Date(booking.start_time);
    const bookingEnd = new Date(booking.end_time);
    const checkInOpensAt = new Date(bookingStart);
    const bookingDurationMs = bookingEnd.getTime() - bookingStart.getTime();
    const quarterDurationMs = bookingDurationMs / 4;
    const lateGraceMs = Math.min(
      quarterDurationMs,
      CHECK_IN_LATE_MAX_MINUTES * 60 * 1000,
    );
    const checkInClosesAt = new Date(bookingStart.getTime() + lateGraceMs);

    checkInOpensAt.setMinutes(
      checkInOpensAt.getMinutes() - CHECK_IN_EARLY_MINUTES,
    );

    return scannedAt >= checkInOpensAt && scannedAt <= checkInClosesAt;
  }
}
