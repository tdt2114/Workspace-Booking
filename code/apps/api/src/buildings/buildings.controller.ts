import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Controller('buildings')
@UseGuards(SupabaseAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  findAll() {
    return this.buildingsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.buildingsService.remove(id);
  }
}
