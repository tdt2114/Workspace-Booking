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
  approval_status?: string;
  owner_id?: string | null;
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

type FloorStateBookingRecord = Pick<
  BookingRecord,
  'id' | 'workspace_id' | 'start_time' | 'end_time' | 'status'
> & {
  user_email?: string | null;
  user_full_name?: string | null;
};

type AnalyticsWorkspaceRecord = {
  id: string;
  floor_id: string;
  name: string;
  status: string;
};

type AnalyticsFloorRecord = {
  id: string;
  building_id: string;
  floor_number: number;
  name: string | null;
};

type AnalyticsBuildingRecord = {
  id: string;
  name: string;
};

type BookingVolumeBucket = {
  periodStart: string;
  label: string;
  count: number;
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

  async findManageable(user: AuthenticatedUser) {
    const supabaseAdmin = getSupabaseAdmin();

    let ownedWorkspaceIds: string[] | null = null;

    if (user.role === 'space_owner') {
      const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .returns<WorkspaceIdRecord[]>();

      if (ownedError) {
        throw new InternalServerErrorException({
          message: 'Failed to fetch owner workspaces from Supabase',
          details: ownedError.message,
        });
      }

      ownedWorkspaceIds = ownedWorkspaces.map((workspace) => workspace.id);

      if (ownedWorkspaceIds.length === 0) {
        return {
          count: 0,
          items: [] as ManagedBookingRecord[],
        };
      }
    }

    let query = supabaseAdmin
      .from('bookings')
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .order('start_time', { ascending: false });

    if (ownedWorkspaceIds) {
      query = query.in('workspace_id', ownedWorkspaceIds);
    }

    const { data, error } = await query;

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

  async getAnalytics() {
    const supabaseAdmin = getSupabaseAdmin();
    const [
      { data: bookings, error: bookingsError },
      { data: workspaces, error: workspacesError },
      { data: floors, error: floorsError },
      { data: buildings, error: buildingsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('bookings')
        .select(
          'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
        )
        .returns<BookingRecord[]>(),
      supabaseAdmin
        .from('workspaces')
        .select('id, floor_id, name, status')
        .returns<AnalyticsWorkspaceRecord[]>(),
      supabaseAdmin
        .from('floors')
        .select('id, building_id, floor_number, name')
        .returns<AnalyticsFloorRecord[]>(),
      supabaseAdmin
        .from('buildings')
        .select('id, name')
        .returns<AnalyticsBuildingRecord[]>(),
    ]);

    if (bookingsError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch booking analytics from Supabase',
        details: bookingsError.message,
      });
    }

    if (workspacesError || floorsError || buildingsError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch workspace analytics metadata from Supabase',
        details:
          workspacesError?.message ??
          floorsError?.message ??
          buildingsError?.message,
      });
    }

    const now = Date.now();
    const workspaceLookup = new Map(
      workspaces.map((workspace) => [workspace.id, workspace] as const),
    );
    const floorLookup = new Map(floors.map((floor) => [floor.id, floor]));
    const buildingLookup = new Map(
      buildings.map((building) => [building.id, building]),
    );

    const isCurrentBooking = (booking: BookingRecord) => {
      const start = new Date(booking.start_time).getTime();
      const end = new Date(booking.end_time).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= now) {
        return false;
      }

      if (booking.status === 'checked_in') {
        return true;
      }

      return booking.status === 'confirmed' && start <= now;
    };

    const currentBookings = bookings.filter(isCurrentBooking);
    const currentWorkspaceIds = new Set(
      currentBookings.map((booking) => booking.workspace_id),
    );
    const activeWorkspaces = workspaces.filter(
      (workspace) => workspace.status === 'available',
    );
    const availableNow = activeWorkspaces.filter(
      (workspace) => !currentWorkspaceIds.has(workspace.id),
    );
    const bookingStatusCounts = bookings.reduce<Record<string, number>>(
      (counts, booking) => {
        counts[booking.status] = (counts[booking.status] ?? 0) + 1;
        return counts;
      },
      {},
    );
    const upcomingCount = bookings.filter((booking) => {
      const start = new Date(booking.start_time).getTime();
      return (
        booking.status === 'confirmed' && Number.isFinite(start) && start > now
      );
    }).length;
    const activeConfirmedCount = bookings.filter((booking) => {
      const start = new Date(booking.start_time).getTime();
      const end = new Date(booking.end_time).getTime();
      return (
        booking.status === 'confirmed' &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= now &&
        end > now
      );
    }).length;
    const checkedInCount = currentBookings.filter(
      (booking) => booking.status === 'checked_in',
    ).length;
    const workspaceBookingCounts = bookings.reduce<Map<string, number>>(
      (counts, booking) => {
        counts.set(
          booking.workspace_id,
          (counts.get(booking.workspace_id) ?? 0) + 1,
        );
        return counts;
      },
      new Map<string, number>(),
    );
    const topWorkspaces = [...workspaceBookingCounts.entries()]
      .map(([workspaceId, bookingCount]) => {
        const workspace = workspaceLookup.get(workspaceId);
        const floor = workspace ? floorLookup.get(workspace.floor_id) : null;
        const building = floor ? buildingLookup.get(floor.building_id) : null;

        return {
          workspaceId,
          workspaceName: workspace?.name ?? 'Unknown workspace',
          floorName:
            floor?.name ??
            (floor ? `Floor ${floor.floor_number}` : 'Unknown floor'),
          buildingName: building?.name ?? 'Unknown building',
          bookingCount,
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 5);
    const floorUtilization = floors
      .map((floor) => {
        const floorWorkspaces = workspaces.filter(
          (workspace) => workspace.floor_id === floor.id,
        );
        const currentFloorBookings = currentBookings.filter((booking) =>
          floorWorkspaces.some(
            (workspace) => workspace.id === booking.workspace_id,
          ),
        );
        const building = buildingLookup.get(floor.building_id);

        return {
          floorId: floor.id,
          floorName: floor.name ?? `Floor ${floor.floor_number}`,
          buildingName: building?.name ?? 'Unknown building',
          workspaceCount: floorWorkspaces.length,
          occupiedCount: currentFloorBookings.length,
          utilizationRate: floorWorkspaces.length
            ? Math.round(
                (currentFloorBookings.length / floorWorkspaces.length) * 100,
              )
            : 0,
        };
      })
      .sort((a, b) => b.utilizationRate - a.utilizationRate);
    const bookingVolume = this.buildBookingVolume(bookings, now);

    return {
      generatedAt: new Date(now).toISOString(),
      summary: {
        totalBookings: bookings.length,
        upcomingBookings: upcomingCount,
        activeBookings: activeConfirmedCount + checkedInCount,
        checkedInBookings: checkedInCount,
        completedBookings: bookingStatusCounts.completed ?? 0,
        cancelledBookings: bookingStatusCounts.cancelled ?? 0,
        noShowBookings: bookingStatusCounts.no_show ?? 0,
        totalWorkspaces: workspaces.length,
        availableWorkspaces: availableNow.length,
        unavailableWorkspaces: workspaces.length - availableNow.length,
        occupancyRate: workspaces.length
          ? Math.round((currentWorkspaceIds.size / workspaces.length) * 100)
          : 0,
        noShowRate: bookings.length
          ? Math.round(
              ((bookingStatusCounts.no_show ?? 0) / bookings.length) * 100,
            )
          : 0,
      },
      statusCounts: {
        confirmed: bookingStatusCounts.confirmed ?? 0,
        checkedIn: bookingStatusCounts.checked_in ?? 0,
        completed: bookingStatusCounts.completed ?? 0,
        cancelled: bookingStatusCounts.cancelled ?? 0,
        noShow: bookingStatusCounts.no_show ?? 0,
      },
      topWorkspaces,
      floorUtilization,
      bookingVolume,
    };
  }

  private buildBookingVolume(bookings: BookingRecord[], now: number) {
    return {
      daily: this.buildDailyBookingVolume(bookings, now),
      weekly: this.buildWeeklyBookingVolume(bookings, now),
    };
  }

  private buildDailyBookingVolume(
    bookings: BookingRecord[],
    now: number,
  ): BookingVolumeBucket[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = this.startOfUtcDay(new Date(now)).getTime();

    return Array.from({ length: 7 }, (_, index) => {
      const periodStartMs = todayStart - (6 - index) * dayMs;
      const periodEndMs = periodStartMs + dayMs;
      const periodStart = new Date(periodStartMs);
      const count = bookings.filter((booking) => {
        const start = new Date(booking.start_time).getTime();
        return (
          Number.isFinite(start) &&
          start >= periodStartMs &&
          start < periodEndMs
        );
      }).length;

      return {
        periodStart: periodStart.toISOString(),
        label: periodStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        count,
      };
    });
  }

  private buildWeeklyBookingVolume(
    bookings: BookingRecord[],
    now: number,
  ): BookingVolumeBucket[] {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const currentWeekStart = this.startOfUtcWeek(new Date(now)).getTime();

    return Array.from({ length: 6 }, (_, index) => {
      const periodStartMs = currentWeekStart - (5 - index) * weekMs;
      const periodEndMs = periodStartMs + weekMs;
      const periodStart = new Date(periodStartMs);
      const count = bookings.filter((booking) => {
        const start = new Date(booking.start_time).getTime();
        return (
          Number.isFinite(start) &&
          start >= periodStartMs &&
          start < periodEndMs
        );
      }).length;

      return {
        periodStart: periodStart.toISOString(),
        label: `Week of ${periodStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        })}`,
        count,
      };
    });
  }

  private startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private startOfUtcWeek(date: Date) {
    const dayStart = this.startOfUtcDay(date);
    const day = dayStart.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    dayStart.setUTCDate(dayStart.getUTCDate() + mondayOffset);
    return dayStart;
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

    if (workspace.approval_status && workspace.approval_status !== 'approved') {
      throw new BadRequestException('Only approved workspaces can be booked');
    }

    await this.tryReleaseExpiredBookings(now);

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

  async findFloorState(dto: FloorBookingStateDto, user: AuthenticatedUser) {
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
        items: [] as FloorStateBookingRecord[],
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

    const bookings = data as BookingRecord[];
    const canSeeOccupantDetails = ['admin', 'space_owner'].includes(user.role);

    if (!canSeeOccupantDetails || bookings.length === 0) {
      return {
        count: bookings.length,
        items: bookings.map((booking) => ({
          id: booking.id,
          workspace_id: booking.workspace_id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
        })),
      };
    }

    const uniqueUserIds = [
      ...new Set(bookings.map((booking) => booking.user_id)),
    ];
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .in('id', uniqueUserIds)
      .returns<UserSummaryRecord[]>();

    if (usersError) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch floor occupant summaries from Supabase',
        details: usersError.message,
      });
    }

    const userLookup = new Map(users.map((item) => [item.id, item] as const));

    return {
      count: bookings.length,
      items: bookings.map((booking) => {
        const matchedUser = userLookup.get(booking.user_id);

        return {
          id: booking.id,
          workspace_id: booking.workspace_id,
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
          user_email: matchedUser?.email ?? null,
          user_full_name: matchedUser?.full_name ?? null,
        };
      }),
    };
  }

  async cancel(id: string, user: AuthenticatedUser, dto: CancelBookingDto) {
    const booking = await this.findBookingById(id);
    const canManageAnyBooking = user.role === 'admin';

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

  async release(id: string, user: AuthenticatedUser) {
    const booking = await this.findBookingById(id);
    const canManageAnyBooking = user.role === 'admin';

    if (!canManageAnyBooking && booking.user_id !== user.id) {
      throw new ForbiddenException('You can only release your own bookings');
    }

    if (booking.status !== 'checked_in') {
      throw new BadRequestException('Only checked-in bookings can be released');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'completed',
      })
      .eq('id', id)
      .select(
        'id, user_id, workspace_id, start_time, end_time, status, checked_in_at, cancelled_at, cancel_reason, created_at',
      )
      .single<BookingRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to release booking',
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
      .select('id, name, status, approval_status, owner_id')
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

  private async releaseExpiredBookings(effectiveAt: Date) {
    const lifecycleDto = {
      effectiveAt: effectiveAt.toISOString(),
    };

    await this.runNoShow(lifecycleDto);
    await this.runCompleted(lifecycleDto);
  }

  private async tryReleaseExpiredBookings(effectiveAt: Date) {
    try {
      await this.releaseExpiredBookings(effectiveAt);
    } catch (error) {
      // Lifecycle cleanup is opportunistic before create; do not block booking
      // creation with a generic 500 if cleanup temporarily fails.
      console.warn('Booking lifecycle cleanup failed before create', error);
    }
  }

  private handleWriteError(
    error: {
      code?: string;
      message: string;
      details?: string;
      hint?: string;
    } | null,
    fallbackMessage: string,
  ): never {
    console.warn('Booking write failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

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
