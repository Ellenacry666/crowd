import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CAMERA_KEY_HEADER } from './camera-key.util';
import { CrowdService } from './crowd.service';
import { IngestDto } from './dto/crowd.dto';

// Kamera mengirim data tiap beberapa detik dan dua kamera dapat berbagi satu IP.
const ingestThrottle = {
  default: {
    limit: () => Number(process.env.THROTTLE_INGEST_LIMIT ?? 600),
    ttl: 60_000,
  },
};

@ApiTags('crowd-ingest')
@Controller('crowd')
export class CrowdIngestController {
  constructor(private readonly crowd: CrowdService) {}

  /** Publik dari sisi JWT; diautentikasi lewat API key kamera di header x-camera-key. */
  @Public()
  @Throttle(ingestThrottle)
  @ApiHeader({ name: CAMERA_KEY_HEADER, required: true })
  @Post('ingest')
  @HttpCode(202)
  ingest(@Headers(CAMERA_KEY_HEADER) apiKey: string | undefined, @Body() dto: IngestDto) {
    return this.crowd.ingest(apiKey, dto);
  }
}
