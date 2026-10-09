import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionEntity, UserEntity, VerificationCodeEntity } from './entities'
import { AuthController } from './controllers/auth.controller'
import { ProfileController } from './controllers/profile.controller'
import { AuthService } from './services/auth.service'
import { PasswordService } from './services/password.service'
import { TokenService } from './services/token.service'
import { VerificationService } from './services/verification.service'
import { UserRepository } from './repositories/user.repository'
import { SessionRepository } from './repositories/session.repository'
import { VerificationRepository } from './repositories/verification.repository'
import { AuthGuard } from './guards/auth.guard'
import { OptionalAuthGuard } from '~/modules/auth/guards/optional-auth.guard'
import { RolesGuard } from './guards/roles.guard'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SessionEntity, VerificationCodeEntity]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET

        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be set and at least 32 characters — see .env.example')
        }

        return { secret, signOptions: { algorithm: 'HS256' } }
      },
    }),
  ],
  controllers: [AuthController, ProfileController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    VerificationService,
    UserRepository,
    SessionRepository,
    VerificationRepository,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [AuthGuard, OptionalAuthGuard, RolesGuard, TokenService, UserRepository, PasswordService, VerificationService, SessionRepository, AuthService],
})
export class AuthModule {}
