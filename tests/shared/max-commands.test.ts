import { describe, expect, it } from 'vitest'
import {
  FILE_ATTACHED,
  MAX_HELP,
  MAX_WELCOME,
  MAX_DENIED,
  NO_DEAL,
  UNKNOWN_COMMAND,
  WRITTEN,
  dealCreatedReply,
  dealFieldsReply,
  withDealId,
  maxSenderAllowed,
  parseMaxAllowList,
  planMaxMessage,
} from '#shared/max-commands'

describe('planMaxMessage', () => {
  it('shows help for ? and /', () => {
    for (const text of ['?', '/', '  ?  ']) {
      expect(planMaxMessage(text, false, false)).toEqual({ replyNow: MAX_HELP })
    }
    expect(MAX_HELP).toMatch(/Н:/)
    expect(MAX_HELP).toMatch(/Сумма:/)
    expect(MAX_HELP).toMatch(/Дата начала:/)
    expect(MAX_HELP).toMatch(/Дата завершения:/)
    expect(MAX_HELP).toMatch(/Клиент:/)
    expect(MAX_HELP).toMatch(/ID:/)
    expect(MAX_WELCOME.startsWith('Здравствуйте.')).toBe(true)
    expect(MAX_WELCOME).toContain(MAX_HELP)
  })

  it('opens a deal by ID: and shows its fields', () => {
    expect(planMaxMessage('ID: 14', false, true)).toEqual({ open: { id: '14' } })
    expect(planMaxMessage('id:14', false, false)).toEqual({ open: { id: '14' } })
    expect(planMaxMessage('ID:', false, true)).toEqual({ replyNow: 'ID сделки — число' })
    expect(planMaxMessage('ID: нет', false, true)).toEqual({ replyNow: 'ID сделки — число' })
    expect(dealFieldsReply({
      id: '14',
      title: 'Скважина',
      amount: '50000',
      begin: '2026-09-23',
      close: '2026-09-30',
      client: 'Иван',
      files: [{ name: 'act.pdf' }, { name: 'photo.jpg' }],
    })).toBe([
      '№:14',
      'Н: Скважина',
      'С: 50000',
      'Дн: 23.09.2026',
      'Дз: 30.09.2026',
      'К: Иван',
      'Файлы:',
      '• act.pdf',
      '• photo.jpg',
    ].join('\n'))
    expect(dealFieldsReply({
      id: '14',
      title: 'Скважина',
      amount: '50000',
      begin: '2026-09-23',
      close: '2026-09-30',
      client: 'Иван',
    })).toContain('Файлы: —')
  })

  it('creates a deal from Н: and Новая:, case-insensitive', () => {
    expect(planMaxMessage('Н: Скважина 12', false, false)).toEqual({
      create: { title: 'Скважина 12', reply: 'created' },
    })
    expect(planMaxMessage('новая:Объект', true, true)).toEqual({
      create: { title: 'Объект', reply: 'created' },
      attach: true,
    })
    expect(planMaxMessage('Н:', false, true)).toEqual({ replyNow: 'Пустое название' })
  })

  it('writes the amount, or creates a deal when none is active', () => {
    expect(planMaxMessage('С: 1 500,50', false, true)).toEqual({
      patch: { opportunity: 1500.5 },
    })
    expect(planMaxMessage('сумма:100', false, false)).toEqual({
      create: { title: '100', opportunity: 100, reply: 'written' },
    })
    expect(planMaxMessage('С: нет', false, true)).toEqual({
      replyNow: 'Сумма должна быть числом',
    })
  })

  it('writes begin and close dates only onto an active deal', () => {
    expect(planMaxMessage('Дн: 22.09.2026', false, true)).toEqual({
      patch: { begin: '2026-09-22' },
    })
    expect(planMaxMessage('д1: 1.9.26', false, true)).toEqual({
      patch: { begin: '2026-09-01' },
    })
    expect(planMaxMessage('Дата начала: 2026-09-22', false, true)).toEqual({
      patch: { begin: '2026-09-22' },
    })
    expect(planMaxMessage('Дз: 31.12.2026', false, true)).toEqual({
      patch: { close: '2026-12-31' },
    })
    expect(planMaxMessage('Д2: 31.12.2026', true, true)).toEqual({
      patch: { close: '2026-12-31' },
      attach: true,
    })
    expect(planMaxMessage('дата завершения: 2026-12-31', false, true)).toEqual({
      patch: { close: '2026-12-31' },
    })
    expect(planMaxMessage('Дн: 22.09.2026', false, false)).toEqual({ replyNow: NO_DEAL })
    expect(planMaxMessage('Дз: 31.02.2026', false, true)).toEqual({
      replyNow: 'Дата должна быть в виде ДД.ММ.ГГГГ',
    })
  })

  it('sets the deal client from К: and Клиент:', () => {
    expect(planMaxMessage('К: Иван Петров', false, true)).toEqual({
      client: { name: 'Иван Петров' },
    })
    expect(planMaxMessage('клиент:Анна', true, true)).toEqual({
      client: { name: 'Анна' },
      attach: true,
    })
    expect(planMaxMessage('К:', false, true)).toEqual({ replyNow: 'Пустое имя клиента' })
    expect(planMaxMessage('К: Иван', false, false)).toEqual({ replyNow: NO_DEAL })
  })

  it('parses a MAX allow list and matches id or username', () => {
    expect(parseMaxAllowList('@Ivan, 100500\nhttps://max.ru/Petr')).toEqual(['ivan', '100500', 'petr'])
    expect(parseMaxAllowList('100500, 100500, @IVAN')).toEqual(['100500', 'ivan'])
    expect(maxSenderAllowed(false, '', { userId: '5' })).toBe(true)
    expect(maxSenderAllowed(true, '100500', { userId: '100500', username: 'nope' })).toBe(true)
    expect(maxSenderAllowed(true, '@Ivan', { userId: '5', username: 'ivan' })).toBe(true)
    expect(maxSenderAllowed(true, '100', { userId: '5', username: 'x' })).toBe(false)
    expect(maxSenderAllowed(true, '', { userId: '5' })).toBe(false)
    expect(MAX_DENIED).toBe('Нет прав писать в этот бот.')
  })

  it('attaches a file to the active deal', () => {
    expect(planMaxMessage('', true, true)).toEqual({ attach: true })
    expect(planMaxMessage('  ', true, false)).toEqual({ replyNow: NO_DEAL })
    expect(planMaxMessage('смотри фото', true, true)).toEqual({
      attach: true,
      note: UNKNOWN_COMMAND,
    })
  })

  it('hints on an unknown command', () => {
    expect(planMaxMessage('привет', false, true)).toEqual({ replyNow: UNKNOWN_COMMAND })
    expect(UNKNOWN_COMMAND.startsWith('Не понял команду.')).toBe(true)
    expect(UNKNOWN_COMMAND).toContain(MAX_HELP)
    expect(planMaxMessage('смотри фото', true, false).replyNow).toContain(MAX_HELP)
    expect(planMaxMessage('смотри фото', true, false).replyNow).toContain(NO_DEAL)
  })

  it('formats the deal reply', () => {
    expect(dealCreatedReply(41)).toBe('Сделка создана №:41')
    expect(withDealId('Записано', 41)).toBe('Записано №:41')
    expect(withDealId('Сделка создана №:41', 41)).toBe('Сделка создана №:41')
    expect(withDealId('Записано', null)).toBe('Записано')
    expect(WRITTEN).toBe('Записано')
    expect(FILE_ATTACHED).toBe('Файл прикреплён')
  })
})
