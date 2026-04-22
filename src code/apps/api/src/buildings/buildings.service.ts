import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

type BuildingRecord = {
  id: string;
  name: string;
  address: string | null;
  total_floors: number;
  open_time: string | null;
  close_time: string | null;
};

@Injectable()
export class BuildingsService {
  async findAll() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('buildings')
      .select('id, name, address, total_floors, open_time, close_time')
      .order('name', { ascending: true });

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch buildings from Supabase',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data as BuildingRecord[],
    };
  }

  async create(dto: CreateBuildingDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('buildings')
      .insert(payload)
      .select('id, name, address, total_floors, open_time, close_time')
      .single<BuildingRecord>();

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to create building',
        details: error?.message,
      });
    }

    return data;
  }

  async update(id: string, dto: UpdateBuildingDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('buildings')
      .update(payload)
      .eq('id', id)
      .select('id, name, address, total_floors, open_time, close_time')
      .single<BuildingRecord>();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Building not found');
      }

      throw new InternalServerErrorException({
        message: 'Failed to update building',
        details: error.message,
      });
    }

    if (!data) {
      throw new NotFoundException('Building not found');
    }

    return data;
  }

  async remove(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { error, count } = await supabaseAdmin
      .from('buildings')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to delete building',
        details: error.message,
      });
    }

    if (!count) {
      throw new NotFoundException('Building not found');
    }

    return {
      deleted: true,
      id,
    };
  }

  private toDatabasePayload(dto: CreateBuildingDto | UpdateBuildingDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.totalFloors !== undefined
        ? { total_floors: dto.totalFloors }
        : {}),
      ...(dto.openTime !== undefined ? { open_time: dto.openTime } : {}),
      ...(dto.closeTime !== undefined ? { close_time: dto.closeTime } : {}),
    };
  }
}
