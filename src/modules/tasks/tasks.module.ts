import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { UserEntity } from '~/modules/auth/entities'
import { TaskEntity, TaskEventEntity } from './task.entities'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([TaskEntity, TaskEventEntity, UserEntity])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
