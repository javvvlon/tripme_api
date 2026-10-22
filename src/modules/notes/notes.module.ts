import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '~/modules/auth/auth.module'
import { UserEntity } from '~/modules/auth/entities'
import { NoteAckEntity, NoteEntity } from './note.entities'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([NoteEntity, NoteAckEntity, UserEntity])],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
