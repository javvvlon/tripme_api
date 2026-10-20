import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Brackets, In, IsNull } from 'typeorm'
import type { Repository } from 'typeorm'
import { LeadEntity } from '~/modules/leads/lead.entity'
import { UserEntity } from '~/modules/auth/entities'
import { SearchService } from '~/modules/search/search.service'
import { StorageService } from '~/shared/storage/storage.service'
import type { IUploadedFile } from '~/shared/storage/storage.service'
import { MediaService } from '~/shared/storage/media.service'
import { pageOf } from '~/shared/helpers/pagination'
import type { IPage, IPageRequest } from '~/shared/helpers/pagination'
import { AD_ANGLES, AD_LANGUAGES, MarketingSelectionEntity, MarketingSettingsEntity, MarketingTemplateEntity } from './selection.entity'
import type { AdInclude, AdLanguage, IAdBackground, IAdContact, IAdCopy, IAdDesign, IAdIntake, IAdPublication, IAdTour, IntakeVia } from './selection.entity'
import {
  cheapestOf, contactsOf, designOf, destinationOf, isCode, isHot, languagesOf, liveTours, MAX_BACKGROUNDS, MAX_BUTTONS, newCode,
  editedTours, includesOf, pickedContacts, resortsOf, styleOf, titleOf, toursOf,
} from './marketing.rules'
import { GeminiClient } from '~/shared/ai/gemini.client'
import { copyPrompt, DEFAULT_FOOTER, DEFAULT_VOICE, editedCopy, factsOf, fallbackCopy, fallbackVariants, systemPrompt, variantsOf, voiceOf } from './ai/copywriter'
import { BACKDROP_FOLDER, BACKDROP_RATIO, backdropPrompt, backdropTitle } from './ai/backdrop'
import { checkGroups, judge, matchOffer, settle } from './recheck'
import { mediaOf, TelegramPublisher, telegramUrl } from './telegram.publisher'
import type { IPublishFiles } from './telegram.publisher'
import { tashkentToday } from '~/modules/search/hot'
import { DEFAULT_VISUAL, templateOf, templatePrompt, templatesOf, templateSystem } from './templates'
import type { IAdTemplate } from './templates'
import { IntakeService } from './intake/intake.service'
import type { IIntakeInput } from './intake/intake.service'
import { MAX_POST_CHARS } from './intake/post'
import { postLinkOf } from './intake/link'
import { looksLikeOffer, marketingPrompt, marketingSystem } from './intake/assistant'
import { historyOf, replyOf } from '~/shared/ai/chat'
import type { IIntakeReport } from './intake/post'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface ISelectionPayload {
  id: string
  code: string
  title: string
  style: string
  tours: IAdTour[]
  copy: Partial<Record<AdLanguage, IAdCopy>>
  variants: Partial<Record<AdLanguage, IAdCopy[]>>
  design: IAdDesign
  background: IAdBackground | null
  backgrounds: IAdBackground[]
  contacts: string[]
  published: IAdPublication[]
  template: IAdTemplate | null
  template_drafts: IAdTemplate[]
  intake: IAdIntake | null
  includes: AdInclude[]
  checked_at: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  author: string
  leads: number
  ai: boolean
}

export interface IIntakeAnswer {
  selection: ISelectionPayload | null
  report: IIntakeReport
}

export type IAssistantAnswer =
  | ({ kind: 'selection' } & IIntakeAnswer)
  | { kind: 'reply', reply: string, suggestions: string[] }

export interface ISavedTemplate {
  id: string
  name: string
  spec: IAdTemplate
  author: string
  created_at: string
}

export interface ISelectionRow {
  id: string
  code: string
  title: string
  tours: number
  live: number
  from: { amount: number, currency: string } | null
  dates: { first: string, last: string } | null
  background_url: string | null
  checked_at: string | null
  created_at: string
  archived_at: string | null
  author: string
  leads: number
  published: number
}

export interface IPublicSelection {
  code: string
  title: string
  tours: IAdTour[]
  copy: Partial<Record<AdLanguage, IAdCopy>>
  background_url: string | null
  checked_at: string | null
}

export interface IMarketingSettings {
  visual: string
  default_visual: string
  custom_visual: boolean
  footer: Record<AdLanguage, string>
  default_footer: Record<AdLanguage, string>
  voice: string
  default_voice: string
  custom_voice: boolean
  contacts: IAdContact[]
  telegram: { connected: boolean, channel: string }
  ai: { text: boolean, models: string[], image_model: string }
  updated_at: string | null
}

export interface ISelectionQuery {
  q?: string
  archived?: string
}

export interface IPublishInput {
  caption?: unknown
  language?: unknown
  link?: unknown
  cta?: unknown
  width?: unknown
  height?: unknown
  duration?: unknown
}

const MAX_CODE_ATTEMPTS = 5

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

const today = (): string => tashkentToday()

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name)

  constructor(
    @InjectRepository(MarketingSelectionEntity) private readonly selections: Repository<MarketingSelectionEntity>,
    @InjectRepository(MarketingSettingsEntity) private readonly settingsRepo: Repository<MarketingSettingsEntity>,
    @InjectRepository(MarketingTemplateEntity) private readonly templates: Repository<MarketingTemplateEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly search: SearchService,
    private readonly gemini: GeminiClient,
    private readonly telegram: TelegramPublisher,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly intake: IntakeService,
  ) {}

  async create(input: { title?: unknown, tours?: unknown }, actorId: string): Promise<ISelectionPayload> {
    const tours = toursOf(input.tours)

    if (!tours.length) throw new BadRequestException('Pick at least one tour')

    return this.one(await this.make(tours, text(input.title, 120), actorId, null))
  }

  async fromPost(input: IIntakeInput, actorId: string, via: IntakeVia): Promise<IIntakeAnswer> {
    const post = input.text.trim().slice(0, MAX_POST_CHARS)

    if (post.length < 15 && !input.image && !postLinkOf(post)) throw new BadRequestException('Paste the operator\'s post or attach a screenshot')

    const result = await this.intake.run({ ...input, text: post })
    const tours = toursOf(result.tours)

    if (!tours.length) return { selection: null, report: result.report }

    const title = result.report.own ? String(tours[0]?.route_to_label ?? '') || result.facts.country : result.facts.country
    const id = await this.make(tours, title, actorId, {
      via,
      text: result.post.text.slice(0, MAX_POST_CHARS),
      origin: result.post.origin.slice(0, 120),
      link: result.post.link,
      facts: result.facts,
      report: result.report,
      at: new Date().toISOString(),
      by: actorId,
    }, includesOf(result.facts.includes))

    if (this.gemini.configured) {
      await this.write(id, {}).catch((error: unknown) => this.logger.warn(`intake copy ${id}: ${String(error)}`))
    }

    return { selection: await this.one(id), report: result.report }
  }

  async assist(input: IIntakeInput & { history?: unknown }, actorId: string): Promise<IAssistantAnswer> {
    if (looksLikeOffer(input.text, Boolean(input.image))) {
      return { kind: 'selection', ...await this.fromPost(input, actorId, 'studio') }
    }

    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const settings = await this.stored()
    const raw = await this.gemini.json<unknown>(
      marketingSystem(settings.voice.trim() || DEFAULT_VOICE),
      marketingPrompt(input.text.trim().slice(0, MAX_POST_CHARS), historyOf(input.history)),
      { temperature: 0.5 },
    )

    return { kind: 'reply', ...replyOf(raw) }
  }

  private async make(tours: IAdTour[], title: string, actorId: string, intake: IAdIntake | null, includes: AdInclude[] = []): Promise<string> {
    const facts = factsOf(tours, today())
    const settings = await this.stored()
    const copy = Object.fromEntries(AD_LANGUAGES.map(language => [language, fallbackCopy(facts, language)]))
    const variants = Object.fromEntries(AD_LANGUAGES.map(language => [language, fallbackVariants(facts, language)]))

    for (let attempt = 1; ; attempt++) {
      try {
        const saved = await this.selections.save(this.selections.create({
          code: newCode(),
          title: title || titleOf(tours),
          tours,
          copy,
          variants,
          design: {},
          contacts: settings.contacts.slice(0, MAX_BUTTONS).map(contact => contact.id),
          style: 'classic',
          background: null,
          backgrounds: [],
          published: [],
          intake,
          includes,
          checkedAt: new Date(),
          createdBy: actorId,
        }))

        return saved.id
      }
      catch (error) {
        if (!isUniqueViolation(error) || attempt >= MAX_CODE_ATTEMPTS) throw error
      }
    }
  }

  async page(query: ISelectionQuery, request: IPageRequest): Promise<IPage<ISelectionRow, { all: number, archived: number }>> {
    const archived = query.archived === '1'
    const builder = this.selections.createQueryBuilder('selection')
      .where(archived ? 'selection.archived_at is not null' : 'selection.archived_at is null')
      .orderBy('selection.created_at', 'DESC')
      .skip(request.skip)
      .take(request.perPage)

    const q = text(query.q, 80)

    if (q) {
      builder.andWhere(new Brackets((where) => {
        where.where('selection.title ilike :q', { q: `%${q}%` })
          .orWhere('selection.code = :code', { code: q.toLowerCase() })
          .orWhere(`exists (select 1 from jsonb_array_elements(selection.tours) tour where tour->>'hotel_name' ilike :q)`, { q: `%${q}%` })
      }))
    }

    const [rows, total] = await builder.getManyAndCount()
    const [all, archivedCount, leads, authors] = await Promise.all([
      this.selections.createQueryBuilder('selection').where('selection.archived_at is null').getCount(),
      this.selections.createQueryBuilder('selection').where('selection.archived_at is not null').getCount(),
      this.leadCounts(rows.map(row => row.code)),
      this.authors(rows.map(row => row.createdBy)),
    ])

    const items = rows.map((row): ISelectionRow => {
      const live = liveTours(row.tours)
      const cheapest = cheapestOf(live)
      const days = row.tours.map(tour => tour.check_in).sort()

      return {
        id: row.id,
        code: row.code,
        title: row.title,
        tours: row.tours.length,
        live: live.length,
        from: cheapest ? { amount: cheapest.price_amount, currency: cheapest.price_currency } : null,
        dates: days.length ? { first: days[0]!, last: days[days.length - 1]! } : null,
        background_url: row.background?.url ?? null,
        checked_at: row.checkedAt?.toISOString() ?? null,
        created_at: row.createdAt.toISOString(),
        archived_at: row.archivedAt?.toISOString() ?? null,
        author: authors.get(row.createdBy ?? '') ?? '',
        leads: leads.get(row.code) ?? 0,
        published: row.published?.length ?? 0,
      }
    })

    return pageOf(items, total, request, { all, archived: archivedCount })
  }

  async one(id: string): Promise<ISelectionPayload> {
    return this.present(await this.find(id))
  }

  async patch(id: string, input: Record<string, unknown>): Promise<ISelectionPayload> {
    const selection = await this.find(id)

    if (input.title !== undefined) {
      const title = text(input.title, 120)

      if (!title) throw new BadRequestException('A title is required')

      selection.title = title
    }

    if (input.style !== undefined) {
      const style = styleOf(input.style)

      if (!style || (style === 'custom' && !selection.template)) throw new BadRequestException('Unknown style')

      selection.style = style
    }

    if (input.template !== undefined) {
      const template = input.template === null ? null : templateOf(input.template)

      if (input.template !== null && !template) throw new BadRequestException('Unknown template')

      selection.template = template
      selection.style = template ? 'custom' : selection.style === 'custom' ? 'classic' : selection.style
    }

    if (input.order !== undefined) {
      if (!Array.isArray(input.order)) throw new BadRequestException('order must be a list of offer ids')

      const byId = new Map(selection.tours.map(tour => [tour.offer_id, tour]))
      const kept = input.order.map(offerId => byId.get(String(offerId))).filter((tour): tour is IAdTour => Boolean(tour))

      if (!kept.length) throw new BadRequestException('A selection needs at least one tour')

      selection.tours = [...new Map(kept.map(tour => [tour.offer_id, tour])).values()]
    }

    if (input.includes !== undefined) selection.includes = includesOf(input.includes)

    if (input.tours !== undefined) selection.tours = editedTours(input.tours, selection.tours)

    if (input.copy && typeof input.copy === 'object') {
      const changes = input.copy as Record<string, unknown>
      const copy = { ...selection.copy }

      for (const language of AD_LANGUAGES) {
        const next = editedCopy(changes[language], copy[language])

        if (next) copy[language] = next
      }

      selection.copy = copy
    }

    if (input.pick !== undefined) {
      const index = Number(input.pick)
      const copy = { ...selection.copy }

      for (const language of AD_LANGUAGES) {
        const variant = selection.variants?.[language]?.[index]

        if (variant) copy[language] = { ...variant, hashtags: [...variant.hashtags] }
      }

      selection.copy = copy
    }

    if (input.design !== undefined) selection.design = designOf(input.design, selection.design)

    if (input.contacts !== undefined) selection.contacts = pickedContacts(input.contacts, (await this.stored()).contacts)

    selection.updatedAt = new Date()
    await this.selections.save(selection)

    return this.one(id)
  }

  async setArchived(id: string, actorId: string, archived: boolean): Promise<ISelectionPayload> {
    const selection = await this.find(id)

    if (Boolean(selection.archivedAt) !== archived) {
      selection.archivedAt = archived ? new Date() : null
      selection.archivedBy = archived ? actorId : null
      selection.updatedAt = new Date()
      await this.selections.save(selection)
    }

    return this.one(id)
  }

  async recheck(id: string): Promise<ISelectionPayload> {
    const selection = await this.find(id)
    const day = today()
    const checked = new Map<string, IAdTour>()

    for (const tour of selection.tours) {
      const settled = settle(tour, day)

      if (settled) checked.set(tour.offer_id, settled)
    }

    await Promise.all(checkGroups(selection.tours, day).map(async (group) => {
      try {
        const result = await this.search.fetchPage(group.criteria, 1, AbortSignal.timeout(60_000))
        const offers = result.offers.map(offer => offer.payload())

        for (const tour of group.tours) checked.set(tour.offer_id, judge(tour, matchOffer(tour, offers), result.statuses))
      }
      catch (error) {
        this.logger.warn(`recheck ${selection.code} ${group.criteria.to} ${group.criteria.dateFrom}: ${String(error)}`)

        for (const tour of group.tours) checked.set(tour.offer_id, { ...tour, check_state: 'unknown', check_was: null })
      }
    }))

    selection.tours = selection.tours.map(tour => checked.get(tour.offer_id) ?? tour)
    selection.checkedAt = new Date()
    selection.updatedAt = new Date()
    await this.selections.save(selection)

    return this.one(id)
  }

  async write(id: string, input: { languages?: unknown }): Promise<ISelectionPayload> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const selection = await this.find(id)
    const languages = languagesOf(input.languages)
    const tours = liveTours(selection.tours).length ? liveTours(selection.tours) : selection.tours
    const facts = factsOf(tours, today())
    const settings = await this.stored()
    const raw = await this.gemini.json<Record<string, unknown>>(systemPrompt(settings.voice), copyPrompt(facts, languages))
    const variants = { ...selection.variants }
    const copy = { ...selection.copy }

    const lead = facts.hot ? AD_ANGLES.indexOf('timing') : 0

    for (const language of languages) {
      variants[language] = variantsOf(raw?.[language], facts, language)

      if (!copy[language]?.ai) copy[language] = { ...variants[language]![lead]! }
    }

    selection.variants = variants
    selection.copy = copy
    selection.updatedAt = new Date()
    await this.selections.save(selection)

    return this.one(id)
  }

  async designTemplates(id: string): Promise<ISelectionPayload> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    const selection = await this.find(id)
    const stored = await this.settingsRepo.findOne({ where: { id: 1 } })
    const saved = await this.templates.find({ where: { archivedAt: IsNull() }, select: { name: true } })
    const raw = await this.gemini.json<{ templates?: unknown }>(templateSystem(stored?.visual ?? ''), templatePrompt({
      destination: destinationOf(selection.tours) || selection.title,
      hot: isHot(selection.tours, today()),
      hotels: liveTours(selection.tours).length,
      avoid: saved.map(template => template.name),
    }))
    const drafts = templatesOf(raw?.templates)

    if (!drafts.length) throw new BadGatewayException('Gemini returned no templates')

    selection.templateDrafts = drafts
    selection.updatedAt = new Date()
    await this.selections.save(selection)

    return this.one(id)
  }

  async savedTemplates(): Promise<ISavedTemplate[]> {
    const rows = await this.templates.find({ where: { archivedAt: IsNull() }, order: { createdAt: 'DESC' }, take: 40 })
    const authors = await this.authors(rows.map(row => row.createdBy))

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      spec: templateOf(row.spec) ?? row.spec,
      author: authors.get(row.createdBy ?? '') ?? '',
      created_at: row.createdAt.toISOString(),
    }))
  }

  async saveTemplate(input: { name?: unknown, spec?: unknown }, actorId: string): Promise<ISavedTemplate[]> {
    const spec = templateOf(input.spec)

    if (!spec) throw new BadRequestException('Unknown template')

    const name = text(input.name, 24) || spec.name

    await this.templates.save(this.templates.create({ name, spec: { ...spec, name }, createdBy: actorId }))

    return this.savedTemplates()
  }

  async archiveTemplate(id: string, actorId: string): Promise<ISavedTemplate[]> {
    const template = /^[0-9a-f-]{36}$/i.test(id) ? await this.templates.findOne({ where: { id } }) : null

    if (!template) throw new NotFoundException('Template not found')

    if (!template.archivedAt) {
      template.archivedAt = new Date()
      template.archivedBy = actorId
      await this.templates.save(template)
    }

    return this.savedTemplates()
  }

  async paint(id: string): Promise<ISelectionPayload> {
    if (!this.gemini.configured) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')
    if (!this.storage.configured) throw new ServiceUnavailableException('File storage is not configured')

    const selection = await this.find(id)
    const destination = destinationOf(selection.tours) || selection.title
    const image = await this.gemini.image(backdropPrompt(destination, resortsOf(selection.tours), Date.now()), BACKDROP_RATIO)
    const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/webp' ? 'webp' : 'png'
    const stored = await this.storage.upload({
      buffer: image.data,
      mimetype: image.mimeType,
      originalname: `backdrop.${extension}`,
      size: image.data.length,
    })

    try {
      const folder = await this.media.createFolder(BACKDROP_FOLDER)

      await this.media.describe(stored.url, { title: backdropTitle(destination), folder: folder.id })
    }
    catch (error) {
      this.logger.warn(`backdrop for ${selection.code} not filed: ${String(error)}`)
    }

    this.useImage(selection, { url: stored.url, destination, model: this.gemini.imageModel, created_at: new Date().toISOString() })
    await this.selections.save(selection)

    return this.one(id)
  }

  async useBackground(id: string, input: { url?: unknown }): Promise<ISelectionPayload> {
    const selection = await this.find(id)
    const url = text(input.url, 1200)

    if (url && !this.storage.keyOf(url)) throw new BadRequestException('That URL is not a stored file')

    if (url) {
      const known = selection.backgrounds?.find(item => item.url === url)

      this.useImage(selection, known ?? { url, destination: destinationOf(selection.tours) || selection.title, model: '', created_at: new Date().toISOString() })
    }
    else {
      selection.background = null
      selection.design = designOf({ backdrop: 'scene' }, selection.design)
      selection.updatedAt = new Date()
    }

    await this.selections.save(selection)

    return this.one(id)
  }

  async publish(id: string, files: IPublishFiles, input: IPublishInput, actorId: string): Promise<ISelectionPayload> {
    if (!this.telegram.configured) throw new ServiceUnavailableException('The Telegram bot is not connected')

    const media = mediaOf(files, input)
    const selection = await this.find(id)
    const caption = typeof input.caption === 'string' ? input.caption.trim().slice(0, 4096) : ''
    const language = AD_LANGUAGES.includes(input.language as AdLanguage) ? input.language as AdLanguage : 'ru'
    const link = text(input.link, 300)

    if (!caption) throw new BadRequestException('The post needs a text')

    const settings = await this.stored()
    const design = designOf({}, selection.design)
    const withLink = design.buttons === 'both' || design.buttons === 'link'
    const withManagers = design.buttons === 'both' || design.buttons === 'managers'
    const managers = (withManagers ? selection.contacts : [])
      .map(contactId => settings.contacts.find(contact => contact.id === contactId))
      .filter((contact): contact is IAdContact => Boolean(contact))
    const buttons = [
      ...(withLink && link.startsWith('https://') ? [{ text: text(input.cta, 40) || selection.copy[language]?.cta || 'TripMe', url: link }] : []),
      ...managers.map(contact => ({ text: contact.name, url: telegramUrl(contact.telegram) })),
    ]

    const messageId = await this.telegram.publish(media, caption, buttons)

    selection.published = [
      { at: new Date().toISOString(), channel: this.telegram.channel, message_id: messageId, language, by: actorId, kind: media.kind },
      ...(selection.published ?? []),
    ].slice(0, 20)
    selection.updatedAt = new Date()
    await this.selections.save(selection)

    return this.one(id)
  }

  async settings(): Promise<IMarketingSettings> {
    const stored = await this.settingsRepo.findOne({ where: { id: 1 } })

    return {
      visual: stored?.visual || DEFAULT_VISUAL,
      default_visual: DEFAULT_VISUAL,
      custom_visual: Boolean(stored?.visual),
      footer: { ru: stored?.footer || DEFAULT_FOOTER.ru, uz: stored?.footerUz || DEFAULT_FOOTER.uz },
      default_footer: DEFAULT_FOOTER,
      voice: stored?.voice || DEFAULT_VOICE,
      default_voice: DEFAULT_VOICE,
      custom_voice: Boolean(stored?.voice),
      contacts: stored?.contacts ?? [],
      telegram: { connected: this.telegram.configured, channel: this.telegram.configured ? this.telegram.channel : '' },
      ai: { text: this.gemini.configured, models: this.gemini.textModels, image_model: this.gemini.imageModel },
      updated_at: stored?.updatedAt?.toISOString() ?? null,
    }
  }

  async saveSettings(input: { voice?: unknown, contacts?: unknown, footer?: unknown, visual?: unknown }, actorId: string): Promise<IMarketingSettings> {
    const stored = await this.settingsRepo.findOne({ where: { id: 1 } }) ?? this.settingsRepo.create({ id: 1, voice: '', footer: '', footerUz: '', visual: '', contacts: [] })

    if (input.visual !== undefined) {
      const visual = voiceOf(input.visual)

      stored.visual = visual === DEFAULT_VISUAL ? '' : visual
    }

    if (input.footer && typeof input.footer === 'object') {
      const footer = input.footer as Record<string, unknown>
      const clean = (value: unknown, fallback: string): string => {
        const next = typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, 600) : ''

        return next === fallback ? '' : next
      }

      if (footer.ru !== undefined) stored.footer = clean(footer.ru, DEFAULT_FOOTER.ru)
      if (footer.uz !== undefined) stored.footerUz = clean(footer.uz, DEFAULT_FOOTER.uz)
    }

    if (input.voice !== undefined) {
      const voice = voiceOf(input.voice)

      stored.voice = voice === DEFAULT_VOICE ? '' : voice
    }

    if (input.contacts !== undefined) stored.contacts = contactsOf(input.contacts)

    stored.updatedAt = new Date()
    stored.updatedBy = actorId
    await this.settingsRepo.save(stored)

    return this.settings()
  }

  async publicView(code: string): Promise<IPublicSelection> {
    const normalized = code.trim().toLowerCase()

    if (!isCode(normalized)) throw new NotFoundException('Selection not found')

    const selection = await this.selections.findOne({ where: { code: normalized } })

    if (!selection || selection.archivedAt) throw new NotFoundException('Selection not found')

    const tours = liveTours(selection.tours)
      .filter(tour => tour.check_in >= today())
      .map((tour) => {
        const shown = { ...tour }

        delete shown.check_state
        delete shown.check_was

        return shown
      })

    return {
      code: selection.code,
      title: selection.title,
      tours,
      copy: selection.copy,
      background_url: designOf({}, selection.design).backdrop === 'photo' ? selection.background?.url ?? null : null,
      checked_at: selection.checkedAt?.toISOString() ?? null,
    }
  }

  private useImage(selection: MarketingSelectionEntity, image: IAdBackground): void {
    selection.background = image
    selection.backgrounds = [image, ...(selection.backgrounds ?? []).filter(item => item.url !== image.url)].slice(0, MAX_BACKGROUNDS)
    selection.design = designOf({ backdrop: 'photo' }, selection.design)
    selection.updatedAt = new Date()
  }

  private async stored(): Promise<{ voice: string, contacts: IAdContact[] }> {
    const stored = await this.settingsRepo.findOne({ where: { id: 1 } })

    return { voice: stored?.voice ?? '', contacts: stored?.contacts ?? [] }
  }

  private async find(id: string): Promise<MarketingSelectionEntity> {
    const selection = /^[0-9a-f-]{36}$/i.test(id) ? await this.selections.findOne({ where: { id } }) : null

    if (!selection) throw new NotFoundException('Selection not found')

    return selection
  }

  private async present(selection: MarketingSelectionEntity): Promise<ISelectionPayload> {
    const [leads, authors] = await Promise.all([
      this.leadCounts([selection.code]),
      this.authors([selection.createdBy]),
    ])

    return {
      id: selection.id,
      code: selection.code,
      title: selection.title,
      style: selection.style,
      tours: selection.tours,
      copy: selection.copy,
      variants: selection.variants ?? {},
      design: designOf({}, selection.design),
      background: selection.background,
      backgrounds: selection.backgrounds ?? [],
      contacts: selection.contacts ?? [],
      published: selection.published ?? [],
      template: selection.template ? templateOf(selection.template) : null,
      template_drafts: templatesOf(selection.templateDrafts),
      intake: selection.intake ?? null,
      includes: selection.includes ?? [],
      checked_at: selection.checkedAt?.toISOString() ?? null,
      created_at: selection.createdAt.toISOString(),
      updated_at: selection.updatedAt.toISOString(),
      archived_at: selection.archivedAt?.toISOString() ?? null,
      author: authors.get(selection.createdBy ?? '') ?? '',
      leads: leads.get(selection.code) ?? 0,
      ai: this.gemini.configured,
    }
  }

  private async leadCounts(codes: string[]): Promise<Map<string, number>> {
    if (!codes.length) return new Map()

    const rows = await this.leads.createQueryBuilder('lead')
      .select(`lead.trip->>'campaign'`, 'code')
      .addSelect('count(*)', 'count')
      .where(`lead.trip->>'campaign' in (:...codes)`, { codes })
      .groupBy(`lead.trip->>'campaign'`)
      .getRawMany<{ code: string, count: string }>()

    return new Map(rows.map(row => [row.code, Number(row.count)]))
  }

  private async authors(ids: Array<string | null>): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]

    if (!wanted.length) return new Map()

    const users = await this.users.find({ where: { id: In(wanted) }, select: { id: true, firstName: true, lastName: true } })

    return new Map(users.map(user => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ')]))
  }
}
