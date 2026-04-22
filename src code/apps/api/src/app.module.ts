import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { BuildingsModule } from './buildings/buildings.module';
import { CheckInModule } from './check-in/check-in.module';
import { FloorsModule } from './floors/floors.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    AuthModule,
    BuildingsModule,
    FloorsModule,
    WorkspacesModule,
    BookingsModule,
    CheckInModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
