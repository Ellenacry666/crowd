import { Module } from '@nestjs/common';
import { OrderExpiryJob } from '../jobs/order-expiry.job';
import { PhotosModule } from '../photos/photos.module';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PhotosModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderExpiryJob],
  exports: [OrdersService],
})
export class OrdersModule {}
