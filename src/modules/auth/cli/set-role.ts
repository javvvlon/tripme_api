import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { AppModule } from '~/app.module'
import { UserEntity } from '~/modules/auth/entities'
import { SessionRepository } from '~/modules/auth/repositories/session.repository'
import { normaliseEmail } from '~/modules/auth/repositories/user.repository'
import { UserRole } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
function arg(name: string): string | undefined {
  const found = process.argv.find(a => a.startsWith(`--${name}=`))

  return found?.slice(name.length + 3)
}

async function main(): Promise<void> {
  const email = arg('email')
  const role = (arg('role') ?? '').toUpperCase() as UserRole

  if (!email || !role) {
    console.error('usage: node dist/modules/auth/cli/set-role.js --email=… --role=AGENT|FREELANCER|MANAGER|ADMIN|CLIENT')
    process.exit(1)
  }

  if (!Object.values(UserRole).includes(role)) {
    console.error(`unknown role "${role}" — one of ${Object.values(UserRole).join(', ')}`)
    process.exit(1)
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })

  try {
    const users = app.get<Repository<UserEntity>>(getRepositoryToken(UserEntity))
    const user = await users.findOne({ where: { email: normaliseEmail(email) } })

    if (!user || user.deletedAt) {
      console.error(`${email} not found`)
      process.exit(1)
    }

    if (user.role === role) {
      console.log(`${user.email} is already ${role}`)
      return
    }

    const before = user.role

    await users.update({ id: user.id }, { role })
    await app.get(SessionRepository).revokeAllForUser(user.id)

    console.log(`${user.email}: ${before} → ${role}. Signed out everywhere, the new role applies at the next sign-in.`)
  }
  finally {
    await app.close()
  }
}

void main().catch((error) => {
  console.error(String(error))
  process.exit(1)
})
