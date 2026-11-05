import { Module } from '@nestjs/common';
import { LineupsModule } from '../lineups/lineups.module';
import { AdminCrowdController } from './admin-crowd.controller';
import { CamerasService } from './cameras.service';
import { CrowdIngestController } from './crowd-ingest.controller';
import { CrowdService } from './crowd.service';

@Module({
  imports: [LineupsModule],
  controllers: [CrowdIngestController, AdminCrowdController],
  providers: [CrowdService, CamerasService],
})
export class CrowdModule {}
