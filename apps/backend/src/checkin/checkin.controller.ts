import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CheckInService } from './checkin.service';
import { CheckInDto } from './dto/checkin.dto';
import { StaffCheckInsQueryDto } from './dto/staff-checkins-query.dto';

// Batas lebih longgar dari default karena banyak petugas dapat berbagi satu IP (Wi-Fi gerbang).
const checkInThrottle = {
  default: {
    limit: () => Number(process.env.THROTTLE_CHECKIN_LIMIT ?? 300),
    ttl: 60_000,
  },
};

@ApiTags('check-in')
@ApiBearerAuth()
@Roles(Role.GATE_STAFF)
@Controller()
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  @Get('staff/events')
  events(@CurrentUser() staff: AuthenticatedUser) {
    return this.checkIn.listMyEvents(staff);
  }

  /** Pratinjau tanpa mengubah status tiket: menampilkan data pemegang agar dicocokkan petugas. */
  @Post('checkin/preview')
  @Throttle(checkInThrottle)
  @HttpCode(200)
  preview(@CurrentUser() staff: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.checkIn.preview(staff, dto);
  }

  @Post('checkin')
  @Throttle(checkInThrottle)
  @HttpCode(200)
  scan(@CurrentUser() staff: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.checkIn.checkIn(staff, dto);
  }

  @Get('staff/checkins')
  history(@CurrentUser() staff: AuthenticatedUser, @Query() query: StaffCheckInsQueryDto) {
    return this.checkIn.listMyCheckIns(staff, query);
  }
}
