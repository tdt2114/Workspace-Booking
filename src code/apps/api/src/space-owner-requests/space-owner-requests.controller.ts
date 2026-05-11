import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateSpaceOwnerRequestDto } from './dto/create-space-owner-request.dto';
import { ReviewSpaceOwnerRequestDto } from './dto/review-space-owner-request.dto';
import { SpaceOwnerRequestsService } from './space-owner-requests.service';

@Controller('space-owner-requests')
@UseGuards(SupabaseAuthGuard)
export class SpaceOwnerRequestsController {
  constructor(private readonly requestsService: SpaceOwnerRequestsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.findMine(user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('user')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSpaceOwnerRequestDto,
  ) {
    return this.requestsService.create(user, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.requestsService.findAll();
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles('admin')
  review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewSpaceOwnerRequestDto,
  ) {
    return this.requestsService.review(id, user, dto);
  }
}
