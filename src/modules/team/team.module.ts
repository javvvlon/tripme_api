import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { UserEntity } from '~/modules/auth/entities'
import { LeadsModule } from '~/modules/leads/leads.module'
import { MessagesModule } from '~/modules/messages/messages.module'
import { MyWorkController, TeamController } from './team.controller'
import { TeamService } from './team.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, LeadsModule, MessagesModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [TeamController, MyWorkController],
  providers: [TeamService],
})
export class TeamModule {}
