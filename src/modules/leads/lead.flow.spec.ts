import { describe, expect, it } from 'vitest'
import { LEAD_TRANSITIONS, LeadStatus } from './lead.entity'
import { autoPath } from './lead.flow'
import type { LeadTrigger } from './lead.flow'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const TRIGGERS: LeadTrigger[] = ['taken', 'noted', 'quoted', 'ordered', 'reopened']

describe('lead auto statuses', () => {
  it('starts work on a new lead when it is taken or noted', () => {
    expect(autoPath('new', 'taken')).toEqual(['in_progress'])
    expect(autoPath('new', 'noted')).toEqual(['in_progress'])
    expect(autoPath('quote_sent', 'taken')).toEqual([])
    expect(autoPath('won', 'noted')).toEqual([])
  })

  it('marks the quote as sent only before the deal', () => {
    expect(autoPath('new', 'quoted')).toEqual(['quote_sent'])
    expect(autoPath('in_progress', 'quoted')).toEqual(['quote_sent'])
    expect(autoPath('won', 'quoted')).toEqual([])
    expect(autoPath('rejected', 'quoted')).toEqual([])
  })

  it('wins the lead when an order is created', () => {
    expect(autoPath('new', 'ordered')).toEqual(['in_progress', 'won'])
    expect(autoPath('in_progress', 'ordered')).toEqual(['won'])
    expect(autoPath('quote_sent', 'ordered')).toEqual(['won'])
    expect(autoPath('won', 'ordered')).toEqual([])
    expect(autoPath('rejected', 'ordered')).toEqual([])
  })

  it('reopens a won lead when its last order is cancelled', () => {
    expect(autoPath('won', 'reopened')).toEqual(['in_progress'])
    expect(autoPath('in_progress', 'reopened')).toEqual([])
  })

  it('never takes a step the manual transitions forbid', () => {
    for (const trigger of TRIGGERS) {
      for (const status of Object.values(LeadStatus)) {
        let at = status

        for (const next of autoPath(status, trigger)) {
          expect(LEAD_TRANSITIONS[at]).toContain(next)
          at = next
        }
      }
    }
  })
})
