import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Injectable } from '@nestjs/common'

const scryptAsync = promisify(scrypt) as (
  password: string, salt: Buffer, keylen: number,
  options: { N: number, r: number, p: number, maxmem: number },
) => Promise<Buffer>

const maxmemFor = (N: number, r: number): number => 256 * N * r

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class PasswordService {
  private readonly params = { N: 2 ** 15, r: 8, p: 1 }
  private readonly keyLength = 64

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16)
    const { N, r: blockSize } = this.params
    const derived = await scryptAsync(password.normalize('NFKC'), salt, this.keyLength, {
      ...this.params,
      maxmem: maxmemFor(N, blockSize),
    })

    const { r, p } = this.params
    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${derived.toString('base64')}`
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, key] = stored.split('$')

    if (scheme !== 'scrypt' || !salt || !key) return false

    const expected = Buffer.from(key, 'base64')

    const derived = await scryptAsync(
      password.normalize('NFKC'),
      Buffer.from(salt, 'base64'),
      expected.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: maxmemFor(Number(n), Number(r)),
      },
    )

    return derived.length === expected.length && timingSafeEqual(derived, expected)
  }
}
