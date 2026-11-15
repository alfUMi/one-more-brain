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
    main: 'Главное меню',
    soon: 'Скоро',
  },
  auth: {
    title: 'Вход',
    headline: 'Запишите сейчас. Вспомните вовремя.',
    heroCaption:
      'Заметки отовсюду попадают в одни входящие. Напоминания и повторения возвращают их, когда это важно.',
    demo: {
      capture: 'позвонить маме завтра в 18:00 #семья',
      reminder: 'Завтра, 18:00',
      tag: '#семья',
      pickedUp: 'Распознано из текста',
      highlightTitle: 'Вспоминать лучше, чем перечитывать',
      highlightQuote: 'Лучший способ запомнить — попытаться вспомнить, а не перечитать.',
      highlightSource: 'Расширение · 1 ч назад',
      reviewMeta: 'Повторение · карточка 2 из 4',
      reviewText:
        'Вы не поднимаетесь до уровня своих целей. Вы опускаетесь до уровня своих систем.',
      reviewForgot: 'Забыл',
      reviewGotIt: 'Помню · через 14 дней',
    },
    subtitle: 'Второй мозг, который помнит за вас.',
    email: 'Почта',
    emailPlaceholder: "you{'@'}example.com",
    sendLink: 'Прислать ссылку для входа',
    google: 'Продолжить с Google',
    or: 'или',
    checkEmail: 'Проверьте почту',
    checkEmailBody: 'Мы отправили ссылку для входа на {email}. Она действует 10 минут.',
    useAnother: 'Другая почта',
    signOut: 'Выйти',
    error: 'Что-то пошло не так. Попробуйте ещё раз.',
    footnote: 'Пароль не нужен. Впервые здесь? Та же ссылка создаст аккаунт.',
  },
  inbox: {
    title: 'Входящие',
    emptyTitle: 'Входящих пока нет',
    emptyBody: 'Сохраняйте что угодно: мысль, ссылку, цитату. Всё попадает сюда.',
    captureLabel: 'Записать мысль',
    save: 'Сохранить',
    capturePlaceholder: 'Напишите мысль… даты и #теги распознаются автоматически',
  },
} satisfies DeepStringRecord<typeof en>
