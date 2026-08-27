import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { databaseOptions } from './data-source'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Global()
@Module({
  imports: [TypeOrmModule.forRootAsync({ useFactory: databaseOptions })],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
