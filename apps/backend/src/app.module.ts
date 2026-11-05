import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CheckInModule } from './checkin/checkin.module';
import { CrowdModule } from './crowd/crowd.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { QrModule } from './common/qr/qr.module';
import { validateEnv } from './config/env.validation';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { LineupsModule } from './lineups/lineups.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PhotosModule } from './photos/photos.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { StaffAdminModule } from './staff-admin/staff-admin.module';
import { TicketCategoriesModule } from './ticket-categories/ticket-categories.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: Number(config.get('THROTTLE_LIMIT') ?? 100) },
      ],
    }),
    PrismaModule,
    QrModule,
    UsersModule,
    AuthModule,
    HealthModule,
    EventsModule,
    TicketCategoriesModule,
    OrdersModule,
    PaymentsModule,
    PhotosModule,
    TicketsModule,
    CheckInModule,
    StaffAdminModule,
    ReportsModule,
    LineupsModule,
    CrowdModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    // Urutan guard: rate limit -> autentikasi JWT -> otorisasi role
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
