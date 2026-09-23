import { describe, expect, it } from 'vitest'
import { filesFromTimelineComments, formFromDeal, parseDealFileId } from '#shared/miniapp-deal'

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
      files: [],
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
      files: [],
    })
  })
})

describe('parseDealFileId', () => {
  it('splits comment id and file name', () => {
    expect(parseDealFileId('42:scan.pdf')).toEqual({ commentId: '42', name: 'scan.pdf' })
    expect(parseDealFileId('bad')).toBeNull()
    expect(parseDealFileId(':name')).toBeNull()
  })
})

describe('filesFromTimelineComments', () => {
  it('keeps only MAX uploads and sorts by date desc', () => {
    expect(filesFromTimelineComments([
      {
        ID: '1',
        CREATED: '2026-09-20T10:00:00+03:00',
        COMMENT: 'Файл из MAX: old.pdf',
        FILES: { '1': { id: 10, name: 'old.pdf', date: '2026-09-20T10:00:00+03:00' } },
      },
      {
        ID: '2',
        CREATED: '2026-09-22T12:00:00+03:00',
        COMMENT: 'Файл из MAX: new.jpg',
        FILES: { '1': { id: 11, name: 'new.jpg', date: '2026-09-22T12:00:00+03:00' } },
      },
      {
        ID: '3',
        CREATED: '2026-09-23T08:00:00+03:00',
        COMMENT: 'Ручной комментарий',
        FILES: { '1': { id: 12, name: 'skip.doc' } },
      },
    ])).toEqual([
      { id: '2:new.jpg', name: 'new.jpg', created: '2026-09-22T12:00:00+03:00' },
      { id: '1:old.pdf', name: 'old.pdf', created: '2026-09-20T10:00:00+03:00' },
    ])
  })

  it('reads file names from comment text when FILES is empty in list', () => {
    expect(filesFromTimelineComments([
      {
        ID: '9',
        CREATED: '2026-09-23T09:00:00+03:00',
        COMMENT: 'Файл из MAX: scan.pdf, photo.jpg',
      },
      {
        ID: '10',
        CREATED: '2026-09-23T10:00:00+03:00',
        COMMENT: 'Файл из MAX: one.docx',
        FILES: null,
      },
    ])).toEqual([
      { id: '10:one.docx', name: 'one.docx', created: '2026-09-23T10:00:00+03:00' },
      { id: '9:scan.pdf', name: 'scan.pdf', created: '2026-09-23T09:00:00+03:00' },
      { id: '9:photo.jpg', name: 'photo.jpg', created: '2026-09-23T09:00:00+03:00' },
    ])
  })
})
