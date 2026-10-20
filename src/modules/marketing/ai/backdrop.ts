/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export const BACKDROP_RATIO = '9:16'

export const BACKDROP_FOLDER = 'Маркетинг'

const MOODS = [
  'golden hour, warm low sun',
  'soft morning light, clear sky',
  'blue hour, the first city lights coming on',
  'bright midday summer light, deep blue sky',
]

export function backdropPrompt(destination: string, resorts: string[], variant: number): string {
  const place = [resorts.join(', '), destination].filter(Boolean).join(' — ')
  const mood = MOODS[Math.abs(variant) % MOODS.length]

  return [
    `A vertical photograph for a travel advertisement: an iconic, recognisable landscape of ${place}.`,
    `Photorealistic, cinematic wide establishing shot, ${mood}, rich but natural colour, sharp detail.`,
    'Leave calm, uncluttered space in the upper third and the lower half, because text will be laid over it.',
    'Strictly no text, letters, numbers, signs, logos, watermarks or frames anywhere in the image.',
    'No close-up people and no recognisable faces. Do not depict any specific hotel building.',
  ].join(' ')
}

export const backdropTitle = (destination: string): string =>
  `Фон · ${destination}`.slice(0, 120)
