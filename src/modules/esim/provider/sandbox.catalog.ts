/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ISandboxCountry {
  code: string
  networks: string[]
  scale: number
}

export const SANDBOX_COUNTRIES: ISandboxCountry[] = [
  { code: 'TR', networks: ['Turkcell', 'Vodafone'], scale: 1 },
  { code: 'AE', networks: ['Etisalat', 'du'], scale: 1.35 },
  { code: 'EG', networks: ['Vodafone', 'Orange'], scale: 1.1 },
  { code: 'TH', networks: ['AIS', 'dtac'], scale: 0.95 },
  { code: 'GE', networks: ['Magti', 'Silknet'], scale: 0.9 },
  { code: 'AZ', networks: ['Azercell'], scale: 1.05 },
  { code: 'MV', networks: ['Dhiraagu'], scale: 1.6 },
  { code: 'VN', networks: ['Viettel'], scale: 0.85 },
  { code: 'MY', networks: ['Maxis', 'CelcomDigi'], scale: 0.9 },
  { code: 'ID', networks: ['Telkomsel'], scale: 0.95 },
  { code: 'LK', networks: ['Dialog'], scale: 1.2 },
  { code: 'SA', networks: ['STC', 'Mobily'], scale: 1.3 },
  { code: 'QA', networks: ['Ooredoo'], scale: 1.35 },
  { code: 'CN', networks: ['China Unicom'], scale: 1.2 },
  { code: 'KR', networks: ['SK Telecom', 'KT'], scale: 1.1 },
  { code: 'JP', networks: ['NTT Docomo', 'SoftBank'], scale: 1.15 },
  { code: 'IT', networks: ['TIM', 'Vodafone'], scale: 1 },
  { code: 'FR', networks: ['Orange', 'SFR'], scale: 1 },
  { code: 'ES', networks: ['Movistar', 'Orange'], scale: 1 },
  { code: 'DE', networks: ['Telekom', 'Vodafone'], scale: 1.05 },
  { code: 'GB', networks: ['EE', 'Three'], scale: 1.05 },
  { code: 'US', networks: ['T-Mobile', 'AT&T'], scale: 1.1 },
  { code: 'RU', networks: ['MegaFon', 'Beeline'], scale: 0.9 },
  { code: 'KZ', networks: ['Beeline', 'Kcell'], scale: 0.8 },
  { code: 'KG', networks: ['MegaCom'], scale: 0.8 },
]

export const SANDBOX_PLANS: Array<{ dataMb: number | null, days: number, usd: number }> = [
  { dataMb: 1024, days: 7, usd: 4.5 },
  { dataMb: 3072, days: 15, usd: 9 },
  { dataMb: 5120, days: 30, usd: 13 },
  { dataMb: 10240, days: 30, usd: 21 },
  { dataMb: 20480, days: 30, usd: 33 },
  { dataMb: null, days: 10, usd: 39 },
]
