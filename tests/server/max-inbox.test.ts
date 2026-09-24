import { describe, expect, it } from 'vitest'
import { readMaxIncoming } from '../../server/utils/max-inbox'

const sender = { user_id: 42, name: 'Иван', username: 'ivan' }

const file = {
  type: 'file',
  filename: 'act.pdf',
  payload: { url: 'https://cdn.example/act.pdf', token: 'tok' },
}

describe('readMaxIncoming', () => {
  it('takes a forwarded file from link.message when body is empty', () => {
    const incoming = readMaxIncoming({
      update_type: 'message_created',
      message: {
        sender,
        recipient: { chat_id: 7 },
        body: null,
        link: {
          type: 'forward',
          message: { mid: 'orig-1', text: null, attachments: [file] },
        },
      },
    })
    expect(incoming?.attachments).toEqual([file])
    expect(incoming?.text).toBe('')
    expect(incoming?.userId).toBe('42')
  })

  it('merges a forwarded file when body has mid but no attachments', () => {
    const incoming = readMaxIncoming({
      update_type: 'message_created',
      message: {
        sender,
        body: { mid: 'm3', text: '', attachments: [] },
        link: {
          type: 'forward',
          message: { mid: 'orig-1', attachments: [file] },
        },
      },
    })
    expect(incoming?.attachments).toEqual([file])
    expect(incoming?.mid).toBe('m3')
  })

  it('keeps a directly sent file on body', () => {
    const incoming = readMaxIncoming({
      update_type: 'message_created',
      message: {
        sender,
        body: { mid: 'm4', text: '', attachments: [file] },
      },
    })
    expect(incoming?.attachments).toEqual([file])
  })

  it('does not take a quoted file from a reply', () => {
    const incoming = readMaxIncoming({
      update_type: 'message_created',
      message: {
        sender,
        body: { mid: 'm2', text: 'ок', attachments: [] },
        link: {
          type: 'reply',
          message: { mid: 'orig-1', attachments: [file] },
        },
      },
    })
    expect(incoming?.attachments).toEqual([])
    expect(incoming?.text).toBe('ок')
  })
})
