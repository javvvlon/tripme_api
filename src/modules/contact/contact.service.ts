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
 *
 * Someone writing in from the contact form wants the same thing as someone
 * asking about a tour: to be called back. It files a lead, so it lands on
 * the board an agent already watches.
 *
 * It used to write its own `contact_messages` row, and nothing anywhere
 * read that table — every enquiry sent through the form was invisible.
 */
@Injectable()
export class ContactService {
  constructor(private readonly leads: LeadsService) {}

  async submit(input: IContactInput): Promise<{ received: boolean }> {
    await this.leads.submit({
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      comment: input.message,
      locale: input.locale,
      channel: 'contact',
    })

    return { received: true }
  }
}
