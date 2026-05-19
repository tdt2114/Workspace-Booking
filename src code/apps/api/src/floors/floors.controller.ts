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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';

@Controller('floors')
@UseGuards(SupabaseAuthGuard)
@ApiTags('Floors')
@ApiBearerAuth('supabase')
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
  @Roles('admin', 'space_owner')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'SVG floor map file.',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadSvgMap(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
  ) {
    return this.floorsService.uploadSvgMap(id, user, file);
  }
}
