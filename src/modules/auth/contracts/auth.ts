/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */

export enum UserRole {
  Client = 'CLIENT',
  Agent = 'AGENT',
  Freelancer = 'FREELANCER',
  Manager = 'MANAGER',
  Admin = 'ADMIN',
}

export const AGENT_ROLES = [UserRole.Agent, UserRole.Freelancer, UserRole.Manager, UserRole.Admin]

export interface ILoginData {
  email: string
  password: string
}

export interface ISignupData {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber: string
  consent: boolean
}

export interface IUserRaw {
  id: string
  email: string
  first_name: string
  last_name: string
  phone_number: string
  role: UserRole
  is_verified: boolean
}

export interface ITokenPair {
  access_token: string
  refresh_token: string
}

export interface IAccessTokenClaims {
  sub: string
  email: string
  role: UserRole
}
