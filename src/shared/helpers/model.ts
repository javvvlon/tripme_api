/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export abstract class Model<M = unknown> {
  protected properties: M

  public constructor(payload: M) {
    this.properties = payload
    Object.assign(this, payload)
  }

  public get<K extends keyof M>(key: K): M[K] {
    return this.properties[key]
  }

  public toObject(): M {
    return this.properties
  }

  protected static mapRaw(raw: unknown): unknown {
    return raw
  }

  public static fromRaw<TModel extends Model, TRaw = unknown, TMapped = unknown>(
    this: new (props: TMapped) => TModel,
    raw: TRaw,
  ): TModel {
    const mapped = (this as unknown as { mapRaw: (raw: TRaw) => TMapped }).mapRaw(raw)
    return new this(mapped)
  }
}
