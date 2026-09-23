import { describe, expect, it } from 'vitest'
import { NO_DEAL } from '#shared/max-commands'
import { planMiniappForm } from '#shared/miniapp-form'

const empty = {
  title: '',
  amount: '',
  begin: '',
  close: '',
  client: '',
  categoryId: '',
  loadedCategoryId: '',
  hasFile: false,
}

describe('planMiniappForm', () => {
  it('creates a deal from the title when none is active', () => {
    expect(planMiniappForm({ ...empty, title: 'Скважина 12' }, false)).toEqual({
      create: { title: 'Скважина 12' },
    })
  })

  it('updates the title of the active deal', () => {
    expect(planMiniappForm({ ...empty, title: 'Новое имя' }, true)).toEqual({
      patch: { title: 'Новое имя' },
    })
  })

  it('starts a new deal when asked, even if one is active', () => {
    expect(planMiniappForm({ ...empty, title: 'Вторая', begin: '22.09.2026' }, true, true)).toEqual({
      create: { title: 'Вторая' },
      patch: { begin: '2026-09-22' },
    })
    expect(planMiniappForm({ ...empty, amount: '10' }, true, true)).toEqual({
      error: 'Пустое название',
    })
  })

  it('rejects an empty form', () => {
    expect(planMiniappForm(empty, true)).toEqual({ error: 'Нечего записывать' })
    expect(planMiniappForm({ ...empty, title: '   ' }, false)).toEqual({ error: 'Нечего записывать' })
  })

  it('creates with title and amount together, otherwise amount follows the bot', () => {
    expect(planMiniappForm({ ...empty, title: 'Объект', amount: '1 500,50' }, false)).toEqual({
      create: { title: 'Объект', opportunity: 1500.5 },
    })
    expect(planMiniappForm({ ...empty, amount: '100' }, false)).toEqual({
      create: { title: '100', opportunity: 100 },
    })
    expect(planMiniappForm({ ...empty, amount: '100' }, true)).toEqual({
      patch: { opportunity: 100 },
    })
    expect(planMiniappForm({ ...empty, amount: 'нет' }, true)).toEqual({
      error: 'Сумма должна быть числом',
    })
  })

  it('patches dates and client only when a deal will exist', () => {
    expect(planMiniappForm({
      ...empty,
      title: 'Объект',
      begin: '22.09.2026',
      close: '2026-10-01',
      client: 'Иван Петров',
      hasFile: true,
    }, false)).toEqual({
      create: { title: 'Объект' },
      patch: { begin: '2026-09-22', close: '2026-10-01' },
      client: { name: 'Иван Петров' },
      attach: true,
    })
    expect(planMiniappForm({ ...empty, begin: '22.09.2026' }, false)).toEqual({ error: NO_DEAL })
    expect(planMiniappForm({ ...empty, client: 'Иван' }, false)).toEqual({ error: NO_DEAL })
    expect(planMiniappForm({ ...empty, hasFile: true }, false)).toEqual({ error: NO_DEAL })
    expect(planMiniappForm({ ...empty, close: '32.09.2026' }, true)).toEqual({
      error: 'Дата должна быть в виде ДД.ММ.ГГГГ',
    })
  })

  it('does not write anything when a field is invalid', () => {
    expect(planMiniappForm({ ...empty, title: 'Объект', amount: 'нет' }, false)).toEqual({
      error: 'Сумма должна быть числом',
    })
  })

  it('creates and moves deals between categories', () => {
    expect(planMiniappForm({ ...empty, title: 'Объект', categoryId: '9' }, false)).toEqual({
      create: { title: 'Объект', categoryId: '9' },
    })
    expect(planMiniappForm({
      ...empty,
      categoryId: '10',
      loadedCategoryId: '0',
    }, true)).toEqual({
      patch: { categoryId: '10' },
    })
    expect(planMiniappForm({
      ...empty,
      categoryId: '0',
      loadedCategoryId: '0',
    }, true)).toEqual({
      error: 'Нечего записывать',
    })
  })
})
