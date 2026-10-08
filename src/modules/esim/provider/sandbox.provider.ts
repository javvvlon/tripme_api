import { randomBytes } from 'node:crypto'
import { SANDBOX_COUNTRIES, SANDBOX_PLANS } from './sandbox.catalog'
import type { IEsimCountry, IEsimPlan, IEsimProvider, IIssuedEsim } from './esim-provider'

const round = (value: number): number => Math.round(value * 100) / 100

const titleOf = (dataMb: number | null, days: number): string =>
  `${dataMb === null ? 'Unlimited' : `${dataMb / 1024} GB`} · ${days} days`

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export class SandboxEsimProvider implements IEsimProvider {
  readonly name = 'sandbox'

  private readonly catalog: IEsimPlan[] = SANDBOX_COUNTRIES.flatMap(country => SANDBOX_PLANS.map(plan => ({
    id: `sbx-${country.code.toLowerCase()}-${plan.dataMb ?? 'unl'}-${plan.days}`,
    country: country.code,
    title: titleOf(plan.dataMb, plan.days),
    dataMb: plan.dataMb,
    days: plan.days,
    wholesaleUsd: round(plan.usd * country.scale),
    networks: country.networks,
  })))

  async countries(): Promise<IEsimCountry[]> {
    return SANDBOX_COUNTRIES.map((country) => {
      const plans = this.catalog.filter(plan => plan.country === country.code)

      return { code: country.code, plans: plans.length, fromUsd: Math.min(...plans.map(plan => plan.wholesaleUsd)) }
    })
  }

  async plans(country: string): Promise<IEsimPlan[]> {
    return this.catalog.filter(plan => plan.country === country.toUpperCase())
  }

  async plan(id: string): Promise<IEsimPlan | null> {
    return this.catalog.find(plan => plan.id === id) ?? null
  }

  async issue(plan: IEsimPlan, reference: string): Promise<IIssuedEsim> {
    if (process.env.ESIM_SANDBOX_FAIL === '1') throw new Error('Sandbox provider refused to issue')

    const code = randomBytes(10).toString('hex').toUpperCase()
    const smdp = 'smdp.sandbox.tripme.uz'

    return {
      providerRef: `SBX-${reference}`,
      iccid: `8999${String(Date.now()).slice(-12)}${Math.floor(Math.random() * 1e3).toString().padStart(3, '0')}`,
      smdp,
      activationCode: code,
      lpa: `LPA:1$${smdp}$${code}`,
      apn: plan.country === 'TR' ? 'internet' : null,
      qrUrl: null,
    }
  }
}
