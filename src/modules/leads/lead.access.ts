import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { LeadStatus } from './lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IViewer {
  id: string
  role: UserRole
}

export const SEES_EVERYONE: UserRole[] = [UserRole.Manager, UserRole.Admin]

export const STAFF_ROLES: UserRole[] = [UserRole.Agent, UserRole.Manager, UserRole.Admin]

export const QUEUE_STATUSES: string[] = [LeadStatus.New, LeadStatus.InProgress, LeadStatus.QuoteSent]

export const viewerOf = (claims: IAccessTokenClaims): IViewer => ({ id: claims.sub, role: claims.role })

export const seesEveryone = (viewer: IViewer): boolean => SEES_EVERYONE.includes(viewer.role)

export const canSeeLead = (viewer: IViewer, lead: { managerId: string | null, status: string }): boolean =>
  seesEveryone(viewer)
  || lead.managerId === viewer.id
  || (lead.managerId === null && QUEUE_STATUSES.includes(lead.status))

export const canSeeOrder = (
  viewer: IViewer,
  order: { managerId: string | null },
  lead: { managerId: string | null } | null,
): boolean =>
  seesEveryone(viewer)
  || order.managerId === viewer.id
  || (order.managerId === null && lead?.managerId === viewer.id)
