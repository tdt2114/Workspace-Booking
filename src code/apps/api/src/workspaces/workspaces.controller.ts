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
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(SupabaseAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  findAll() {
    return this.workspacesService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  create(@Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.workspacesService.remove(id);
  }
}
