import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';

type UserRecord = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'space_owner' | 'admin';
  created_at: string;
};

@Injectable()
export class UsersService {
  async findAll() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .returns<UserRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch users',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data,
    };
  }

  async createAdmin(dto: CreateAdminUserDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        full_name: dto.fullName ?? '',
      },
    });

    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? 'Failed to create account',
      );
    }

    const targetRole = dto.role === 'space_owner' ? 'space_owner' : 'admin';

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: data.user.id,
        email: dto.email,
        full_name: dto.fullName ?? '',
        role: targetRole,
      })
      .select('id, email, full_name, role, created_at')
      .single<UserRecord>();

    if (profileError || !profile) {
      throw new InternalServerErrorException({
        message: 'Auth user was created, but profile role update failed',
        details: profileError?.message,
      });
    }

    return profile;
  }
}
