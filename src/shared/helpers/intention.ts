/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export abstract class Intention<TInput extends object, TOutput = Record<string, string>> {
  public abstract toRequest(input: TInput): TOutput
}
