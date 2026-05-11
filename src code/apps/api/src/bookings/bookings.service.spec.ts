/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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

function createEmptyLifecycleBuilders() {
  return [
    createQueryBuilder({
      data: [],
      error: null,
    }),
    createQueryBuilder({
      data: [],
      error: null,
    }),
  ] as const;
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
    const [noShowCandidatesBuilder, completedCandidatesBuilder] =
      createEmptyLifecycleBuilders();
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
      .mockReturnValueOnce(noShowCandidatesBuilder)
      .mockReturnValueOnce(completedCandidatesBuilder)
      .mockReturnValueOnce(activeBookingsBuilder)
      .mockReturnValueOnce(createBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
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
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(10),
        endTime: isoMinutesFromNow(70),
      }),
    ).rejects.toThrow(
      'Bookings must be created at least 15 minutes before the start time',
    );
  });

  it('rejects bookings that start more than 7 days in advance', async () => {
    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
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
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
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
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
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
    const [noShowCandidatesBuilder, completedCandidatesBuilder] =
      createEmptyLifecycleBuilders();
    const activeBookingsBuilder = createQueryBuilder({
      data: [{ id: 'booking-1' }, { id: 'booking-2' }],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(noShowCandidatesBuilder)
      .mockReturnValueOnce(completedCandidatesBuilder)
      .mockReturnValueOnce(activeBookingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    await expect(
      service.create(user, {
        workspaceId: 'workspace-1',
        startTime: isoMinutesFromNow(180),
        endTime: isoMinutesFromNow(240),
      }),
    ).rejects.toThrow('Users can only hold 2 active bookings at the same time');
  });

  it('releases expired bookings before checking the active booking quota', async () => {
    const startTime = isoMinutesFromNow(180);
    const endTime = isoMinutesFromNow(240);
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-1',
        name: 'Desk A-01',
        status: 'available',
      },
      error: null,
    });
    const expiredConfirmedBooking = {
      id: 'booking-no-show',
      user_id: 'user-1',
      workspace_id: 'workspace-2',
      start_time: '2026-04-22T09:00:00.000Z',
      end_time: '2026-04-22T11:00:00.000Z',
      status: 'confirmed',
      checked_in_at: null,
      cancelled_at: null,
      cancel_reason: null,
      created_at: '2026-04-22T08:00:00.000Z',
    };
    const overdueCheckedInBooking = {
      id: 'booking-completed',
      user_id: 'user-1',
      workspace_id: 'workspace-3',
      start_time: '2026-04-22T09:00:00.000Z',
      end_time: '2026-04-22T11:00:00.000Z',
      status: 'checked_in',
      checked_in_at: '2026-04-22T09:05:00.000Z',
      cancelled_at: null,
      cancel_reason: null,
      created_at: '2026-04-22T08:00:00.000Z',
    };
    const noShowFetchBuilder = createQueryBuilder({
      data: [expiredConfirmedBooking],
      error: null,
    });
    const noShowUpdateBuilder = createQueryBuilder({
      data: [{ ...expiredConfirmedBooking, status: 'no_show' }],
      error: null,
    });
    const completedFetchBuilder = createQueryBuilder({
      data: [overdueCheckedInBooking],
      error: null,
    });
    const completedUpdateBuilder = createQueryBuilder({
      data: [{ ...overdueCheckedInBooking, status: 'completed' }],
      error: null,
    });
    const activeBookingsBuilder = createQueryBuilder({
      data: [],
      error: null,
    });
    const createBuilder = createQueryBuilder({
      data: {
        id: 'booking-new',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed',
        checked_in_at: null,
        cancelled_at: null,
        cancel_reason: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(noShowFetchBuilder)
      .mockReturnValueOnce(noShowUpdateBuilder)
      .mockReturnValueOnce(completedFetchBuilder)
      .mockReturnValueOnce(completedUpdateBuilder)
      .mockReturnValueOnce(activeBookingsBuilder)
      .mockReturnValueOnce(createBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    const result = await service.create(user, {
      workspaceId: 'workspace-1',
      startTime,
      endTime,
    });

    expect(result.status).toBe('confirmed');
    expect(noShowUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'no_show',
    });
    expect(completedUpdateBuilder.update).toHaveBeenCalledWith({
      status: 'completed',
    });
    expect(activeBookingsBuilder.gt).toHaveBeenCalled();
  });

  it('returns daily and weekly booking volume in analytics', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));

    const bookingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'booking-1',
          user_id: 'user-1',
          workspace_id: 'workspace-1',
          start_time: '2026-05-08T09:00:00.000Z',
          end_time: '2026-05-08T10:00:00.000Z',
          status: 'completed',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-05-08T08:00:00.000Z',
        },
        {
          id: 'booking-2',
          user_id: 'user-2',
          workspace_id: 'workspace-1',
          start_time: '2026-05-07T09:00:00.000Z',
          end_time: '2026-05-07T10:00:00.000Z',
          status: 'no_show',
          checked_in_at: null,
          cancelled_at: null,
          cancel_reason: null,
          created_at: '2026-05-07T08:00:00.000Z',
        },
      ],
      error: null,
    });
    const workspacesBuilder = createQueryBuilder({
      data: [
        {
          id: 'workspace-1',
          floor_id: 'floor-1',
          name: 'Desk A-01',
          status: 'available',
        },
      ],
      error: null,
    });
    const floorsBuilder = createQueryBuilder({
      data: [
        {
          id: 'floor-1',
          building_id: 'building-1',
          floor_number: 1,
          name: 'floor A',
        },
      ],
      error: null,
    });
    const buildingsBuilder = createQueryBuilder({
      data: [
        {
          id: 'building-1',
          name: 'Head Office',
        },
      ],
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(bookingsBuilder)
      .mockReturnValueOnce(workspacesBuilder)
      .mockReturnValueOnce(floorsBuilder)
      .mockReturnValueOnce(buildingsBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const result = await service.getAnalytics();

    expect(result.bookingVolume.daily).toHaveLength(7);
    expect(result.bookingVolume.weekly).toHaveLength(6);
    expect(result.bookingVolume.daily.at(-1)).toMatchObject({
      periodStart: '2026-05-08T00:00:00.000Z',
      count: 1,
    });
    expect(result.bookingVolume.daily.at(-2)).toMatchObject({
      periodStart: '2026-05-07T00:00:00.000Z',
      count: 1,
    });
    expect(result.bookingVolume.weekly.at(-1)?.count).toBe(2);

    jest.useRealTimers();
  });

  it('allows creating a booking for an available meeting room workspace', async () => {
    const startTime = isoMinutesFromNow(180);
    const endTime = isoMinutesFromNow(240);
    const workspaceBuilder = createQueryBuilder({
      data: {
        id: 'workspace-room-1',
        name: 'Meeting Room M-01',
        status: 'available',
        type: 'meeting_room',
      },
      error: null,
    });
    const [noShowCandidatesBuilder, completedCandidatesBuilder] =
      createEmptyLifecycleBuilders();
    const activeBookingsBuilder = createQueryBuilder({
      data: [],
      error: null,
    });
    const createBuilder = createQueryBuilder({
      data: {
        id: 'booking-room-1',
        user_id: 'user-1',
        workspace_id: 'workspace-room-1',
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed',
        checked_in_at: null,
        cancelled_at: null,
        cancel_reason: null,
        created_at: new Date().toISOString(),
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(workspaceBuilder)
      .mockReturnValueOnce(noShowCandidatesBuilder)
      .mockReturnValueOnce(completedCandidatesBuilder)
      .mockReturnValueOnce(activeBookingsBuilder)
      .mockReturnValueOnce(createBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    const result = await service.create(user, {
      workspaceId: 'workspace-room-1',
      startTime,
      endTime,
    });

    expect(result.status).toBe('confirmed');
    expect(createBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      workspace_id: 'workspace-room-1',
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
    });
  });

  it('blocks a user from cancelling another user booking', async () => {
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
      id: 'user-2',
      email: 'user2@demo.com',
      role: 'user',
      fullName: 'User Two',
    };

    await expect(service.cancel('booking-1', user, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows a user to release their own checked-in booking', async () => {
    const booking = {
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
    };
    const bookingBuilder = createQueryBuilder({
      data: booking,
      error: null,
    });
    const releaseBuilder = createQueryBuilder({
      data: {
        ...booking,
        status: 'completed',
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(bookingBuilder)
      .mockReturnValueOnce(releaseBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    const result = await service.release('booking-1', user);

    expect(result.status).toBe('completed');
    expect(releaseBuilder.update).toHaveBeenCalledWith({
      status: 'completed',
    });
  });

  it('blocks a user from releasing another user booking', async () => {
    const bookingBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'owner-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'checked_in',
        checked_in_at: '2026-04-22T09:05:00.000Z',
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
      id: 'user-2',
      email: 'user2@demo.com',
      role: 'user',
      fullName: 'User Two',
    };

    await expect(service.release('booking-1', user)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects releasing a booking that is not checked in', async () => {
    const bookingBuilder = createQueryBuilder({
      data: {
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
      error: null,
    });
    const fromMock = jest.fn().mockReturnValueOnce(bookingBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    await expect(service.release('booking-1', user)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects releasing the same booking twice', async () => {
    const checkedInBookingBuilder = createQueryBuilder({
      data: {
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
      error: null,
    });
    const completedBookingBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'completed',
        checked_in_at: '2026-04-22T09:05:00.000Z',
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const releaseBuilder = createQueryBuilder({
      data: {
        id: 'booking-1',
        user_id: 'user-1',
        workspace_id: 'workspace-1',
        start_time: '2026-04-22T09:00:00.000Z',
        end_time: '2026-04-22T11:00:00.000Z',
        status: 'completed',
        checked_in_at: '2026-04-22T09:05:00.000Z',
        cancelled_at: null,
        cancel_reason: null,
        created_at: '2026-04-22T08:00:00.000Z',
      },
      error: null,
    });
    const fromMock = jest
      .fn()
      .mockReturnValueOnce(checkedInBookingBuilder)
      .mockReturnValueOnce(releaseBuilder)
      .mockReturnValueOnce(completedBookingBuilder);

    mockedGetSupabaseAdmin.mockReturnValue({
      from: fromMock,
    } as never);

    const user: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@demo.com',
      role: 'user',
      fullName: 'User One',
    };

    const firstRelease = await service.release('booking-1', user);

    expect(firstRelease.status).toBe('completed');

    await expect(service.release('booking-1', user)).rejects.toThrow(
      BadRequestException,
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
