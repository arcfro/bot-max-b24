import { describe, expect, it } from 'vitest'
import { readLaunchInitData } from '#shared/miniapp-launch'

describe('readLaunchInitData', () => {
  it('reads WebAppData from the hash when the bridge snapshot is empty', () => {
    const hash = '#WebAppData=auth_date%3D1%26user%3D%7B%22id%22%3A5%7D&WebAppPlatform=desktop'
    expect(readLaunchInitData(hash, null, '')).toBe('auth_date=1&user={"id":5}')
  })

  it('falls back to storage, then the bridge', () => {
    expect(readLaunchInitData('', 'from-storage', '')).toBe('from-storage')
    expect(readLaunchInitData('#WebAppPlatform=desktop', null, 'from-bridge')).toBe('from-bridge')
    expect(readLaunchInitData('', null, '')).toBe('')
  })
})
