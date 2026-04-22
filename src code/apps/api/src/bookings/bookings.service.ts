import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { isCheckInWindowExpired } from '../check-in/check-in-window';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import {
  MAX_ACTIVE_BOOKINGS_PER_USER,
  MAX_BOOKING_ADVANCE_DAYS,
  MAX_BOOKING_ADVANCE_MS,
  MAX_BOOKING_DURATION_HOURS,
  MAX_BOOKING_DURATION_MS,
  MIN_BOOKING_DURATION_MINUTES,
  MIN_BOOKING_DURATION_MS,
  MIN_BOOKING_LEAD_TIME_MINUTES,
  MIN_BOOKING_LEAD_TIME_MS,
} from './booking-policy';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FloorBookingStateDto } from './dto/floor-booking-state.dto';
import { RunCompletionDto } from './dto/run-completion.dto';
import { RunNoShowDto } from './dto/run-no-show.dto';

type WorkspaceStatusRecord = {
  id: string;
  name: string;
  status: string;
};

type WorkspaceIdRecord = {
  id: string;
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

type UserSummaryRecord = {
  id: string;
  email: string;
  full_name: string | null;
};

type ManagedBookingRecord = BookingRecord & {
  user_email: string | null;
  user_full_name: string | null;
};

@Injectable()
export class BookingsService {
  async findMine(userId: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch bookings from Supabase',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data as BookingRecord[],
    };
  }

  async findManageable() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .order('start_time', { ascending: false });

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch manageable bookings from Supabase',
        details: error.message,
      });
    }

    const bookings = data as BookingRecord[];
    const uniqueUserIds = [
      ...new Set(bookings.map((booking) => booking.user_id)),
    ];

    if (uniqueUserIds.length === 0) {
      return {
        count: 0,
        items: [] as ManagedBookingRecord[],
      };
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .in('id', uniqueUserIds)
      .returns<UserSummaryRecord[]>();

    if (usersError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch booking user summaries from Supabase',
        details: usersError.message,
      });
    }

    const userLookup = new Map(users.map((user) => [user.id, user] as const));

    return {
      count: bookings.length,
      items: bookings.map((booking) => {
        const matchedUser = userLookup.get(booking.user_id);

        return {
          ...booking,
          user_email: matchedUser?.email ?? null,
          user_full_name: matchedUser?.full_name ?? null,
        };
      }),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateBookingDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException(
        'startTime and endTime must be valid ISO datetimes',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    const now = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    if (startTime.getTime() < now.getTime() + MIN_BOOKING_LEAD_TIME_MS) {
      throw new BadRequestException(
        `Bookings must be created at least ${MIN_BOOKING_LEAD_TIME_MINUTES} minutes before the start time`,
      );
    }

    if (startTime.getTime() > now.getTime() + MAX_BOOKING_ADVANCE_MS) {
      throw new BadRequestException(
        `Bookings can only be created up to ${MAX_BOOKING_ADVANCE_DAYS} days in advance`,
      );
    }

    if (durationMs < MIN_BOOKING_DURATION_MS) {
      throw new BadRequestException(
        `Booking duration must be at least ${MIN_BOOKING_DURATION_MINUTES} minutes`,
      );
    }

    if (durationMs > MAX_BOOKING_DURATION_MS) {
      throw new BadRequestException(
        `Booking duration must not exceed ${MAX_BOOKING_DURATION_HOURS} hours`,
      );
    }

    const workspace = await this.findWorkspaceById(dto.workspaceId);

    if (workspace.status !== 'available') {
      throw new BadRequestException('Only available workspaces can be booked');
    }

    const activeBookingCount = await this.countActiveBookingsForUser(
      user.id,
      now,
    );

    if (activeBookingCount >= MAX_ACTIVE_BOOKINGS_PER_USER) {
      throw new BadRequestException(
        `Users can only hold ${MAX_ACTIVE_BOOKINGS_PER_USER} active bookings at the same time`,
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        user_id: user.id,
        workspace_id: dto.workspaceId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed',
      })
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .single<BookingRecord>();

    if (error || !data) {
      this.handleWriteError(error, 'Failed to create booking');
    }

    return data;
  }

  async findFloorState(dto: FloorBookingStateDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException(
        'startTime and endTime must be valid ISO datetimes',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: workspaces, error: workspacesError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('floor_id', dto.floorId)
      .returns<WorkspaceIdRecord[]>();

    if (workspacesError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch floor workspaces from Supabase',
        details: workspacesError.message,
      });
    }

    const workspaceIds = workspaces.map((workspace) => workspace.id);

    if (workspaceIds.length === 0) {
      return {
        count: 0,
        items: [] as BookingRecord[],
      };
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .in('workspace_id', workspaceIds)
      .in('status', ['confirmed', 'checked_in'])
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch floor booking state from Supabase',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data as BookingRecord[],
    };
  }

  async cancel(id: string, user: AuthenticatedUser, dto: CancelBookingDto) {
    const booking = await this.findBookingById(id);
    const canManageAnyBooking = ['admin', 'manager'].includes(user.role);

    if (!canManageAnyBooking && booking.user_id !== user.id) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (booking.status !== 'confirmed') {
      throw new BadRequestException('Only confirmed bookings can be cancelled');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: dto.cancelReason ?? null,
      })
      .eq('id', id)
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .single<BookingRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to cancel booking',
        details: error?.message,
      });
    }

    return data;
  }

  async runNoShow(dto: RunNoShowDto) {
    const effectiveAt = dto.effectiveAt
      ? new Date(dto.effectiveAt)
      : new Date();

    if (Number.isNaN(effectiveAt.getTime())) {
      throw new BadRequestException('effectiveAt must be a valid ISO datetime');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .eq('status', 'confirmed')
      .lte('start_time', effectiveAt.toISOString())
      .order('start_time', { ascending: true })
      .returns<BookingRecord[]>();

    if (fetchError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch no-show candidates',
        details: fetchError.message,
      });
    }

    const overdueCandidates = candidates.filter((booking) =>
      isCheckInWindowExpired(booking, effectiveAt),
    );

    if (overdueCandidates.length === 0) {
      return {
        effectiveAt: effectiveAt.toISOString(),
        count: 0,
        items: [] as BookingRecord[],
      };
    }

    const candidateIds = overdueCandidates.map((booking) => booking.id);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'no_show',
      })
      .in('id', candidateIds)
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .returns<BookingRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to update no-show bookings',
        details: error.message,
      });
    }

    return {
      effectiveAt: effectiveAt.toISOString(),
      count: data.length,
      items: data,
    };
  }

  async runCompleted(dto: RunCompletionDto) {
    const effectiveAt = dto.effectiveAt
      ? new Date(dto.effectiveAt)
      : new Date();

    if (Number.isNaN(effectiveAt.getTime())) {
      throw new BadRequestException('effectiveAt must be a valid ISO datetime');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .eq('status', 'checked_in')
      .lt('end_time', effectiveAt.toISOString())
      .order('end_time', { ascending: true })
      .returns<BookingRecord[]>();

    if (fetchError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch completion candidates',
        details: fetchError.message,
      });
    }

    if (candidates.length === 0) {
      return {
        effectiveAt: effectiveAt.toISOString(),
        count: 0,
        items: [] as BookingRecord[],
      };
    }

    const candidateIds = candidates.map((booking) => booking.id);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'completed',
      })
      .in('id', candidateIds)
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .returns<BookingRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to update completed bookings',
        details: error.message,
      });
    }

    return {
      effectiveAt: effectiveAt.toISOString(),
      count: data.length,
      items: data,
    };
  }

  private async findWorkspaceById(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, status')
      .eq('id', id)
      .single<WorkspaceStatusRecord>();

    if (error || !data) {
      throw new NotFoundException('Workspace not found');
    }

    return data;
  }

  private async findBookingById(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .eq('id', id)
      .single<BookingRecord>();

    if (error || !data) {
      throw new NotFoundException('Booking not found');
    }

    return data;
  }

  private async countActiveBookingsForUser(userId: string, now: Date) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'checked_in'])
      .gt('end_time', now.toISOString())
      .returns<WorkspaceIdRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch active user bookings from Supabase',
        details: error.message,
      });
    }

    return data.length;
  }

  private handleWriteError(
    error: {
      code?: string;
      message: string;
    } | null,
    fallbackMessage: string,
  ): never {
    if (error?.code === '23P01') {
      throw new ConflictException(
        'Workspace is already booked for the selected time range',
      );
    }

    if (error?.code === '23503') {
      throw new BadRequestException(
        'Referenced workspace or user does not exist',
      );
    }

    if (error?.code === '23514') {
      throw new BadRequestException('Booking time range is invalid');
    }

    throw new InternalServerErrorException({
      message: fallbackMessage,
      details: error?.message,
    });
  }
}
