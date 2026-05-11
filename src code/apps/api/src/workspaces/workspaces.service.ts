import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

type WorkspaceRecord = {
  id: string;
  floor_id: string;
  owner_id: string | null;
  name: string;
  type: string;
  status: string;
  approval_status: string;
  rejection_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  svg_element_id: string;
  qr_code_value: string;
  capacity: number;
  features: Record<string, unknown>;
};

const WORKSPACE_SELECT_FIELDS =
  'id, floor_id, owner_id, name, type, status, approval_status, rejection_reason, approved_by, approved_at, svg_element_id, qr_code_value, capacity, features';

@Injectable()
export class WorkspacesService {
  async findAll(user: AuthenticatedUser) {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('workspaces')
      .select(WORKSPACE_SELECT_FIELDS)
      .order('floor_id', { ascending: true })
      .order('name', { ascending: true });

    if (user.role === 'user') {
      query = query.eq('approval_status', 'approved');
    } else if (user.role === 'space_owner') {
      query = query.or(`approval_status.eq.approved,owner_id.eq.${user.id}`);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch workspaces from Supabase',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data as WorkspaceRecord[],
    };
  }

  async create(user: AuthenticatedUser, dto: CreateWorkspaceDto) {
    if (!['admin', 'space_owner'].includes(user.role)) {
      throw new ForbiddenException(
        'Only space owners or admins can create workspaces',
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    if (user.role === 'space_owner') {
      payload.owner_id = user.id;
      payload.approval_status =
        dto.approvalStatus === 'draft' ? 'draft' : 'pending_approval';
      payload.approved_by = null;
      payload.approved_at = null;
      payload.rejection_reason = null;
    } else if (!payload.approval_status) {
      payload.approval_status = 'approved';
      payload.approved_by = user.id;
      payload.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .insert(payload)
      .select(WORKSPACE_SELECT_FIELDS)
      .single<WorkspaceRecord>();

    if (error || !data) {
      this.handleWriteError(error, 'Failed to create workspace');
    }

    return data;
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateWorkspaceDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await this.findById(id);

    if (user.role !== 'admin' && workspace.owner_id !== user.id) {
      throw new ForbiddenException('You can only manage your own workspaces');
    }

    const payload = this.toDatabasePayload(dto);

    if (user.role === 'space_owner') {
      delete payload.approval_status;
      delete payload.approved_by;
      delete payload.approved_at;
      delete payload.rejection_reason;
    }

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update(payload)
      .eq('id', id)
      .select(WORKSPACE_SELECT_FIELDS)
      .single<WorkspaceRecord>();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Workspace not found');
      }

      this.handleWriteError(error, 'Failed to update workspace');
    }

    if (!data) {
      throw new NotFoundException('Workspace not found');
    }

    return data;
  }

  async submitForApproval(id: string, user: AuthenticatedUser) {
    const workspace = await this.findById(id);

    if (workspace.owner_id !== user.id) {
      throw new ForbiddenException('You can only submit your own workspaces');
    }

    if (!['draft', 'rejected', 'hidden'].includes(workspace.approval_status)) {
      throw new BadRequestException(
        'Only draft, hidden, or rejected workspaces can be submitted',
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({
        approval_status: 'pending_approval',
        rejection_reason: null,
        approved_by: null,
        approved_at: null,
      })
      .eq('id', id)
      .select(WORKSPACE_SELECT_FIELDS)
      .single<WorkspaceRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to submit workspace for approval',
        details: error?.message,
      });
    }

    return data;
  }

  async review(
    id: string,
    user: AuthenticatedUser,
    dto: Pick<UpdateWorkspaceDto, 'approvalStatus' | 'rejectionReason'>,
  ) {
    if (
      !['approved', 'rejected', 'hidden'].includes(dto.approvalStatus ?? '')
    ) {
      throw new BadRequestException(
        'approvalStatus must be approved, rejected, or hidden',
      );
    }

    const workspace = await this.findById(id);

    if (workspace.owner_id === user.id) {
      throw new ForbiddenException(
        'Admins cannot approve their own workspace through this route',
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const approved = dto.approvalStatus === 'approved';
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({
        approval_status: dto.approvalStatus,
        rejection_reason: approved
          ? null
          : (dto.rejectionReason ?? 'Rejected by admin'),
        approved_by: approved ? user.id : null,
        approved_at: approved ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select(WORKSPACE_SELECT_FIELDS)
      .single<WorkspaceRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to review workspace',
        details: error?.message,
      });
    }

    return data;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await this.findById(id);

    if (user.role !== 'admin' && workspace.owner_id !== user.id) {
      throw new ForbiddenException('You can only delete your own workspaces');
    }

    const { error, count } = await supabaseAdmin
      .from('workspaces')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to delete workspace',
        details: error.message,
      });
    }

    if (!count) {
      throw new NotFoundException('Workspace not found');
    }

    return {
      deleted: true,
      id,
    };
  }

  private toDatabasePayload(dto: CreateWorkspaceDto | UpdateWorkspaceDto) {
    const updateDto = dto as UpdateWorkspaceDto;
    const payload: Record<string, unknown> = {
      ...(dto.floorId !== undefined ? { floor_id: dto.floorId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.approvalStatus !== undefined
        ? { approval_status: dto.approvalStatus }
        : {}),
      ...(updateDto.rejectionReason !== undefined
        ? { rejection_reason: updateDto.rejectionReason }
        : {}),
      ...(dto.svgElementId !== undefined
        ? { svg_element_id: dto.svgElementId }
        : {}),
      ...(dto.qrCodeValue !== undefined
        ? { qr_code_value: dto.qrCodeValue }
        : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.features !== undefined ? { features: dto.features } : {}),
    };

    return payload;
  }

  private async findById(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select(WORKSPACE_SELECT_FIELDS)
      .eq('id', id)
      .single<WorkspaceRecord>();

    if (error || !data) {
      throw new NotFoundException('Workspace not found');
    }

    return data;
  }

  private handleWriteError(
    error: { code?: string; message: string; details?: string | null } | null,
    fallbackMessage: string,
  ): never {
    if (error?.code === '23503') {
      throw new BadRequestException('Referenced floor does not exist');
    }

    if (error?.code === '23505') {
      if (error.details?.includes('qr_code_value')) {
        throw new BadRequestException('qrCodeValue must be unique');
      }

      throw new BadRequestException(
        'svgElementId must be unique within the same floor',
      );
    }

    if (error?.code === '23514') {
      const detail = `${error.message} ${error.details ?? ''}`;

      if (detail.includes('workspaces_type_check')) {
        throw new BadRequestException(
          'Workspace type is not enabled in the database. Run supabase/04_expand_workspace_types.sql, then retry.',
        );
      }

      if (detail.includes('workspaces_status_check')) {
        throw new BadRequestException(
          'Workspace status is not enabled in the database. Run supabase/04_expand_workspace_types.sql, then retry.',
        );
      }
    }

    throw new InternalServerErrorException({
      message: fallbackMessage,
      details: error?.message,
    });
  }
}
