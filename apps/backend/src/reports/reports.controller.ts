import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('admin-reports')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary() {
    return this.reports.summary();
  }

  @Get('sales')
  sales(@Query() q: ReportQueryDto) {
    return this.reports.sales(q.eventId);
  }

  /** Statistik tiket check-in per acara. Tidak bergantung pada kamera/crowd monitoring. */
  @Get('events/:eventId/checkin-stats')
  eventCheckInStats(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.reports.eventCheckInStats(eventId);
  }

  @Get('checkins')
  checkins(@Query() q: ReportQueryDto) {
    return this.reports.checkins(q.eventId);
  }
}
