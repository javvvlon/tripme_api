import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  })

  app.setGlobalPrefix('api/v1')

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port)

  new Logger('bootstrap').log(
    `listening on :${port} — suppliers in ${process.env.SUPPLIER_LIVE === '1' ? 'LIVE' : 'FIXTURE'} mode`,
  )
}

void bootstrap()
