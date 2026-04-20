import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { BuildingsModule } from './buildings/buildings.module';
import { FloorsModule } from './floors/floors.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    AuthModule,
    BuildingsModule,
    FloorsModule,
    WorkspacesModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
