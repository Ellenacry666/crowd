import { Module } from '@nestjs/common';
import { AdminEventsController } from './admin-events.controller';
import { EventFinishJob } from '../jobs/event-finish.job';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, EventFinishJob],
  exports: [EventsService],
})
export class EventsModule {}
