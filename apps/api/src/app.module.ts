import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { EventsModule } from "./common/events/events.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { CommissionsModule } from "./commissions/commissions.module";
import { HealthModule } from "./health/health.module";
import { LedgerModule } from "./ledger/ledger.module";
import { PartnersModule } from "./partners/partners.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { TransactionsModule } from "./transactions/transactions.module";

@Module({
  imports: [
    // Baseline abuse protection for every route; public endpoints tighten it
    // further with @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    EventsModule,
    AuthModule,
    AuditModule,
    HealthModule,
    CustomersModule,
    PartnersModule,
    ReferralsModule,
    TransactionsModule,
    CommissionsModule,
    LedgerModule,
  ],
  providers: [
    // Rate limiting runs before authentication so floods are shed cheaply, then
    // authentication, then permission enforcement. Access is deny-by-default;
    // routes opt out explicitly with @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
