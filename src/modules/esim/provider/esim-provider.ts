/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IEsimPlan {
  id: string
  country: string
  title: string
  dataMb: number | null
  days: number
  wholesaleUsd: number
  networks: string[]
}

export interface IEsimCountry {
  code: string
  plans: number
  fromUsd: number
}

export interface IIssuedEsim {
  providerRef: string
  iccid: string
  smdp: string
  activationCode: string
  lpa: string
  apn: string | null
  qrUrl: string | null
}

export interface IEsimProvider {
  readonly name: string
  countries(): Promise<IEsimCountry[]>
  plans(country: string): Promise<IEsimPlan[]>
  plan(id: string): Promise<IEsimPlan | null>
  issue(plan: IEsimPlan, reference: string): Promise<IIssuedEsim>
}

export const ESIM_PROVIDER = Symbol('ESIM_PROVIDER')
