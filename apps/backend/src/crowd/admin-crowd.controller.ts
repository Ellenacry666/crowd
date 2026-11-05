import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CamerasService } from './cameras.service';
import { CrowdService } from './crowd.service';
import { CreateCameraDto, DashboardQueryDto, UpdateCameraDto } from './dto/crowd.dto';

@ApiTags('admin-crowd')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminCrowdController {
  constructor(
    private readonly crowd: CrowdService,
    private readonly cameras: CamerasService,
  ) {}

  @Get('events/:eventId/crowd/dashboard')
  dashboard(@Param('eventId', ParseUUIDPipe) eventId: string, @Query() q: DashboardQueryDto) {
    return this.crowd.dashboard(eventId, q.minutes);
  }

  @Get('events/:eventId/cameras')
  listCameras(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.cameras.list(eventId);
  }

  @Post('events/:eventId/cameras')
  createCamera(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: CreateCameraDto) {
    return this.cameras.create(eventId, dto);
  }

  @Patch('cameras/:id')
  updateCamera(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCameraDto) {
    return this.cameras.update(id, dto);
  }

  @Post('cameras/:id/rotate-key')
  @HttpCode(200)
  rotateKey(@Param('id', ParseUUIDPipe) id: string) {
    return this.cameras.rotateKey(id);
  }

  @Delete('cameras/:id')
  @HttpCode(200)
  removeCamera(@Param('id', ParseUUIDPipe) id: string) {
    return this.cameras.remove(id);
  }
}
