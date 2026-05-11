import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpaceOwnerRequestsController } from './space-owner-requests.controller';
import { SpaceOwnerRequestsService } from './space-owner-requests.service';

@Module({
  imports: [AuthModule],
  controllers: [SpaceOwnerRequestsController],
  providers: [SpaceOwnerRequestsService],
})
export class SpaceOwnerRequestsModule {}
