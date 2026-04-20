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
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { FloorBookingStateDto } from './dto/floor-booking-state.dto';

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

    const workspace = await this.findWorkspaceById(dto.workspaceId);

    if (workspace.status !== 'available') {
      throw new BadRequestException('Only available workspaces can be booked');
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
