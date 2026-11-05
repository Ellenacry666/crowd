import { Module } from '@nestjs/common';
import { AdminLineupsController } from './admin-lineups.controller';
import { LineupsService } from './lineups.service';

@Module({
  controllers: [AdminLineupsController],
  providers: [LineupsService],
  exports: [LineupsService],
})
export class LineupsModule {}
