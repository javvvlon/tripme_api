import { parse } from 'node-html-parser'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export interface IPostLink {
  channel: string
  id: number
  url: string
}

export interface IEmbeddedPost {
  text: string
  origin: string
  imageUrl: string
}

const PUBLIC_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{3,31})\/(\d{1,9})(?:[/?#]\S*)?$/i

const PRIVATE_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/c\/\d+\/\d+/i

const BACKGROUND = /background-image:\s*url\('([^']+)'\)/

export function postLinkOf(text: string): IPostLink | null {
  const match = PUBLIC_LINK.exec(text.trim())

  if (!match) return null

  const [, channel, id] = match as unknown as [string, string, string]

  return { channel, id: Number(id), url: `https://t.me/${channel}/${id}` }
}

export const isPrivateLink = (text: string): boolean => PRIVATE_LINK.test(text.trim())

export const embedUrl = (link: IPostLink): string => `https://t.me/${link.channel}/${link.id}?embed=1&mode=tme`

export function embeddedPostOf(html: string): IEmbeddedPost {
  const root = parse(html)
  const body = root.querySelector('.tgme_widget_message_text')

  body?.querySelectorAll('br').forEach(br => br.replaceWith('\n'))

  const owner = root.querySelector('.tgme_widget_message_owner_name')?.text.trim() ?? ''
  const forwarded = root.querySelector('.tgme_widget_message_forwarded_from_name')?.text.trim() ?? ''
  const style = root.querySelector('.tgme_widget_message_photo_wrap')?.getAttribute('style')
    ?? root.querySelector('.tgme_widget_message_video_thumb')?.getAttribute('style')
    ?? ''
  const imageUrl = BACKGROUND.exec(style)?.[1] ?? ''

  return {
    text: (body?.text ?? '').replace(/\n{3,}/g, '\n\n').trim(),
    origin: forwarded || owner,
    imageUrl: imageUrl.startsWith('https://') ? imageUrl : '',
  }
}
