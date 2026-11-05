import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateLineupDto, UpdateLineupDto } from './dto/lineup.dto';
import { LineupsService } from './lineups.service';

@ApiTags('admin-lineups')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminLineupsController {
  constructor(private readonly lineups: LineupsService) {}

  @Get('events/:eventId/lineups')
  list(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.lineups.list(eventId);
  }

  @Post('events/:eventId/lineups')
  create(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: CreateLineupDto) {
    return this.lineups.create(eventId, dto);
  }

  @Patch('lineups/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLineupDto) {
    return this.lineups.update(id, dto);
  }

  @Delete('lineups/:id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.lineups.remove(id);
  }
}
