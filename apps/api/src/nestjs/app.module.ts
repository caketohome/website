import {
  Module,
  NestModule,
  MiddlewareConsumer,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import { CorrelationIdMiddleware } from "./common/correlation-id.middleware";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { TransformInterceptor } from "./common/transform.interceptor";
import { SupabaseAuthGuard } from "./guards/supabase-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

// Domain Modules
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { KitchenModule } from "./modules/kitchen/kitchen.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { AccountingModule } from "./modules/accounting/accounting.module";

@Module({
  imports: [
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    OrdersModule,
    PaymentsModule,
    WebhooksModule,
    InventoryModule,
    KitchenModule,
    NotificationsModule,
    DeliveryModule,
    AccountingModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}

