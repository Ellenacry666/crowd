import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PhotosModule } from '../photos/photos.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule, PhotosModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
