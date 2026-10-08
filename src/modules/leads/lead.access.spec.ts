import { describe, expect, it } from 'vitest'
import { UserRole } from '~/modules/auth/contracts/auth'
import { canSeeLead, canSeeOrder } from './lead.access'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const agent = { id: 'a1', role: UserRole.Agent }
const boss = { id: 'm1', role: UserRole.Manager }

describe('canSeeLead', () => {
  it('shows an agent their own leads in any status', () => {
    expect(canSeeLead(agent, { managerId: 'a1', status: 'won' })).toBe(true)
    expect(canSeeLead(agent, { managerId: 'a1', status: 'rejected' })).toBe(true)
  })

  it('shows an agent unassigned leads that are still open, as a shared queue', () => {
    expect(canSeeLead(agent, { managerId: null, status: 'new' })).toBe(true)
    expect(canSeeLead(agent, { managerId: null, status: 'quote_sent' })).toBe(true)
    expect(canSeeLead(agent, { managerId: null, status: 'won' })).toBe(false)
  })

  it('hides another agent\'s leads', () => {
    expect(canSeeLead(agent, { managerId: 'a2', status: 'new' })).toBe(false)
  })

  it('shows a manager everything', () => {
    expect(canSeeLead(boss, { managerId: 'a2', status: 'won' })).toBe(true)
    expect(canSeeLead(boss, { managerId: null, status: 'rejected' })).toBe(true)
  })
})

describe('canSeeOrder', () => {
  it('shows an agent orders they manage', () => {
    expect(canSeeOrder(agent, { managerId: 'a1' }, null)).toBe(true)
  })

  it('shows an agent an unassigned order of their own lead', () => {
    expect(canSeeOrder(agent, { managerId: null }, { managerId: 'a1' })).toBe(true)
    expect(canSeeOrder(agent, { managerId: null }, { managerId: 'a2' })).toBe(false)
  })

  it('hides an order handed to someone else, even on the agent\'s lead', () => {
    expect(canSeeOrder(agent, { managerId: 'a2' }, { managerId: 'a1' })).toBe(false)
  })

  it('shows a manager every order', () => {
    expect(canSeeOrder(boss, { managerId: 'a2' }, null)).toBe(true)
  })
})
