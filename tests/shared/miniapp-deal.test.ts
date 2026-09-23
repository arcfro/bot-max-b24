import { describe, expect, it } from 'vitest'
import { formFromDeal } from '#shared/miniapp-deal'

describe('formFromDeal', () => {
  it('maps Bitrix deal fields into the form', () => {
    expect(formFromDeal({
      id: 12,
      title: 'Скважина',
      opportunity: '50000.00',
      begin: '2026-09-23T03:00:00+03:00',
      close: '2026-10-01',
      client: 'Сидоров С.С.',
    })).toEqual({
      id: '12',
      title: 'Скважина',
      amount: '50000',
      begin: '2026-09-23',
      close: '2026-10-01',
      client: 'Сидоров С.С.',
    })
  })

  it('returns an empty form when there is no deal', () => {
    expect(formFromDeal(null)).toEqual({
      id: null,
      title: '',
      amount: '',
      begin: '',
      close: '',
      client: '',
    })
  })
})
