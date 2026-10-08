import { describe, expect, it } from 'vitest'
import { advanceTarget, confirmationOf } from './confirmation.rules'
import type { IConfirmationFacts } from './confirmation.rules'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const facts = (patch: Partial<IConfirmationFacts> = {}): IConfirmationFacts => ({
  items: [
    { title: 'ELAN HOTEL TAKSIM 3*', kind: 'package', status: 'confirmed', required: true },
    { title: 'Трансфер', kind: 'transfer', status: 'draft', required: false },
  ],
  contractSignedAt: new Date('2026-10-08T10:00:00Z'),
  depositMet: true,
  receivedUzs: 5_000_000,
  depositUzs: 4_000_000,
  legacyPaid: false,
  passportExpiresAt: '2029-01-01',
  passportProblem: null,
  ...patch,
})

describe('order confirmation rule', () => {
  it('is ready when suppliers, contract, deposit and passport are all fine', () => {
    const result = confirmationOf(facts(), 'enforce')

    expect(result.ready).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('lists required services still waiting for the supplier', () => {
    const result = confirmationOf(facts({ items: [{ title: 'Rixos', kind: 'package', status: 'requested', required: true }] }), 'enforce')

    expect(result.suppliers).toEqual({ ok: false, pending: ['Rixos'] })
    expect(result.missing).toEqual(['suppliers'])
  })

  it('ignores cancelled and optional services', () => {
    const result = confirmationOf(facts({ items: [
      { title: 'Old tour', kind: 'package', status: 'cancelled', required: true },
      { title: 'Страховка', kind: 'insurance', status: 'draft', required: false },
    ] }), 'enforce')

    expect(result.suppliers.ok).toBe(true)
  })

  it('needs a signed contract, the deposit and a valid passport', () => {
    const result = confirmationOf(facts({ contractSignedAt: null, depositMet: false, passportExpiresAt: null }), 'enforce')

    expect(result.missing).toEqual(['contract', 'deposit', 'passport'])
    expect(result.passport.problem).toBe('missing')
    expect(result.ready).toBe(false)
  })

  it('accepts orders paid before the payment log', () => {
    expect(confirmationOf(facts({ depositMet: false, legacyPaid: true }), 'enforce').deposit.ok).toBe(true)
  })

  it('reports a short passport', () => {
    expect(confirmationOf(facts({ passportProblem: 'short' }), 'warn').passport).toEqual({ ok: false, problem: 'short' })
  })
})

describe('moving the order on by itself', () => {
  const base = (over: Partial<IConfirmationFacts> = {}): IConfirmationFacts => ({
    items: [{ title: 'Rixos', kind: 'package', status: 'confirmed', required: true }],
    contractSignedAt: null,
    depositMet: false,
    receivedUzs: 0,
    depositUzs: 1000,
    legacyPaid: false,
    passportExpiresAt: null,
    passportProblem: null,
    ...over,
  })

  it('confirms the order once the supplier confirms, while the rule only warns', () => {
    expect(advanceTarget('requested', confirmationOf(base(), 'warn'), null)).toBe('confirmed')
    expect(advanceTarget('draft', confirmationOf(base(), 'warn'), null)).toBe('confirmed')
  })

  it('waits for every check when the rule is enforced', () => {
    expect(advanceTarget('requested', confirmationOf(base(), 'enforce'), null)).toBeNull()
    expect(advanceTarget('draft', confirmationOf(base(), 'enforce'), null)).toBe('requested')

    const ready = base({ contractSignedAt: new Date(), depositMet: true, passportExpiresAt: '2030-01-01' })

    expect(advanceTarget('requested', confirmationOf(ready, 'enforce'), null)).toBe('confirmed')
  })

  it('never moves without the supplier, past a bad passport, or out of a later status', () => {
    const pending = base({ items: [{ title: 'Rixos', kind: 'package', status: 'requested', required: true }] })

    expect(advanceTarget('requested', confirmationOf(pending, 'warn'), null)).toBeNull()
    expect(advanceTarget('requested', confirmationOf(base(), 'warn'), 'short')).toBeNull()
    expect(advanceTarget('draft', confirmationOf(base(), 'warn'), 'expired')).toBe('requested')
    expect(advanceTarget('issued', confirmationOf(base(), 'warn'), null)).toBeNull()
    expect(advanceTarget('cancelled', confirmationOf(base(), 'warn'), null)).toBeNull()
  })
})
