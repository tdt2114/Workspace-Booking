import { Module } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
