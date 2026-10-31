import { describe, expect, it } from 'vitest'
import { DEFAULT_SIZE, IMAGE_ASK, MAX_IMAGES, MAX_SIDE, closestRatio, generationPrompt, imageSizeFor, imageSpecOf } from './image.studio'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
describe('TripMe AI image sizes', () => {
  it('picks the closest aspect ratio the model supports', () => {
    expect(closestRatio(1920, 1080)).toBe('16:9')
    expect(closestRatio(1920, 765)).toBe('21:9')
    expect(closestRatio(1080, 1920)).toBe('9:16')
    expect(closestRatio(1080, 1350)).toBe('4:5')
    expect(closestRatio(1080, 1080)).toBe('1:1')
    expect(closestRatio(1600, 900)).toBe('16:9')
    expect(closestRatio(1280, 720)).toBe('16:9')
  })

  it('asks for enough resolution for the target size', () => {
    expect(imageSizeFor(1024, 1024)).toBe('1K')
    expect(imageSizeFor(1920, 765)).toBe('2K')
    expect(imageSizeFor(3840, 2160)).toBe('4K')
  })
})

describe('TripMe AI image spec', () => {
  it('keeps exact sizes and clamps the rest', () => {
    expect(imageSpecOf({ prompt: 'leaves', width: 1920, height: 765, count: 2 })).toMatchObject({ width: 1920, height: 765, count: 2, format: 'jpeg' })
    expect(imageSpecOf({ prompt: 'leaves', width: '1 920', height: '765px' })).toMatchObject({ width: 1920, height: 765 })
    expect(imageSpecOf({ prompt: 'leaves', width: 99999, height: 10, count: 9 })).toMatchObject({ width: MAX_SIDE, height: 256, count: MAX_IMAGES })
    expect(imageSpecOf({ prompt: 'leaves', format: 'png' })).toMatchObject({ ...DEFAULT_SIZE, format: 'png', count: 1 })
    expect(imageSpecOf({ prompt: 'leaves', width: 1080 })).toMatchObject({ width: 1080, height: 608 })
    expect(imageSpecOf({ width: 100 })).toBeNull()
  })

  it('tells the model the frame and the exact target size', () => {
    const text = generationPrompt({ prompt: 'Palm leaf shadows on sand' }, '21:9', 1920, 765)

    expect(text).toContain('Palm leaf shadows on sand')
    expect(text).toContain('21:9')
    expect(text).toContain('1920x765')
    expect(text).toMatch(/No text/)
  })
})

describe('TripMe AI image requests', () => {
  it('recognises image requests in three languages', () => {
    expect(IMAGE_ASK.test('Сгенерируй фон с листьями для главного экрана 1920×765')).toBe(true)
    expect(IMAGE_ASK.test('Нарисуй картинку для сторис')).toBe(true)
    expect(IMAGE_ASK.test('Generate a neutral background image, 16:9')).toBe(true)
    expect(IMAGE_ASK.test('Sayt uchun rasm yarat')).toBe(true)
    expect(IMAGE_ASK.test('Bosh ekran uchun palma barglari va yumshoq yorug‘likli neytral fon yarat, 1920×765')).toBe(true)
    expect(IMAGE_ASK.test('Qorong‘i mavzu uchun monstera barglari bilan fon yarat')).toBe(true)
    expect(IMAGE_ASK.test('Telefon raqamini yozib qo‘ying va tanlov yarating')).toBe(false)
    expect(IMAGE_ASK.test('Сделай подборку по Египту на ноябрь')).toBe(false)
    expect(IMAGE_ASK.test('Напиши статью про Самарканд')).toBe(false)
  })
})
