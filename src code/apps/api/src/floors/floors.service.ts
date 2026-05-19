import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getSupabaseAdmin } from '../common/supabase.client';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FLOOR_MAPS_BUCKET } from './floors.constants';

type FloorRecord = {
  id: string;
  building_id: string;
  floor_number: number;
  name: string | null;
  svg_map_url: string | null;
};

@Injectable()
export class FloorsService {
  async findAll() {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('floors')
      .select('id, building_id, floor_number, name, svg_map_url')
      .order('building_id', { ascending: true })
      .order('floor_number', { ascending: true });

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to fetch floors from Supabase',
        details: error.message,
      });
    }

    return {
      count: data.length,
      items: data as FloorRecord[],
    };
  }

  async getSvgMapContent(id: string) {
    const floor = await this.findFloorById(id);

    if (!floor.svg_map_url) {
      throw new NotFoundException('Floor does not have an uploaded SVG map');
    }

    const objectPath = this.getStorageObjectPath(floor.svg_map_url);
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from(FLOOR_MAPS_BUCKET)
      .download(objectPath);

    if (error || !data) {
      throw new InternalServerErrorException({
        message: 'Failed to download SVG map from Supabase Storage',
        details: error?.message,
      });
    }

    return data.text();
  }

  async create(dto: CreateFloorDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('floors')
      .insert(payload)
      .select('id, building_id, floor_number, name, svg_map_url')
      .single<FloorRecord>();

    if (error || !data) {
      this.handleWriteError(error, 'Failed to create floor');
    }

    return data;
  }

  async update(id: string, dto: UpdateFloorDto) {
    const supabaseAdmin = getSupabaseAdmin();
    const payload = this.toDatabasePayload(dto);

    const { data, error } = await supabaseAdmin
      .from('floors')
      .update(payload)
      .eq('id', id)
      .select('id, building_id, floor_number, name, svg_map_url')
      .single<FloorRecord>();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Floor not found');
      }

      this.handleWriteError(error, 'Failed to update floor');
    }

    if (!data) {
      throw new NotFoundException('Floor not found');
    }

    return data;
  }

  async remove(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { error, count } = await supabaseAdmin
      .from('floors')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new InternalServerErrorException({
        message: 'Failed to delete floor',
        details: error.message,
      });
    }

    if (!count) {
      throw new NotFoundException('Floor not found');
    }

    return {
      deleted: true,
      id,
    };
  }

  async uploadSvgMap(
    id: string,
    user: AuthenticatedUser,
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('SVG file is required');
    }

    if (file.mimetype !== 'image/svg+xml') {
      throw new BadRequestException('Only SVG files are allowed');
    }

    const supabaseAdmin = getSupabaseAdmin();
    const fileName = this.normalizeFileName(file.originalname);
    const ownerSegment =
      user.role === 'space_owner' ? `space-owners/${user.id}` : 'admin';
    const objectPath = `floors/${id}/${ownerSegment}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(FLOOR_MAPS_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new InternalServerErrorException({
        message: 'Failed to upload SVG map',
        details: uploadError.message,
      });
    }

    const svgMapUrl = `${FLOOR_MAPS_BUCKET}/${objectPath}`;

    const { data, error } = await supabaseAdmin
      .from('floors')
      .update({ svg_map_url: svgMapUrl })
      .eq('id', id)
      .select('id, building_id, floor_number, name, svg_map_url')
      .single<FloorRecord>();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Floor not found');
      }

      throw new InternalServerErrorException({
        message: 'Failed to attach SVG map to floor',
        details: error.message,
      });
    }

    return data;
  }

  private toDatabasePayload(dto: CreateFloorDto | UpdateFloorDto) {
    return {
      ...(dto.buildingId !== undefined ? { building_id: dto.buildingId } : {}),
      ...(dto.floorNumber !== undefined
        ? { floor_number: dto.floorNumber }
        : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.svgMapUrl !== undefined ? { svg_map_url: dto.svgMapUrl } : {}),
    };
  }

  private handleWriteError(
    error: { code?: string; message: string } | null,
    fallbackMessage: string,
  ): never {
    if (error?.code === '23503') {
      throw new BadRequestException('Referenced building does not exist');
    }

    if (error?.code === '23505') {
      throw new BadRequestException(
        'A floor with this building and floor number already exists',
      );
    }

    throw new InternalServerErrorException({
      message: fallbackMessage,
      details: error?.message,
    });
  }

  private normalizeFileName(fileName: string) {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-');
  }

  private async findFloorById(id: string) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('floors')
      .select('id, building_id, floor_number, name, svg_map_url')
      .eq('id', id)
      .single<FloorRecord>();

    if (error || !data) {
      throw new NotFoundException('Floor not found');
    }

    return data;
  }

  private getStorageObjectPath(svgMapUrl: string) {
    return svgMapUrl.startsWith(`${FLOOR_MAPS_BUCKET}/`)
      ? svgMapUrl.replace(`${FLOOR_MAPS_BUCKET}/`, '')
      : svgMapUrl;
  }
}
