import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QrSigner } from './qr-signer';

@Global()
@Module({
  providers: [
    {
      provide: QrSigner,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new QrSigner(config.getOrThrow<string>('QR_SECRET')),
    },
  ],
  exports: [QrSigner],
})
export class QrModule {}
