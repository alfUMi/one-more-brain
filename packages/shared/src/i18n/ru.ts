import type en from './en'
import type { DeepStringRecord } from './index'

export default {
  app: { name: 'One More Brain' },
  nav: {
    inbox: 'Входящие',
    today: 'Сегодня',
    review: 'Повторение',
    library: 'Библиотека',
    settings: 'Настройки',
  },
  auth: {
    title: 'Вход',
    subtitle: 'Второй мозг, который помнит за вас.',
    email: 'Почта',
    emailPlaceholder: 'you@example.com',
    sendLink: 'Прислать ссылку для входа',
    google: 'Продолжить с Google',
    or: 'или',
    checkEmail: 'Проверьте почту',
    checkEmailBody: 'Мы отправили ссылку для входа на {email}. Она действует 10 минут.',
    useAnother: 'Другая почта',
    signOut: 'Выйти',
    error: 'Что-то пошло не так. Попробуйте ещё раз.',
  },
  inbox: {
    title: 'Входящие',
    emptyTitle: 'Входящих пока нет',
    emptyBody: 'Сохраняйте что угодно: мысль, ссылку, цитату. Всё попадает сюда.',
    capturePlaceholder: 'Напишите мысль… даты и #теги распознаются автоматически',
  },
} satisfies DeepStringRecord<typeof en>
