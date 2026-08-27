/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ReferenceItem {
  slug: string
  label: string
  code: string
}

export interface RouteAnswer {
  items: ReferenceItem[]
  from: string | null
}
