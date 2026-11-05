import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AssignStaffDto, CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffAdminService } from './staff-admin.service';

@ApiTags('admin-staff')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class StaffAdminController {
  constructor(private readonly staff: StaffAdminService) {}

  @Post('staff')
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Get('staff')
  list() {
    return this.staff.list();
  }

  @Patch('staff/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(id, dto);
  }

  @Put('events/:id/staff')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignStaffDto) {
    return this.staff.assign(id, dto.staffIds);
  }
}
