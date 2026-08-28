import { Controller, Get, Param, Query } from '@nestjs/common'
import { PostsService } from './posts.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const take = Number(limit)

    return this.posts.published(Number.isFinite(take) && take > 0 ? Math.min(take, 50) : 12)
  }

  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.posts.bySlug(slug)
  }
}
