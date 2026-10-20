import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '~/modules/auth/guards/auth.guard'
import { RolesGuard } from '~/modules/auth/guards/roles.guard'
import { CurrentUser, Roles } from '~/modules/auth/decorators'
import { UserRole } from '~/modules/auth/contracts/auth'
import type { IAccessTokenClaims } from '~/modules/auth/contracts/auth'
import { RevalidationService } from '~/shared/revalidation/revalidation.service'
import { pageRequest } from '~/shared/helpers/pagination'
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
  list(
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const request = pageRequest(page, perPage)

    return request ? this.admin.page({ q, filter, sort, dir }, request) : this.admin.list()
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.admin.one(id)
  }

  @Post()
  async create(@Body() body: IPostCreateInput, @CurrentUser() claims: IAccessTokenClaims) {
    const post = await this.admin.create(body, claims?.sub ?? null)

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
