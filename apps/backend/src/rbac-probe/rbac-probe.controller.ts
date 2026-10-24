import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// TEMPORARY: dihapus di Tahap 3 setelah endpoint admin/petugas yang asli tersedia.
@ApiTags('rbac-probe (temporary)')
@ApiBearerAuth()
@Controller()
export class RbacProbeController {
  @Get('admin/ping')
  @Roles(Role.ADMIN)
  adminPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, scope: 'admin', role: user.role };
  }

  @Get('staff/ping')
  @Roles(Role.GATE_STAFF)
  staffPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, scope: 'staff', role: user.role };
  }

  @Get('customer/ping')
  @Roles(Role.CUSTOMER)
  customerPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, scope: 'customer', role: user.role };
  }
}
