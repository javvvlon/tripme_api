import { Injectable } from '@nestjs/common'
import { LeadsService } from '~/modules/leads/leads.service'

export interface IContactInput {
  first_name?: string
  last_name?: string
  phone?: string
  message?: string
  locale?: string
  consent?: boolean
  topic?: string
  category?: string
}

export const CONTACT_TOPICS: Record<string, string> = { beta: 'beta' }

export const FEEDBACK_CATEGORIES: Record<string, string> = {
  BUG: 'Техническая ошибка',
  INQUIRY: 'Вопрос по бронированию',
  IDEA: 'Идея / пожелание',
}

export function commentOf(input: IContactInput): string | undefined {
  const category = String(input.category ?? '')

  if (input.topic !== 'beta' || !Object.hasOwn(FEEDBACK_CATEGORIES, category)) return input.message

  return `[${FEEDBACK_CATEGORIES[category]}] ${input.message ?? ''}`.trim()
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class ContactService {
  constructor(private readonly leads: LeadsService) {}

  async submit(input: IContactInput, userId: string | null = null, signedIn = Boolean(userId)): Promise<{ received: boolean }> {
    await this.leads.submit({
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      comment: commentOf(input),
      locale: input.locale,
      channel: CONTACT_TOPICS[String(input.topic ?? '')] ?? 'contact',
      consent: input.consent,
    }, undefined, userId, null, signedIn)

    return { received: true }
  }
}
