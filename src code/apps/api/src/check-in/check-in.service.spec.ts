/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CheckInService } from './check-in.service';

jest.mock('../common/supabase.client', () => ({
  getSupabaseAdmin: jest.fn(),
}));

type MockResult<T> = {
  data: T;
  error: {
    code?: string;
    message: string;
  } | null;
};

function createQueryBuilder<T>(result: MockResult<T>) {
  const builder = {
    data: result.data,
    error: result.error,
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    order: jest.fn(() => builder),
    update: jest.fn(() => builder),
    returns: jest.fn(() => ({
      data: result.data,
      error: result.error,
    })),
    single: jest.fn(() => ({
      data: result.data,
      error: result.error,
    })),
  };

  return builder;
}

describe('CheckInService', () => {
  const mockedGetSupabaseAdmin = jest.mocked(getSupabaseAdmin);
  let service: CheckInService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckInService();
  });

  it('allows check-in exactly 15 minutes before the booking start', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T11:00:00.000Z',
          status: 'confirmed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'checked_in',
        checked_in_at: '2026-04-22T08:45:00.000Z',
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder)
      .mockReturnValueOnce(updateBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    const result = await service.scan(user, {
      qrCodeValue: 'desk_a_01',
      scannedAt: '2026-04-22T08:45:00.000Z',
    });

    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.booking.status).toBe('checked_in');
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'checked_in',
      checked_in_at: '2026-04-22T08:45:00.000Z',
    });
  });

  it('rejects check-in earlier than 15 minutes before start', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T11:00:00.000Z',
          status: 'confirmed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    await expect(
      service.scan(user, {
        qrCodeValue: 'desk_a_01',
        scannedAt: '2026-04-22T08:44:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects check-in after the allowed late grace window', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T11:00:00.000Z',
          status: 'confirmed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    await expect(
      service.scan(user, {
        qrCodeValue: 'desk_a_01',
        scannedAt: '2026-04-22T09:31:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows check-in exactly at the late boundary when the grace window is capped at 30 minutes', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T11:00:00.000Z',
          status: 'confirmed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'checked_in',
        checked_in_at: '2026-04-22T09:30:00.000Z',
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder)
      .mockReturnValueOnce(updateBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    const result = await service.scan(user, {
      qrCodeValue: 'desk_a_01',
      scannedAt: '2026-04-22T09:30:00.000Z',
    });

    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.booking.status).toBe('checked_in');
  });

  it('allows check-in exactly at the late boundary when the grace window is 1/4 of the booking duration', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T10:00:00.000Z',
          status: 'confirmed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T10:00:00.000Z',
        status: 'checked_in',
        checked_in_at: '2026-04-22T09:15:00.000Z',
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder)
      .mockReturnValueOnce(updateBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    const result = await service.scan(user, {
      qrCodeValue: 'desk_a_01',
      scannedAt: '2026-04-22T09:15:00.000Z',
    });

    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.booking.status).toBe('checked_in');
  });

  it('returns the existing booking when it is already checked in', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        floor_id: 'floor-1',
        name: 'Desk A-01',
        status: 'available',
        svg_element_id: 'desk_a_01',
        qr_code_value: 'desk_a_01',
      },
      error: null,
    });
    const candidateBookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-04-22T09:00:00.000Z',
          end_time: '2026-04-22T11:00:00.000Z',
          status: 'checked_in',
          checked_in_at: '2026-04-22T09:05:00.000Z',
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-04-22T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(candidateBookingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User',
    };

    const result = await service.scan(user, {
      qrCodeValue: 'desk_a_01',
      scannedAt: '2026-04-22T09:10:00.000Z',
    });

    expect(result.alreadyCheckedIn).toBe(true);
    expect(result.message).toContain('already');
  });
});
