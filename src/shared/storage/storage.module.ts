import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MediaTitleEntity } from './media-title.entity'
import { MediaService } from './media.service'
import { StorageService } from './storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MediaTitleEntity])],
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class StorageModule {}
