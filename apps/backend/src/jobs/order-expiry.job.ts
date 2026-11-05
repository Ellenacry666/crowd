import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

const INTERVAL_MS = 60_000;

/** Job sederhana (setInterval) yang melepas stok dari order PENDING yang kedaluwarsa. */
@Injectable()
export class OrderExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryJob.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly orders: OrdersService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return; // test memanggil service secara langsung
    this.timer = setInterval(() => {
      this.orders
        .expireOverdueOrders()
        .then((n) => n > 0 && this.logger.log(`${n} order kedaluwarsa dilepas`))
        .catch((e) => this.logger.error(e instanceof Error ? e.stack : String(e)));
    }, INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
