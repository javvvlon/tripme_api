import { describe, expect, it } from 'vitest'
import { PasswordService } from './password.service'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('PasswordService', () => {
  const passwords = new PasswordService()

  it('verifies a password it hashed', async () => {
    const hash = await passwords.hash('correct horse battery staple')

    expect(await passwords.verify('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await passwords.hash('correct horse battery staple')

    expect(await passwords.verify('Correct horse battery staple', hash)).toBe(false)
  })

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([passwords.hash('same'), passwords.hash('same')])

    expect(a).not.toBe(b)
    expect(await passwords.verify('same', b)).toBe(true)
  })

  it('records its cost parameters in the hash, so they can be raised later', async () => {
    const [scheme, n, r, p] = (await passwords.hash('x')).split('$')

    expect(scheme).toBe('scrypt')
    expect([n, r, p]).toEqual(['32768', '8', '1'])
  })

  it('normalises unicode, so the same characters typed differently still match', async () => {
    const hash = await passwords.hash('cafépass')

    expect(await passwords.verify('cafépass', hash)).toBe(true)
  })

  it('returns false rather than throwing on a hash it did not write', async () => {
    expect(await passwords.verify('x', 'not-a-hash')).toBe(false)
    expect(await passwords.verify('x', '')).toBe(false)
    expect(await passwords.verify('x', 'bcrypt$1$2$3$4$5')).toBe(false)
  })
})
