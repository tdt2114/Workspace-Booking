import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { BuildingsModule } from './buildings/buildings.module';
import { CheckInModule } from './check-in/check-in.module';
import { FloorsModule } from './floors/floors.module';
import { SpaceOwnerRequestsModule } from './space-owner-requests/space-owner-requests.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    AuthModule,
    BuildingsModule,
    FloorsModule,
    WorkspacesModule,
    BookingsModule,
    CheckInModule,
    SpaceOwnerRequestsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
