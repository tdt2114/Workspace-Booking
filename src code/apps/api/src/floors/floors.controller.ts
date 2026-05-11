import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';

@Controller('floors')
@UseGuards(SupabaseAuthGuard)
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  findAll() {
    return this.floorsService.findAll();
  }

  @Get(':id/svg')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  getSvgMap(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.floorsService.getSvgMapContent(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateFloorDto) {
    return this.floorsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.floorsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.floorsService.remove(id);
  }

  @Post(':id/svg')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  uploadSvgMap(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ) {
    return this.floorsService.uploadSvgMap(id, file);
  }
}
