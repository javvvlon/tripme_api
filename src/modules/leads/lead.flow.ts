import { LeadStatus } from './lead.entity'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type LeadTrigger = 'taken' | 'noted' | 'quoted' | 'ordered' | 'reopened'

const AUTO_PATHS: Record<LeadTrigger, Partial<Record<LeadStatus, LeadStatus[]>>> = {
  taken: {
    [LeadStatus.New]: [LeadStatus.InProgress],
  },
  noted: {
    [LeadStatus.New]: [LeadStatus.InProgress],
  },
  quoted: {
    [LeadStatus.New]: [LeadStatus.QuoteSent],
    [LeadStatus.InProgress]: [LeadStatus.QuoteSent],
  },
  ordered: {
    [LeadStatus.New]: [LeadStatus.InProgress, LeadStatus.Won],
    [LeadStatus.InProgress]: [LeadStatus.Won],
    [LeadStatus.QuoteSent]: [LeadStatus.Won],
  },
  reopened: {
    [LeadStatus.Won]: [LeadStatus.InProgress],
  },
}

export const autoPath = (status: string, trigger: LeadTrigger): LeadStatus[] =>
  AUTO_PATHS[trigger][status as LeadStatus] ?? []
