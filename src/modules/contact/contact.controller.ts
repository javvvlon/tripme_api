import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { OptionalAuthGuard } from '~/modules/auth/guards/optional-auth.guard'
import { CurrentUser } from '~/modules/auth/decorators'
import { ContactService } from './contact.service'
import type { IContactInput } from './contact.service'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(OptionalAuthGuard)
  submit(@Body() body: IContactInput, @CurrentUser() claims?: IAccessTokenClaims) {
    return this.contact.submit(body, claims?.sub ?? null)
  }
}
