import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findAdmin, parseAdmins } from '../../server/utils/admins'

describe('admins', () => {
  it('parses JSON admin list', () => {
    expect(parseAdmins('[{"email":"A@X.com","password":"p1"}]')).toEqual([
      { email: 'a@x.com', password: 'p1' },
    ])
    expect(parseAdmins('not-json')).toEqual([])
    expect(parseAdmins('{}')).toEqual([])
    expect(parseAdmins('')).toEqual([])
  })

  it('matches email case-insensitively and exact password', () => {
    const raw = '[{"email":"Admin@Example.com","password":"secret"}]'
    expect(findAdmin('admin@example.com', 'secret', raw)?.email).toBe('admin@example.com')
    expect(findAdmin('admin@example.com', 'wrong', raw)).toBeNull()
    expect(findAdmin('other@example.com', 'secret', raw)).toBeNull()
  })
})

describe('json-store', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bot-max-b24-'))
    process.env.DATA_DIR = dir
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.DATA_DIR
  })

  it('saves settings and claims mid/greeting once', async () => {
    const store = await import('../../server/utils/json-store')
    const saved = store.saveSettings({ botToken: 'tok', botName: 'Bot' })
    expect(saved.botToken).toBe('tok')
    expect(store.getSettings().botName).toBe('Bot')

    expect(store.claimMid('m1')).toBe(true)
    expect(store.claimMid('m1')).toBe(false)
    expect(store.claimGreeting('u1')).toBe(true)
    expect(store.claimGreeting('u1')).toBe(false)

    store.saveClient('u1', 'c1', 'd1')
    expect(store.getClient('u1')).toEqual({
      contactId: 'c1',
      dealId: 'd1',
      updatedAt: expect.any(Number),
    })
    store.clearDeal('u1')
    expect(store.getClient('u1')?.dealId).toBeNull()
  })

  it('prunes seen mids older than 30 days', async () => {
    const store = await import('../../server/utils/json-store')
    store.updateState((state) => {
      state.seen.old = Date.now() - 31 * 24 * 60 * 60 * 1000
    })
    expect(store.claimMid('fresh')).toBe(true)
    expect(store.getState().seen.old).toBeUndefined()
    expect(store.getState().seen.fresh).toEqual(expect.any(Number))
  })
})
