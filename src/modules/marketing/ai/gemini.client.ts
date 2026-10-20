import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const TIMEOUT_MS = 60_000

const TEXT_TIMEOUT_MS = 30_000

const MAX_TEXT_TOKENS = 2048

interface IGeminiBlob {
  mimeType?: string
  mime_type?: string
  data?: string
}

interface IGeminiPart {
  text?: string
  thought?: boolean
  inlineData?: IGeminiBlob
  inline_data?: IGeminiBlob
}

interface IGeminiResponse {
  candidates?: Array<{ content?: { parts?: IGeminiPart[] }, finishReason?: string }>
  promptFeedback?: { blockReason?: string }
}

export interface IGeminiImage {
  mimeType: string
  data: Buffer
}

export class GeminiBusy extends BadGatewayException {}

export class GeminiBilling extends GeminiBusy {
  constructor() {
    super('Gemini needs billing on the Google project for this model')
  }
}

export const stripFence = (text: string): string =>
  text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name)

  private readonly key = process.env.GEMINI_API_KEY ?? ''

  readonly textModels = (process.env.GEMINI_TEXT_MODELS || 'gemini-3.1-flash-lite,gemini-3.5-flash-lite')
    .split(',').map(model => model.trim()).filter(Boolean)

  readonly imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1'

  get configured(): boolean {
    return Boolean(this.key)
  }

  async json<T>(system: string, prompt: string): Promise<T> {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: MAX_TEXT_TOKENS },
    }

    let parts: IGeminiPart[] | null = null
    let failure: unknown = null

    for (const model of this.textModels) {
      try {
        parts = await this.generate(model, body, TEXT_TIMEOUT_MS)
        break
      }
      catch (error) {
        failure = error

        if (!(error instanceof GeminiBusy)) throw error
      }
    }

    if (!parts) throw failure ?? new BadGatewayException('Gemini did not answer')

    const text = parts.map(part => part.text ?? '').join('')

    try {
      return JSON.parse(stripFence(text)) as T
    }
    catch {
      throw new BadGatewayException('Gemini answered with something other than JSON')
    }
  }

  async image(prompt: string, aspectRatio: string): Promise<IGeminiImage> {
    const parts = await this.generate(this.imageModel, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
    })

    const blob = parts.map(part => part.inlineData ?? part.inline_data).find(found => found?.data)

    if (!blob?.data) throw new BadGatewayException('Gemini returned no image')

    return { mimeType: blob.mimeType ?? blob.mime_type ?? 'image/png', data: Buffer.from(blob.data, 'base64') }
  }

  private async generate(model: string, body: Record<string, unknown>, timeout = TIMEOUT_MS): Promise<IGeminiPart[]> {
    if (!this.key) throw new ServiceUnavailableException('GEMINI_API_KEY is not set')

    let response: Response

    try {
      response = await fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      })
    }
    catch (error) {
      this.logger.warn(`gemini ${model} unreachable: ${String(error)}`)
      throw new GeminiBusy('Gemini did not answer')
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')

      this.logger.warn(`gemini ${model} ${response.status}: ${detail.slice(0, 400)}`)

      if (response.status === 429 && /limit: 0\b/.test(detail)) throw new GeminiBilling()
      if (response.status === 429 || response.status >= 500) throw new GeminiBusy(`Gemini answered ${response.status}`)

      throw new BadGatewayException(`Gemini answered ${response.status}`)
    }

    const payload = await response.json() as IGeminiResponse
    const parts = (payload.candidates?.[0]?.content?.parts ?? []).filter(part => !part.thought)

    if (!parts.length) {
      const reason = payload.promptFeedback?.blockReason ?? payload.candidates?.[0]?.finishReason ?? 'empty'

      throw new BadGatewayException(`Gemini returned nothing (${reason})`)
    }

    return parts
  }
}
