import { CONFIRMED_ITEM, INACTIVE_ITEM } from './items/item-kinds'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type ConfirmationMode = 'warn' | 'enforce'

export const confirmationMode = (): ConfirmationMode =>
  process.env.ORDER_CONFIRMATION_RULE === 'enforce' ? 'enforce' : 'warn'

export type ConfirmationCheck = 'suppliers' | 'contract' | 'deposit' | 'passport'

export interface IConfirmationItem {
  title: string
  kind: string
  status: string
  required: boolean
}

export interface IConfirmationFacts {
  items: IConfirmationItem[]
  contractSignedAt: Date | null
  depositMet: boolean
  receivedUzs: number
  depositUzs: number
  legacyPaid: boolean
  passportExpiresAt: string | null
  passportProblem: 'expired' | 'short' | null
}

export interface IConfirmation {
  suppliers: { ok: boolean, pending: string[] }
  contract: { ok: boolean, signed_at: string | null }
  deposit: { ok: boolean, received_uzs: number, deposit_uzs: number, legacy: boolean }
  passport: { ok: boolean, problem: 'missing' | 'expired' | 'short' | null }
  missing: ConfirmationCheck[]
  ready: boolean
  mode: ConfirmationMode
}

export function confirmationOf(facts: IConfirmationFacts, mode: ConfirmationMode = confirmationMode()): IConfirmation {
  const pending = facts.items
    .filter(item => item.required && !INACTIVE_ITEM.includes(item.status) && !CONFIRMED_ITEM.includes(item.status))
    .map(item => item.title || item.kind)

  const passportProblem = facts.passportExpiresAt ? facts.passportProblem : 'missing'

  const checks: Record<ConfirmationCheck, boolean> = {
    suppliers: pending.length === 0,
    contract: facts.contractSignedAt !== null,
    deposit: facts.legacyPaid || facts.depositMet,
    passport: passportProblem === null,
  }

  const missing = (Object.keys(checks) as ConfirmationCheck[]).filter(key => !checks[key])

  return {
    suppliers: { ok: checks.suppliers, pending },
    contract: { ok: checks.contract, signed_at: facts.contractSignedAt ? facts.contractSignedAt.toISOString() : null },
    deposit: { ok: checks.deposit, received_uzs: facts.receivedUzs, deposit_uzs: facts.depositUzs, legacy: facts.legacyPaid },
    passport: { ok: checks.passport, problem: passportProblem },
    missing,
    ready: missing.length === 0,
    mode,
  }
}

const OPEN_STATUSES = ['draft', 'requested']

export function advanceTarget(
  status: string,
  confirmation: IConfirmation,
  passportProblem: 'expired' | 'short' | null,
): 'requested' | 'confirmed' | null {
  if (!OPEN_STATUSES.includes(status) || !confirmation.suppliers.ok) return null

  const confirmable = passportProblem === null && (confirmation.mode !== 'enforce' || confirmation.ready)

  if (confirmable) return 'confirmed'

  return status === 'draft' ? 'requested' : null
}
