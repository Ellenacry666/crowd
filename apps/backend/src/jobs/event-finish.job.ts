import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventsService } from '../events/events.service';

const INTERVAL_MS = 60_000;

/** Job sederhana (setInterval) yang mengubah acara PUBLISHED yang sudah berakhir menjadi FINISHED. */
@Injectable()
export class EventFinishJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventFinishJob.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly events: EventsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return; // test memanggil service secara langsung
    const run = () =>
      this.events
        .finishEndedEvents()
        .then((n) => n > 0 && this.logger.log(`${n} acara yang sudah berakhir ditandai FINISHED`))
        .catch((e) => this.logger.error(e instanceof Error ? e.stack : String(e)));
    void run(); // juga saat start, agar acara yang berakhir selagi server mati langsung diperbarui
    this.timer = setInterval(run, INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
