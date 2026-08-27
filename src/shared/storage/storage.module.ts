import { Global, Module } from '@nestjs/common'
import { StorageService } from './storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
