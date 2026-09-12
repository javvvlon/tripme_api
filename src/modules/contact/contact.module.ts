import { Module } from '@nestjs/common'
import { AuthModule } from '~/modules/auth/auth.module'
import { LeadsModule } from '~/modules/leads/leads.module'
import { ContactController } from './contact.controller'
import { ContactService } from './contact.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, LeadsModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
