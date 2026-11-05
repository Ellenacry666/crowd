import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AdminTicketsQueryDto } from './dto/admin-tickets-query.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // Harus dideklarasikan sebelum ':id'
  @Get('my')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.tickets.listMine(user);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.findMine(user, id);
  }
}

@ApiTags('admin-tickets')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/tickets')
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@Query() query: AdminTicketsQueryDto) {
    return this.tickets.listAdmin(query);
  }
}
