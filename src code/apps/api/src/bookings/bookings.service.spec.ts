/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { BookingsService } from './bookings.service';

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
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => builder),
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

function isoMinutesFromNow(offsetMinutes: number) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

describe('BookingsService', () => {
  const mockedGetSupabaseAdmin = jest.mocked(getSupabaseAdmin);
  let service: BookingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsService();
  });

  it('throws a conflict exception when a booking overlaps an existing one', async () => {
    const startTime = isoMinutesFromNow(120);
    const endTime = isoMinutesFromNow(240);
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        name: 'Desk A-01',
        status: 'available',
      },
      error: null,
    });
    const activeBookingsBuilder = createQueryBuilder({
      data: [],
      error: null,
    });
    const createBuilder = createQueryBuilder<null>({
      data: null,
      error: {
        code: '23P01',
        message: 'range overlap',
      },
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(activeBookingsBuilder)
      .mockReturnValueOnce(createBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime,
        endTime,
      }),
    ).rejects.toThrow(ConflictException);

    expect(createBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
    });
  });

  it('rejects bookings that start earlier than the minimum lead time', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(10),
        endTime: isoMinutesFromNow(70),
      }),
    ).rejects.toThrow('Bookings must be created at least 15 minutes before the start time');
  });

  it('rejects bookings that start more than 7 days in advance', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(8 * 24 * 60),
        endTime: isoMinutesFromNow(8 * 24 * 60 + 60),
      }),
    ).rejects.toThrow('Bookings can only be created up to 7 days in advance');
  });

  it('rejects bookings shorter than 30 minutes', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(60),
        endTime: isoMinutesFromNow(80),
      }),
    ).rejects.toThrow('Booking duration must be at least 30 minutes');
  });

  it('rejects bookings longer than 8 hours', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(60),
        endTime: isoMinutesFromNow(60 + 9 * 60),
      }),
    ).rejects.toThrow('Booking duration must not exceed 8 hours');
  });

  it('rejects users who already hold 2 active bookings', async () => {
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        name: 'Desk A-01',
        status: 'available',
      },
      error: null,
    });
    const activeBookingsBuilder = createQueryBuilder({
      data: [{ id: 'booking-1' }, { id: 'booking-2' }],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(activeBookingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'employee@demo.com',
      role: 'employee',
      fullName: 'Employee One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(180),
        endTime: isoMinutesFromNow(240),
      }),
    ).rejects.toThrow('Users can only hold 2 active bookings at the same time');
  });

  it('blocks an employee from cancelling another user booking', async () => {
    const bookingBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'owner-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'confirmed',
        checked_in_at: null,
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const fromMock = jest.fn().mockReturnValueOnce(bookingBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'employee-2',
      email: 'employee2@demo.com',
      role: 'employee',
      fullName: 'Employee Two',
    };

    await expect(service.cancel('booking-1', user, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('marks confirmed bookings as no_show after the check-in window closes', async () => {
    const candidates = [
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
    ];
    const fetchBuilder = createQueryBuilder({
      data: candidates,
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: [
        {
          ...candidates[0],
          status: 'no_show',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const result = await service.runNoShow({
      effectiveAt: '2026-04-22T09:31:00.000Z',
    });

    expect(result.count).toBe(1);
    expect(result.items[0]?.status).toBe('no_show');
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'no_show',
    });
  });

  it('does not mark a booking as no_show while the check-in window is still open', async () => {
    const candidates = [
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
    ];
    const fetchBuilder = createQueryBuilder({
      data: candidates,
      error: null,
    });
    const fromMock = jest.fn().mockReturnValueOnce(fetchBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const result = await service.runNoShow({
      effectiveAt: '2026-04-22T09:30:00.000Z',
    });

    expect(result.count).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('marks overdue checked_in bookings as completed', async () => {
    const candidates = [
      {
        id: 'booking-2',
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
    ];
    const fetchBuilder = createQueryBuilder({
      data: candidates,
      error: null,
    });
    const updateBuilder = createQueryBuilder({
      data: [
        {
          ...candidates[0],
          status: 'completed',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(fetchBuilder)
      .mockReturnValueOnce(updateBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const result = await service.runCompleted({
      effectiveAt: '2026-04-22T12:00:00.000Z',
    });

    expect(result.count).toBe(1);
    expect(result.items[0]?.status).toBe('completed');
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'completed',
    });
  });
});
