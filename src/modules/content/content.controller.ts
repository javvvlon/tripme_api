import { Controller, Get } from '@nestjs/common'
import { ContentService } from './content.service'
import type { IHomeContentResponse } from './content.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/home')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('sections')
  async sections(): Promise<IHomeContentResponse> {
    return this.content.forPage('home')
  }
}
