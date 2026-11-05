import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  // Harus dideklarasikan sebelum ':id'
  @Get('my')
  @Roles(Role.CUSTOMER)
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.findMine(user);
  }

  /** Sisa jatah pembelian akun untuk acara (id atau slug). */
  @Get('quota/:idOrSlug')
  @Roles(Role.CUSTOMER)
  quota(@CurrentUser() user: AuthenticatedUser, @Param('idOrSlug') idOrSlug: string) {
    return this.orders.quotaFor(user, idOrSlug);
  }

  @Get(':id')
  @Roles(Role.CUSTOMER, Role.ADMIN)
  one(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(user, id);
  }
}

@ApiTags('admin-orders')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: AdminOrdersQueryDto) {
    return this.orders.listAdmin(query);
  }
}
