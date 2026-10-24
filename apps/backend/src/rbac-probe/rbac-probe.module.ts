import { Module } from '@nestjs/common';
import { RbacProbeController } from './rbac-probe.controller';

@Module({ controllers: [RbacProbeController] })
export class RbacProbeModule {}
