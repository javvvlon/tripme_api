import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ContactController } from './contact.controller'
import { ContactService } from './contact.service'
import { ContactMessageEntity } from './contact-message.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [TypeOrmModule.forFeature([ContactMessageEntity])],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
