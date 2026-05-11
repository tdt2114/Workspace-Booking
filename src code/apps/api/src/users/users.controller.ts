import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post('admin')
  createAdmin(@Body() dto: CreateAdminUserDto) {
    return this.usersService.createAdmin(dto);
  }
}
