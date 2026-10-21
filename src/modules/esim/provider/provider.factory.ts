import { join } from 'node:path'
import type { CacheService } from '~/shared/cache/cache.service'
import { esimSandbox } from '../esim.links'
import type { IEsimProvider } from './esim-provider'
import { ESIMO_API_URL, EsimoProvider, fetchEsimoPackages } from './esimo.provider'
import { IokaEsimProvider } from './ioka.provider'
import { FixtureIokaSource, HttpIokaSource } from './ioka.source'
import { SandboxEsimProvider } from './sandbox.provider'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export function esimProviderFromEnv(cache: CacheService): IEsimProvider | null {
  const choice = process.env.ESIM_PROVIDER?.trim() || ''

  if (choice === 'off') return null

  if (choice === 'ioka') {
    if (process.env.IOKA_ESIM_FIXTURES === '1') return new IokaEsimProvider(new FixtureIokaSource(join(__dirname, 'fixtures', 'ioka')), cache)

    const url = process.env.IOKA_ESIM_URL?.trim()

    return url ? new IokaEsimProvider(new HttpIokaSource(url, process.env.IOKA_ESIM_TOKEN?.trim() || null), cache) : null
  }

  if (esimSandbox()) return new SandboxEsimProvider()

  const url = process.env.ESIMO_API_URL?.trim() || ESIMO_API_URL

  return new EsimoProvider(() => fetchEsimoPackages(url), cache)
}
