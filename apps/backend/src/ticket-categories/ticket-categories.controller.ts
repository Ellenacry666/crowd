import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';
import { TicketCategoriesService } from './ticket-categories.service';

@ApiTags('admin-ticket-categories')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class TicketCategoriesController {
  constructor(private readonly categories: TicketCategoriesService) {}

  @Post('events/:eventId/ticket-categories')
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketCategoryDto,
  ) {
    return this.categories.create(eventId, dto);
  }

  @Patch('ticket-categories/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('ticket-categories/:id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }
}
