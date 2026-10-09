import { Module } from '@nestjs/common'
import type { OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { AuthService } from '~/modules/auth/services/auth.service'
import { UserEntity } from '~/modules/auth/entities'
import { ConversationEntity, MessageEntity } from './message.entities'
import { MessagesService } from './messages.service'
import { ClientMessagesController, StaffMessagesController } from './messages.controller'
import { MessagesStreamController } from './messages-stream.controller'
import { MessagesHub } from './messages.hub'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ConversationEntity, MessageEntity, UserEntity])],
  controllers: [ClientMessagesController, StaffMessagesController, MessagesStreamController],
  providers: [MessagesService, MessagesHub],
  exports: [MessagesService],
})
export class MessagesModule implements OnModuleInit {
  constructor(
    private readonly messages: MessagesService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit(): void {
    this.auth.onAccountDeleted(clientId => this.messages.forget(clientId))
  }
}
