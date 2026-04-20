import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { CurrentUser } from './auth/current-user.decorator';
import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import type { AuthenticatedUser } from './auth/auth.types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('admin/ping')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminPing(@CurrentUser() user: AuthenticatedUser) {
    return {
      ok: true,
      message: 'Admin route is accessible',
      user,
    };
  }
}
