import { describe, expect, it } from 'vitest'
import { blogAnswerOf, blogPrompt, imagesIn, imagesOf, markdownOf, slugOf, withImage } from './blog.assistant'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
const text = (title: string) => ({ title, excerpt: 'Коротко 🌴', badge_label: 'Гид', body: '# Заголовок\n\n<b>Лид</b>\n\n## Раздел\n\n- **Место** — описание ✨\n\n![x](http://img)' })

describe('blog assistant', () => {
  it('turns the model answer into a clean draft', () => {
    const answer = blogAnswerOf({
      intent: 'article',
      reply: 'Написал статью 🙂',
      suggestions: ['Короче'],
      article: { slug: 'Dubai With Kids!', badge_type: 'primary', translations: { ru: text('Дубай с детьми'), uz: text('Bolalar bilan Dubay'), en: { title: '', body: '' } } },
    }, 'article-x')

    expect(answer.intent).toBe('article')
    expect(answer.reply).toBe('Написал статью')
    expect(answer.article?.slug).toBe('dubai-with-kids')
    expect(answer.article?.translations.en).toBeUndefined()
    expect(answer.article?.translations.ru).toMatchObject({ title: 'Дубай с детьми', excerpt: 'Коротко', badge_label: 'Гид' })
    expect(answer.article?.translations.ru?.body).toBe('## Заголовок\n\nЛид\n\n## Раздел\n\n- **Место** — описание')
  })

  it('falls back to a reply when there is no Russian text', () => {
    const answer = blogAnswerOf({ intent: 'article', reply: 'Идеи', article: { translations: { en: text('Only English') } } }, 'article-x')

    expect(answer).toMatchObject({ intent: 'reply', article: null })
    expect(blogAnswerOf({ intent: 'hack' }, 'a').intent).toBe('reply')
  })

  it('makes safe slugs and markdown', () => {
    expect(slugOf('Шарм', 'article-1')).toBe('article-1')
    expect(slugOf('sharm-or-hurghada', 'x')).toBe('sharm-or-hurghada')
    expect(markdownOf('### Мелко\n#### Ещё')).toBe('### Мелко\n### Ещё')
  })

  it('shows existing articles and the current draft to the model', () => {
    const prompt = blogPrompt({
      text: 'Сделай короче',
      history: [{ role: 'user', text: 'Статья про Дубай' }],
      articles: [{ slug: 'sharm-or-hurghada', title: 'Шарм или Хургада', published: true }],
      draft: { slug: 'dubai', badge_type: null, translations: { ru: text('Дубай') } },
    })

    expect(prompt).toContain('Шарм или Хургада (sharm-or-hurghada)')
    expect(prompt).toContain('Current draft:')
    expect(prompt).toContain('Staff: Сделай короче')
    expect(prompt).not.toContain('wants pictures')
    expect(blogPrompt({ text: 'Статья про Бухару с фото', history: [], articles: [], draft: null })).toContain('wants pictures')
  })
})

describe('blog pictures', () => {
  const body = 'Лид.\n\n## Самарканд\n\nПервый абзац.\nЕщё строка.\n\nВторой абзац.\n\n## Бухара\n\nТекст.'

  it('puts a photo after the first paragraph of its section', () => {
    const placed = withImage(body, 1, 'https://cdn/registan.jpg', 'Регистан')

    expect(placed).toContain('Первый абзац.\nЕщё строка.\n\n![Регистан](https://cdn/registan.jpg "full")\n\nВторой абзац.')
    expect(withImage(body, 2, 'https://cdn/b.jpg', 'Бухара').trimEnd().endsWith('Текст.\n\n![Бухара](https://cdn/b.jpg "full")')).toBe(true)
    expect(withImage(body, 9, 'https://cdn/x.jpg', 'x')).toBe(body)
    expect(withImage(body, 0, 'https://cdn/x.jpg', 'x')).toBe(body)
  })

  it('reads placed photos back with their sections', () => {
    const placed = withImage(withImage(body, 1, 'https://cdn/a.jpg', 'A'), 2, 'https://cdn/b.jpg', 'B')

    expect(imagesIn(placed)).toEqual([{ section: 1, url: 'https://cdn/a.jpg', caption: 'A' }, { section: 2, url: 'https://cdn/b.jpg', caption: 'B' }])
  })

  it('keeps only usable picture plans', () => {
    const images = imagesOf([
      { section: 1, keywords: ['Регистан', 'Registan'], caption: { ru: 'Регистан [утро]', en: 'Registan' }, prompt: 'Registan square at sunrise' },
      { section: 2, keywords: [] },
      { section: -1, keywords: ['x'] },
    ])

    expect(images).toEqual([{ section: 1, keywords: ['Регистан', 'Registan'], caption: { ru: 'Регистан утро', uz: '', en: 'Registan' }, prompt: 'Registan square at sunrise' }])
  })
})
