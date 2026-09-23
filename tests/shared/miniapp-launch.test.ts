import { describe, expect, it } from 'vitest'
import { readLaunchInitData } from '#shared/miniapp-launch'

describe('readLaunchInitData', () => {
  it('reads WebAppData from the hash when the bridge snapshot is empty', () => {
    const inner = 'auth_date=1&user={"id":5}&hash=ab'
    const hash = `#WebAppData=${encodeURIComponent(inner)}&WebAppPlatform=desktop`
    expect(readLaunchInitData(hash, null, '')).toBe(inner)
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

  it('extracts initData when WebAppData was decoded into flat hash params', () => {
    const hash = '#WebAppData=start_param=&auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab&ip=127.0.0.1&WebAppPlatform=desktop'
    expect(readLaunchInitData(hash, null, 'start_param=')).toBe(
      'start_param=&auth_date=1&user={"id":5}&hash=ab&ip=127.0.0.1',
    )
  })

  it('reads initData from the full desktop URL, not a truncated storage leftover', () => {
    const inner = 'start_param=&auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab'
    const href = `https://max.ingeo-lab.ru/miniapp?WebAppStartParam=#WebAppData=${encodeURIComponent(inner)}&WebAppPlatform=desktop`
    expect(readLaunchInitData(href, 'start_param=', 'start_param=')).toBe(inner)
  })

  it('falls back to storage, then the bridge, and ignores a cut WebAppData', () => {
    const stored = 'auth_date=1&user=%7B%22id%22%3A5%7D&hash=ab'
    expect(readLaunchInitData('', stored, '')).toBe(stored)
    expect(readLaunchInitData('#WebAppPlatform=desktop', null, stored)).toBe(stored)
    expect(readLaunchInitData('', 'start_param=', 'start_param=')).toBe('')
    expect(readLaunchInitData('', null, '')).toBe('')
  })
})
