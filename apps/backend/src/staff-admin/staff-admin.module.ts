import { Module } from '@nestjs/common';
import { StaffAdminController } from './staff-admin.controller';
import { StaffAdminService } from './staff-admin.service';

@Module({
  controllers: [StaffAdminController],
  providers: [StaffAdminService],
})
export class StaffAdminModule {}
