/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ReferenceItem {
  /** our canonical slug — what goes in a URL */
  slug: string
  /** the supplier's own label, shown to a human */
  label: string
  /** the supplier's code, kept for debugging; clients never send it back */
  code: string
}

export interface RouteAnswer {
  items: ReferenceItem[]
  /** the departure these destinations are reachable from, or null for the fallback */
  from: string | null
}
