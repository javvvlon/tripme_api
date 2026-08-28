import { Global, Module } from '@nestjs/common'
import { RevalidationService } from './revalidation.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
