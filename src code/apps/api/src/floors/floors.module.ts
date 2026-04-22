import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';

@Module({
  imports: [AuthModule],
  controllers: [FloorsController],
  providers: [FloorsService],
})
export class FloorsModule {}
