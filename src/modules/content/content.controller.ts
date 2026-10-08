import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ContentService } from './content.service'
import { isPage } from './content.blocks'
import type { IPageContentResponse } from './content.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('home/sections')
  async home(): Promise<IPageContentResponse> {
    return this.content.forPage('home')
  }

  @Get('pages/:page')
  async page(@Param('page') page: string): Promise<IPageContentResponse> {
    if (!isPage(page)) throw new NotFoundException('No such page')

    return this.content.forPage(page)
  }
}
