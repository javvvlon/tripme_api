import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OPERATOR_CONNECTIONS, OperatorConnection, OperatorEntity } from './operator.entity'

export interface IOperatorPayload {
  uuid: string
  slug: string
  name: string
  is_enabled: boolean
  connection: string
  site_url: string
  api_base_url: string
  api_login: string
  has_api_key: boolean
  has_api_secret: boolean
  note: string
  position: number
  updated_at: string
}

export interface IOperatorPatch {
  name?: string
  is_enabled?: boolean
  connection?: string
  site_url?: string
  api_base_url?: string
  api_login?: string
  api_key?: string
  api_secret?: string
  note?: string
}

const text = (value: unknown, limit = 240): string =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(OperatorEntity)
    private readonly operators: Repository<OperatorEntity>,
  ) {}

  async list(): Promise<IOperatorPayload[]> {
    const rows = await this.operators
      .createQueryBuilder('o')
      .addSelect(['o.apiKey', 'o.apiSecret'])
      .orderBy('o.position', 'ASC')
      .getMany()

    return rows.map(row => this.toPayload(row))
  }

  async enabledSlugs(): Promise<string[]> {
    const rows = await this.operators.find({ where: { isEnabled: true }, select: { slug: true } })

    return rows.map(row => row.slug)
  }

  async patch(id: string, input: IOperatorPatch): Promise<IOperatorPayload> {
    const operator = await this.operators
      .createQueryBuilder('o')
      .addSelect(['o.apiKey', 'o.apiSecret'])
      .where('o.id = :id', { id })
      .getOne()

    if (!operator) throw new NotFoundException('Operator not found')

    if (input.connection !== undefined) {
      if (!OPERATOR_CONNECTIONS.includes(input.connection as OperatorConnection)) {
        throw new BadRequestException('Unknown connection type')
      }

      operator.connection = input.connection
    }

    if (input.name !== undefined) operator.name = text(input.name, 120) || operator.name
    if (input.is_enabled !== undefined) operator.isEnabled = Boolean(input.is_enabled)
    if (input.site_url !== undefined) operator.siteUrl = text(input.site_url, 500)
    if (input.api_base_url !== undefined) operator.apiBaseUrl = text(input.api_base_url, 500)
    if (input.api_login !== undefined) operator.apiLogin = text(input.api_login, 200)
    if (input.note !== undefined) operator.note = text(input.note, 2000)

    if (input.api_key !== undefined) {
      operator.apiKey = input.api_key === null ? '' : (text(input.api_key, 500) || operator.apiKey)
    }

    if (input.api_secret !== undefined) {
      operator.apiSecret = input.api_secret === null ? '' : (text(input.api_secret, 500) || operator.apiSecret)
    }

    operator.updatedAt = new Date()

    await this.operators.save(operator)

    return this.toPayload(operator)
  }

  private toPayload(row: OperatorEntity): IOperatorPayload {
    return {
      uuid: row.id,
      slug: row.slug,
      name: row.name,
      is_enabled: row.isEnabled,
      connection: row.connection,
      site_url: row.siteUrl,
      api_base_url: row.apiBaseUrl,
      api_login: row.apiLogin,
      has_api_key: Boolean(row.apiKey),
      has_api_secret: Boolean(row.apiSecret),
      note: row.note,
      position: row.position,
      updated_at: row.updatedAt.toISOString(),
    }
  }
}
