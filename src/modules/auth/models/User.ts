import { Model } from '~/shared/helpers/model'
import { AGENT_ROLES, UserRole } from '~/modules/auth/contracts/auth'
import type { IUserRaw } from '~/modules/auth/contracts/auth'
import type { UserEntity } from '~/modules/auth/entities'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IUser {
  id: string
  email: string
  passwordHash?: string
  firstName: string
  lastName: string
  phoneNumber: string
  role: UserRole
  isVerified: boolean
}

export class User extends Model<IUser> {
  protected static override mapRaw(raw: UserEntity): IUser {
    return {
      id: raw.id,
      email: raw.email,
      passwordHash: raw.passwordHash,
      firstName: raw.firstName,
      lastName: raw.lastName,
      phoneNumber: raw.phoneNumber,
      role: raw.role,
      isVerified: raw.isVerified,
    }
  }

  public isAgent(): boolean {
    return AGENT_ROLES.includes(this.get('role'))
  }

  public canSeeAllClients(): boolean {
    return this.get('role') === UserRole.Manager || this.get('role') === UserRole.Admin
  }

  public toPublic(): IUserRaw {
    return {
      id: this.get('id'),
      email: this.get('email'),
      first_name: this.get('firstName'),
      last_name: this.get('lastName'),
      phone_number: this.get('phoneNumber'),
      role: this.get('role'),
      is_verified: this.get('isVerified'),
    }
  }
}
