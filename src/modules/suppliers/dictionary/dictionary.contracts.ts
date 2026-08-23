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
  /**
   * False when this list was harvested under a different departure and has not
   * been re-checked for the requested one. The UI may still show it; it must
   * not promise it.
   */
  verified: boolean
  harvestedFor: string
}
