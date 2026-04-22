import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getSupabaseAdmin } from '../common/supabase.client';
import type { AuthenticatedUser } from './auth.types';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

type UserProfileRecord = {
  id: string;
  email: string | null;
  role: string;
  full_name: string | null;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', authUser.id)
      .single<UserProfileRecord>();

    if (profileError || !profile) {
      throw new UnauthorizedException('User profile not found');
    }

    request.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name,
    };

    return true;
  }
}
