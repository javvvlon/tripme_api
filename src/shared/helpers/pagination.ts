/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const PER_PAGE_OPTIONS = [25, 50, 100] as const

export const DEFAULT_PER_PAGE = 25

export interface IPageRequest {
  page: number
  perPage: number
  skip: number
}

export interface IPage<T, C = Record<string, number>> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
  counts: C
}

export function pageRequest(page: unknown, perPage: unknown): IPageRequest | null {
  if (page === undefined || page === null || page === '') return null

  const size = Number(perPage)
  const safeSize = PER_PAGE_OPTIONS.includes(size as never) ? size : DEFAULT_PER_PAGE
  const number = Math.max(1, Math.floor(Number(page)) || 1)

  return { page: number, perPage: safeSize, skip: (number - 1) * safeSize }
}

export function pageOf<T, C>(items: T[], total: number, request: IPageRequest, counts: C): IPage<T, C> {
  return {
    items,
    total,
    page: request.page,
    per_page: request.perPage,
    pages: Math.max(1, Math.ceil(total / request.perPage)),
    counts,
  }
}
