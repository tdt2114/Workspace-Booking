import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateSpaceOwnerRequestDto } from './dto/create-space-owner-request.dto';
import { ReviewSpaceOwnerRequestDto } from './dto/review-space-owner-request.dto';

type SpaceOwnerRequestRecord = {
  id: string;
  user_id: string;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  message: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at?: string;
};

const REQUEST_SELECT_FIELDS =
  'id, user_id, status, message, review_note, reviewed_by, reviewed_at, created_at, updated_at';

@Injectable()
export class SpaceOwnerRequestsService {
  async findMine(user: AuthenticatedUser) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('space_owner_requests')
      .select(REQUEST_SELECT_FIELDS)
      .eq('user_id', user.id)
      .maybeSingle<SpaceOwnerRequestRecord>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch space owner request',
        details: error.message,
      });
    }

    return data ?? { status: 'none', user_id: user.id };
  }

  async findAll() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('space_owner_requests')
      .select(REQUEST_SELECT_FIELDS)
      .order('created_at', { ascending: false })
      .returns<SpaceOwnerRequestRecord[]>();

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch space owner requests',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data,
    };
  }

  async create(user: AuthenticatedUser, dto: CreateSpaceOwnerRequestDto) {
    if (user.role !== 'user') {
      throw new BadRequestException(
        'Only regular users can request space owner access',
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('space_owner_requests')
      .upsert(
        {
          user_id: user.id,
          status: 'pending',
          message: dto.message ?? null,
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
        },
        { onConflict: 'user_id' },
      )
      .select(REQUEST_SELECT_FIELDS)
      .single<SpaceOwnerRequestRecord>();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException('A space owner request already exists');
      }

      throw new InternalServerErrorException({
        message: 'Failed to create space owner request',
        details: error?.message,
      });
    }

    return data;
  }

  async review(
    id: string,
    admin: AuthenticatedUser,
    dto: ReviewSpaceOwnerRequestDto,
  ) {
    const supabaseAdmin = getSupabaseAdmin();
    const existing = await this.findById(id);

    if (existing.user_id === admin.id) {
      throw new BadRequestException(
        'Admins cannot approve their own owner request',
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('space_owner_requests')
      .update({
        status: dto.status,
        review_note: dto.reviewNote ?? null,
        reviewed_by: admin.id,
        reviewed_at: now,
      })
      .eq('id', id)
      .select(REQUEST_SELECT_FIELDS)
      .single<SpaceOwnerRequestRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to review space owner request',
        details: error?.message,
      });
    }

    if (dto.status === 'approved') {
      const { error: userError } = await supabaseAdmin
        .from('users')
        .update({ role: 'space_owner' })
        .eq('id', existing.user_id);

      if (userError) {
        throw new InternalServerErrorException({
          message: 'Request approved but failed to update user role',
          details: userError.message,
        });
      }
    }

    return data;
  }

  private async findById(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('space_owner_requests')
      .select(REQUEST_SELECT_FIELDS)
      .eq('id', id)
      .single<SpaceOwnerRequestRecord>();

    if (error || !data) {
      throw new NotFoundException('Space owner request not found');
    }

    return data;
  }
}
