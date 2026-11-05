import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { OrderPhotosService, UploadedPhoto } from './order-photos.service';
import { MAX_PHOTO_BYTES } from './photo-storage.service';

function imageResponse(res: Response, file: { buffer: Buffer; mime: string }) {
  // Foto wajah adalah data pribadi: jangan di-cache oleh browser atau proxy.
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return new StreamableFile(file.buffer, { type: file.mime, disposition: 'inline' });
}

@ApiTags('photos')
@ApiBearerAuth()
@Controller()
export class PhotosController {
  constructor(private readonly photos: OrderPhotosService) {}

  @Get('orders/:orderId/photos')
  @Roles(Role.CUSTOMER, Role.ADMIN)
  status(@CurrentUser() user: AuthenticatedUser, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.photos.status(user, orderId);
  }

  /** multipart/form-data: field `photo` (berkas) dan `consent` ("true"). */
  @Put('orders/:orderId/photos/:slot')
  @Roles(Role.CUSTOMER)
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('slot', ParseIntPipe) slot: number,
    @UploadedFile() file: UploadedPhoto | undefined,
    @Body() body: UploadPhotoDto,
  ) {
    return this.photos.upload(user, orderId, slot, file, body.consent);
  }

  @Get('orders/:orderId/photos/:slot/image')
  @Roles(Role.CUSTOMER, Role.ADMIN)
  async orderImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('slot', ParseIntPipe) slot: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    return imageResponse(res, await this.photos.orderImage(user, orderId, slot));
  }

  @Get('tickets/:ticketId/photo')
  @Roles(Role.CUSTOMER, Role.ADMIN, Role.GATE_STAFF)
  async ticketPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return imageResponse(res, await this.photos.ticketPhoto(user, ticketId));
  }
}
