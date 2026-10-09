import { Global, Module } from '@nestjs/common'
import { MESSENGER } from './messenger'
import { LogMessenger, devChannels } from './log.messenger'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  providers: [{ provide: MESSENGER, useFactory: () => new LogMessenger(devChannels()) }],
  exports: [MESSENGER],
})
export class MessagingModule {}
