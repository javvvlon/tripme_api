import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ContactService } from './contact.service'
import type { IContactInput } from './contact.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(200)
  submit(@Body() body: IContactInput) {
    return this.contact.submit(body)
  }
}
