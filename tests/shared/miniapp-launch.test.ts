import { describe, expect, it } from 'vitest'
import { readLaunchInitData } from '#shared/miniapp-launch'

describe('readLaunchInitData', () => {
  it('reads WebAppData from the hash when the bridge snapshot is empty', () => {
    const hash = '#WebAppData=auth_date%3D1%26user%3D%7B%22id%22%3A5%7D&WebAppPlatform=desktop'
    expect(readLaunchInitData(hash, null, '')).toBe('auth_date=1&user={"id":5}')
  })

  it('reads a flat desktop hash without the WebAppData wrapper', () => {
    const hash = '#auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab&WebAppPlatform=desktop'
    expect(readLaunchInitData(hash, null, '')).toBe('auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab')
  })

  it('reads double-encoded desktop WebAppData', () => {
    const inner = 'start_param=&auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab'
    const hash = `#WebAppData=${encodeURIComponent(inner)}&WebAppPlatform=desktop&WebAppVersion=26.32.0`
    expect(readLaunchInitData(hash, null, '')).toBe(inner)
  })

  it('reassembles a desktop hash whose WebAppData was already decoded', () => {
    const hash = '#WebAppData=start_param=&auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab&ip=127.0.0.1&WebAppPlatform=desktop'
    expect(readLaunchInitData(hash, null, 'start_param=')).toBe(
      'start_param=&auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab&ip=127.0.0.1',
    )
  })

  it('falls back to storage, then the bridge', () => {
    expect(readLaunchInitData('', 'from-storage', '')).toBe('from-storage')
    expect(readLaunchInitData('#WebAppPlatform=desktop', null, 'from-bridge')).toBe('from-bridge')
    expect(readLaunchInitData('', null, '')).toBe('')
  })
})
