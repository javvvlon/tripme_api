import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import { RevalidationService } from '~/shared/revalidation/revalidation.service'
import { PostsAdminService } from './posts.admin.service'
import type { IPostCreateInput, IPostInput } from './posts.admin.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Controller('cms/posts')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.Agent, UserRole.Manager, UserRole.Admin)
export class PostsAdminController {
  constructor(
    private readonly admin: PostsAdminService,
    private readonly revalidation: RevalidationService,
  ) {}

  @Get()
  list() {
    return this.admin.list()
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.admin.one(id)
  }

  @Post()
  async create(@Body() body: IPostCreateInput) {
    const post = await this.admin.create(body)

    this.revalidation.revalidate()

    return post
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: IPostInput) {
    const post = await this.admin.update(id, body)

    this.revalidation.revalidate()

    return post
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const result = await this.admin.remove(id)

    this.revalidation.revalidate()

    return result
  }
}
