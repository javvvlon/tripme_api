import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MediaFileEntity } from './media-file.entity'
import { MediaFolderEntity } from './media-folder.entity'
import { MediaService } from './media.service'
import { StorageService } from './storage.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MediaFileEntity, MediaFolderEntity])],
  providers: [StorageService, MediaService],
  exports: [StorageService, MediaService],
})
export class StorageModule {}
