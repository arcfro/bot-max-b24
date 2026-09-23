import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { maxInitFailure, readMaxInitData } from '../../server/utils/max-init-data'

const TOKEN = 'bot-token'
const NOW = 1_771_409_719

function sign(fields: Record<string, string>, token = TOKEN): string {
  const launch = Object.keys(fields).sort().map(key => `${key}=${fields[key]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(launch).digest('hex')
  const params = new URLSearchParams({ ...fields, hash })
  return params.toString()
}

const user = JSON.stringify({
  id: 67890,
  first_name: 'Max',
  last_name: 'User',
  username: 'max',
  language_code: 'ru',
})

describe('readMaxInitData', () => {
  it('accepts a signed launch and reads the user', () => {
    const initData = sign({
      auth_date: String(NOW),
      query_id: '4c0ab423-342b-4e45-aea4-2747dbc500cd',
      user,
    })
    expect(readMaxInitData(initData, TOKEN, NOW)).toEqual({
      userId: '67890',
      name: 'Max User',
      username: 'max',
    })
  })

  it('names why a launch was rejected', () => {
    expect(maxInitFailure('start_param=', TOKEN, NOW)).toBe('start_param')
    const fresh = sign({ auth_date: String(NOW), user })
    expect(maxInitFailure(`${fresh}&hash=ab`, TOKEN, NOW)).toBe('sig')
    expect(maxInitFailure(sign({ auth_date: String(NOW - 3601), user }), TOKEN, NOW)).toBe('age')
  })

  it('rejects a bad signature, a stale auth_date, and a missing user', () => {
    const fresh = sign({ auth_date: String(NOW), user })
    expect(readMaxInitData(`${fresh}&hash=ab`, TOKEN, NOW)).toBeNull()
    expect(readMaxInitData(fresh, 'other-token', NOW)).toBeNull()
    expect(readMaxInitData(sign({ auth_date: String(NOW - 3601), user }), TOKEN, NOW)).toBeNull()
    expect(readMaxInitData(sign({ auth_date: String(NOW), query_id: 'x' }), TOKEN, NOW)).toBeNull()
    expect(readMaxInitData('', TOKEN, NOW)).toBeNull()
  })
})
