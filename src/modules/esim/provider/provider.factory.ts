import { join } from 'node:path'
import type { CacheService } from '~/shared/cache/cache.service'
import { esimSandbox } from '../esim.links'
import type { IEsimProvider } from './esim-provider'
import { IokaEsimProvider } from './ioka.provider'
import { FixtureIokaSource, HttpIokaSource } from './ioka.source'
import { SandboxEsimProvider } from './sandbox.provider'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function esimProviderFromEnv(cache: CacheService): IEsimProvider | null {
  if (process.env.ESIM_PROVIDER === 'ioka') {
    if (process.env.IOKA_ESIM_FIXTURES === '1') return new IokaEsimProvider(new FixtureIokaSource(join(__dirname, 'fixtures', 'ioka')), cache)

    const url = process.env.IOKA_ESIM_URL?.trim()

    return url ? new IokaEsimProvider(new HttpIokaSource(url, process.env.IOKA_ESIM_TOKEN?.trim() || null), cache) : null
  }

  return esimSandbox() ? new SandboxEsimProvider() : null
}
