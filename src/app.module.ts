import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SearchModule } from '~/modules/search/search.module'
import { ReferencesModule } from '~/modules/references/references.module'
import { AuthModule } from '~/modules/auth/auth.module'
import { ContentModule } from '~/modules/content/content.module'
import { PostsModule } from '~/modules/posts/posts.module'
import { ContactModule } from '~/modules/contact/contact.module'
import { LeadsModule } from '~/modules/leads/leads.module'
import { OrdersModule } from '~/modules/orders/orders.module'
import { FinanceModule } from '~/modules/finance/finance.module'
import { EsimModule } from '~/modules/esim/esim.module'
import { NotificationsModule } from '~/modules/notifications/notifications.module'
import { MessagesModule } from '~/modules/messages/messages.module'
import { TeamModule } from '~/modules/team/team.module'
import { OperatorsModule } from '~/modules/operators/operators.module'
import { AccountModule } from '~/modules/account/account.module'
import { PointsModule } from '~/modules/points/points.module'
import { AnalyticsModule } from '~/modules/analytics/analytics.module'
import { DatabaseModule } from '~/shared/database/database.module'
import { StorageModule } from '~/shared/storage/storage.module'
import { RevalidationModule } from '~/shared/revalidation/revalidation.module'
import { HealthModule } from '~/shared/health/health.module'
import { MessagingModule } from '~/shared/messaging/messaging.module'
import { CacheModule } from '~/shared/cache/cache.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    CacheModule,
    MessagingModule,
    DatabaseModule,
    StorageModule,
    RevalidationModule,
    SearchModule,
    ReferencesModule,
    AuthModule,
    ContentModule,
    PostsModule,
    ContactModule,
    LeadsModule,
    OrdersModule,
    FinanceModule,
    EsimModule,
    NotificationsModule,
    MessagesModule,
    TeamModule,
    OperatorsModule,
    AccountModule,
    PointsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
