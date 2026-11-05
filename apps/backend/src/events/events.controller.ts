import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  list(@Query() query: ListEventsQueryDto) {
    return this.events.listPublic(query);
  }

  @Public()
  @Get(':idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.events.findPublic(idOrSlug);
  }
}
