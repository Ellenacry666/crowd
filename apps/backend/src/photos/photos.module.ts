import { Module } from '@nestjs/common';
import { OrderPhotosService } from './order-photos.service';
import { PhotoStorageService } from './photo-storage.service';
import { PhotosController } from './photos.controller';

@Module({
  controllers: [PhotosController],
  providers: [OrderPhotosService, PhotoStorageService],
  exports: [OrderPhotosService],
})
export class PhotosModule {}
