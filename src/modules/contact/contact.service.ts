import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ContactMessageEntity } from './contact-message.entity'

export interface IContactInput {
  first_name?: string
  last_name?: string
  phone?: string
  message?: string
}

const MAX_MESSAGE = 4000

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessageEntity)
    private readonly messages: Repository<ContactMessageEntity>,
  ) {}

  async submit(input: IContactInput): Promise<{ received: boolean }> {
    const firstName = (input.first_name ?? '').trim()
    const phone = (input.phone ?? '').trim()

    if (!firstName) throw new BadRequestException('A first name is required')
    if (!phone) throw new BadRequestException('A phone number is required')

    await this.messages.save(this.messages.create({
      firstName: firstName.slice(0, 120),
      lastName: (input.last_name ?? '').trim().slice(0, 120),
      phone: phone.slice(0, 40),
      message: (input.message ?? '').trim().slice(0, MAX_MESSAGE),
    }))

    return { received: true }
  }
}
