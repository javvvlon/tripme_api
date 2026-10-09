/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
export type MessageKind =
  | 'email_code'
  | 'phone_code'
  | 'reset_code'
  | 'order_confirmed'
  | 'order_issued'
  | 'order_cancelled'
  | 'payment_received'
  | 'service_issued'
  | 'esim_ready'
  | 'new_message'

type Locale = 'ru' | 'uz' | 'en'

type Params = Record<string, string>

const TEXTS: Record<Locale, Record<MessageKind, [string, string]>> = {
  ru: {
    email_code: ['Код подтверждения TripMe', 'Ваш код: {code}. Он действует 15 минут.'],
    phone_code: ['Код TripMe', 'TripMe: код {code} для подтверждения номера.'],
    reset_code: ['Сброс пароля TripMe', 'Код для нового пароля: {code}. Если это были не вы — просто проигнорируйте.'],
    order_confirmed: ['Заказ {ref} подтверждён', 'Туроператор подтвердил вашу бронь {ref}. Подробности: {link}'],
    order_issued: ['Документы по заказу {ref} готовы', 'Документы для поездки по заказу {ref} готовы: {link}'],
    order_cancelled: ['Заказ {ref} отменён', 'Заказ {ref} отменён. Если это неожиданно — свяжитесь с менеджером.'],
    payment_received: ['Оплата по заказу {ref} получена', 'Мы получили {amount} по заказу {ref}. Спасибо!'],
    service_issued: ['{service} готово', 'По заказу {ref} оформлено: {service}. Документ в личном кабинете: {link}'],
    esim_ready: ['Ваша eSIM готова', 'eSIM ESIM-{number} готова. QR-код и инструкция: {link}'],
    new_message: ['Новое сообщение от TripMe', 'Менеджер ответил вам в личном кабинете: {link}'],
  },
  uz: {
    email_code: ['TripMe tasdiqlash kodi', 'Kodingiz: {code}. U 15 daqiqa amal qiladi.'],
    phone_code: ['TripMe kodi', 'TripMe: raqamni tasdiqlash kodi {code}.'],
    reset_code: ['TripMe parolini tiklash', 'Yangi parol uchun kod: {code}. Agar bu siz bo\'lmasangiz — e\'tibor bermang.'],
    order_confirmed: ['{ref} buyurtma tasdiqlandi', 'Turoperator {ref} bronni tasdiqladi. Batafsil: {link}'],
    order_issued: ['{ref} buyurtma hujjatlari tayyor', '{ref} buyurtma bo\'yicha sayohat hujjatlari tayyor: {link}'],
    order_cancelled: ['{ref} buyurtma bekor qilindi', '{ref} buyurtma bekor qilindi. Savollar bo\'lsa — menejer bilan bog\'laning.'],
    payment_received: ['{ref} buyurtma to\'lovi qabul qilindi', '{ref} buyurtma bo\'yicha {amount} qabul qilindi. Rahmat!'],
    service_issued: ['{service} tayyor', '{ref} buyurtma bo\'yicha rasmiylashtirildi: {service}. Hujjat shaxsiy kabinetda: {link}'],
    esim_ready: ['eSIM tayyor', 'ESIM-{number} tayyor. QR-kod va yo\'riqnoma: {link}'],
    new_message: ['TripMe dan yangi xabar', 'Menejer shaxsiy kabinetda javob berdi: {link}'],
  },
  en: {
    email_code: ['TripMe verification code', 'Your code: {code}. It is valid for 15 minutes.'],
    phone_code: ['TripMe code', 'TripMe: your phone confirmation code is {code}.'],
    reset_code: ['TripMe password reset', 'Your code for a new password: {code}. If this was not you, ignore this message.'],
    order_confirmed: ['Order {ref} confirmed', 'The tour operator confirmed your booking {ref}. Details: {link}'],
    order_issued: ['Documents for order {ref} are ready', 'Your travel documents for order {ref} are ready: {link}'],
    order_cancelled: ['Order {ref} cancelled', 'Order {ref} was cancelled. If this is unexpected, please contact your manager.'],
    payment_received: ['Payment for order {ref} received', 'We received {amount} for order {ref}. Thank you!'],
    service_issued: ['{service} is ready', 'Issued for order {ref}: {service}. The document is in your account: {link}'],
    esim_ready: ['Your eSIM is ready', 'eSIM ESIM-{number} is ready. QR code and setup: {link}'],
    new_message: ['New message from TripMe', 'Your manager replied in your account: {link}'],
  },
}

const fill = (template: string, params: Params): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? '')

export function messageText(kind: MessageKind, locale: string, params: Params = {}): { subject: string, text: string } {
  const texts = TEXTS[(['ru', 'uz', 'en'].includes(locale) ? locale : 'ru') as Locale]
  const [subject, text] = texts[kind]

  return { subject: fill(subject, params), text: fill(text, params) }
}

export function threadText(kind: MessageKind, locale: string, params: Params = {}): string {
  const texts = TEXTS[(['ru', 'uz', 'en'].includes(locale) ? locale : 'ru') as Locale]
  const withoutLink = texts[kind][1].replace(/\s*[^.!?]*\{link\}[^.!?]*[.!?]?/, '').trim()

  return fill(withoutLink, params)
}
