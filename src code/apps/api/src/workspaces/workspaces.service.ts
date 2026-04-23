import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

type WorkspaceRecord = {
  id: string;
  floor_id: string;
  name: string;
  type: string;
  status: string;
  svg_element_id: string;
  qr_code_value: string;
  capacity: number;
  features: Record<string, unknown>;
};

@Injectable()
export class WorkspacesService {
  async findAll() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select(
        'id, floor_id, name, type, status, svg_element_id, qr_code_value, capacity, features',
      )
      .order('floor_id', { ascending: true })
      .order('name', { ascending: true });

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

  async create(dto: CreateWorkspaceDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .insert(payload)
      .select(
        'id, floor_id, name, type, status, svg_element_id, qr_code_value, capacity, features',
      )
      .single<WorkspaceRecord>();

    if (error || !data) {
      this.handleWriteError(error, 'Failed to create workspace');
    }

    return data;
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update(payload)
      .eq('id', id)
      .select(
        'id, floor_id, name, type, status, svg_element_id, qr_code_value, capacity, features',
      )
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

  async remove(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
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
    return {
      ...(dto.floorId !== undefined ? { floor_id: dto.floorId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.svgElementId !== undefined
        ? { svg_element_id: dto.svgElementId }
        : {}),
      ...(dto.qrCodeValue !== undefined
        ? { qr_code_value: dto.qrCodeValue }
        : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.features !== undefined ? { features: dto.features } : {}),
    };
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
