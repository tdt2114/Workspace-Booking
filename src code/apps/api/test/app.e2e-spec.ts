/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { SupabaseAuthGuard } from './../src/auth/supabase-auth.guard';
import { BookingsService } from './../src/bookings/bookings.service';

type TestUser = {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  fullName: string;
};

const USERS_BY_TOKEN: Record<string, TestUser> = {
  'admin-token': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@demo.com',
    role: 'admin',
    fullName: 'Admin Demo',
  },
  'manager-token': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'manager@demo.com',
    role: 'manager',
    fullName: 'Manager Demo',
  },
  'employee-token': {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'employee@demo.com',
    role: 'employee',
    fullName: 'Employee Demo',
  },
};

const authGuardMock = {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: TestUser;
    }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const user = USERS_BY_TOKEN[token];

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = user;

    return true;
  },
};

describe('API booking flows (e2e)', () => {
  let app: INestApplication;
  let bookingsServiceMock: {
    findMine: jest.Mock;
    findManageable: jest.Mock;
    findFloorState: jest.Mock;
    create: jest.Mock;
    cancel: jest.Mock;
    runNoShow: jest.Mock;
    runCompleted: jest.Mock;
  };

  beforeEach(async () => {
    process.env.BOOKINGS_LIFECYCLE_ENABLED = 'false';

    bookingsServiceMock = {
      findMine: jest.fn(),
      findManageable: jest.fn(),
      findFloorState: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
      runNoShow: jest.fn(),
      runCompleted: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BookingsService)
      .useValue(bookingsServiceMock)
      .overrideGuard(SupabaseAuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns service status', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ok',
      service: 'api',
    });
  });

  it('GET /bookings/my returns the current user bookings', async () => {
    bookingsServiceMock.findMine.mockResolvedValue({
      count: 1,
      items: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'confirmed',
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/bookings/my')
      .set('Authorization', 'Bearer employee-token')
      .expect(200);

    expect(bookingsServiceMock.findMine).toHaveBeenCalledWith(
      USERS_BY_TOKEN['employee-token'].id,
    );
    expect(response.body).toEqual({
      count: 1,
      items: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          status: 'confirmed',
        },
      ],
    });
  });

  it('POST /bookings creates a booking for the authenticated user', async () => {
    bookingsServiceMock.create.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspace_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      status: 'confirmed',
    });

    const payload = {
      workspaceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      startTime: '2026-04-22T09:00:00.000Z',
      endTime: '2026-04-22T11:00:00.000Z',
    };

    const response = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', 'Bearer employee-token')
      .send(payload)
      .expect(201);

    expect(bookingsServiceMock.create).toHaveBeenCalledWith(
      USERS_BY_TOKEN['employee-token'],
      payload,
    );
    expect(response.body).toEqual({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      workspace_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      status: 'confirmed',
    });
  });

  it('PATCH /bookings/:id/cancel cancels a confirmed booking', async () => {
    bookingsServiceMock.cancel.mockResolvedValue({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      status: 'cancelled',
      cancel_reason: 'Need another desk',
    });

    const bookingId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const payload = {
      cancelReason: 'Need another desk',
    };

    const response = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set('Authorization', 'Bearer employee-token')
      .send(payload)
      .expect(200);

    expect(bookingsServiceMock.cancel).toHaveBeenCalledWith(
      bookingId,
      USERS_BY_TOKEN['employee-token'],
      payload,
    );
    expect(response.body).toEqual({
      id: bookingId,
      status: 'cancelled',
      cancel_reason: 'Need another desk',
    });
  });

  it('GET /bookings/manage is available for manager users', async () => {
    bookingsServiceMock.findManageable.mockResolvedValue({
      count: 2,
      items: [
        { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', status: 'confirmed' },
        { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', status: 'checked_in' },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/bookings/manage')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);

    expect(bookingsServiceMock.findManageable).toHaveBeenCalledTimes(1);
    expect(response.body.count).toBe(2);
  });

  it('POST /bookings/run-no-show rejects employee users', async () => {
    await request(app.getHttpServer())
      .post('/bookings/run-no-show')
      .set('Authorization', 'Bearer employee-token')
      .send({
        effectiveAt: '2026-04-22T12:00:00.000Z',
      })
      .expect(403);

    expect(bookingsServiceMock.runNoShow).not.toHaveBeenCalled();
  });

  it('POST /bookings/run-no-show works for manager users', async () => {
    bookingsServiceMock.runNoShow.mockResolvedValue({
      effectiveAt: '2026-04-22T12:00:00.000Z',
      count: 1,
      items: [
        { id: '99999999-9999-9999-9999-999999999999', status: 'no_show' },
      ],
    });

    const payload = {
      effectiveAt: '2026-04-22T12:00:00.000Z',
    };

    const response = await request(app.getHttpServer())
      .post('/bookings/run-no-show')
      .set('Authorization', 'Bearer manager-token')
      .send(payload)
      .expect(201);

    expect(bookingsServiceMock.runNoShow).toHaveBeenCalledWith(payload);
    expect(response.body.count).toBe(1);
  });

  it('POST /bookings/run-completed works for admin users', async () => {
    bookingsServiceMock.runCompleted.mockResolvedValue({
      effectiveAt: '2026-04-22T18:00:00.000Z',
      count: 1,
      items: [
        {
          id: 'abababab-abab-abab-abab-abababababab',
          status: 'completed',
        },
      ],
    });

    const payload = {
      effectiveAt: '2026-04-22T18:00:00.000Z',
    };

    const response = await request(app.getHttpServer())
      .post('/bookings/run-completed')
      .set('Authorization', 'Bearer admin-token')
      .send(payload)
      .expect(201);

    expect(bookingsServiceMock.runCompleted).toHaveBeenCalledWith(payload);
    expect(response.body.items[0].status).toBe('completed');
  });
});
