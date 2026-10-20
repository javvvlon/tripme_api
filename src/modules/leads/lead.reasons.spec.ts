import { describe, expect, it } from 'vitest'
import { isRejectReason, REJECT_REASONS } from './lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('refusal reasons', () => {
  it('accepts only the four reasons from the sales standard', () => {
    expect(REJECT_REASONS).toEqual(['expensive', 'bought_elsewhere', 'changed_mind', 'unreachable'])
    expect(isRejectReason('expensive')).toBe(true)
    expect(isRejectReason('Клиент передумал')).toBe(false)
    expect(isRejectReason('')).toBe(false)
  })
})
