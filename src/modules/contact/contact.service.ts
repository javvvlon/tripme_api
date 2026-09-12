import { Injectable } from '@nestjs/common'
import { LeadsService } from '~/modules/leads/leads.service'

export interface IContactInput {
  first_name?: string
  last_name?: string
  phone?: string
  message?: string
  locale?: string
}

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class ContactService {
  constructor(private readonly leads: LeadsService) {}

  async submit(input: IContactInput, userId: string | null = null): Promise<{ received: boolean }> {
    await this.leads.submit({
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      comment: input.message,
      locale: input.locale,
      channel: 'contact',
    }, undefined, userId)

    return { received: true }
  }
}
