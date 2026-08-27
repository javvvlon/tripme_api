import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '~/app.module'
import { UserRepository } from '~/modules/auth/repositories/user.repository'
import { PasswordService } from '~/modules/auth/services/password.service'
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
  const password = arg('password')
  const role = (arg('role') ?? UserRole.Admin) as UserRole

  if (!email || !password) {
    console.error('usage: npm run user:create -- --email=… --password=… [--role=ADMIN] [--first-name=…] [--last-name=…] [--phone=…]')
    process.exit(1)
  }

  if (!Object.values(UserRole).includes(role)) {
    console.error(`unknown role "${role}" — one of ${Object.values(UserRole).join(', ')}`)
    process.exit(1)
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })

  try {
    const users = app.get(UserRepository)
    const passwords = app.get(PasswordService)

    if (await users.emailExists(email)) {
      console.error(`${email} already exists`)
      process.exit(1)
    }

    const user = await users.create({
      email,
      passwordHash: await passwords.hash(password),
      firstName: arg('first-name') ?? '',
      lastName: arg('last-name') ?? '',
      phoneNumber: arg('phone') ?? '',
      role,
    })

    await users.markVerified(user.get('id'))

    new Logger('user:create').log(`created ${email} as ${role} (${user.get('id')})`)
  }
  finally {
    await app.close()
  }
}

void main().catch((error) => {
  console.error(String(error))
  process.exit(1)
})
