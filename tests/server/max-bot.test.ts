import { X509Certificate } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { RUSSIAN_TRUSTED_CAS } from '../../server/utils/russian-trusted-cas'
import {
  bitrixCategoryProbeUrl,
  bitrixProbeUrl,
  bitrixStatusProbeUrl,
  bitrixWebhookBase,
  bitrixWebhookHost,
  bitrixWebhookProblem,
  failureMessage,
  httpsWebhookProblem,
  makeMaxWebhookSecret,
  maxIntegrationStatus,
  maxWebhookUrl,
  resolveBitrixWebhooks,
  secretsMatch,
} from '../../server/utils/max-bot'

describe('max webhook', () => {
  it('builds the public webhook url', () => {
    expect(maxWebhookUrl('https://lab.example')).toBe('https://lab.example/api/max/webhook')
    expect(maxWebhookUrl('https://lab.example/')).toBe('https://lab.example/api/max/webhook')
  })

  it('rejects non-https origins', () => {
    expect(httpsWebhookProblem('https://lab.example/api/max/webhook')).toBeNull()
    expect(httpsWebhookProblem('http://127.0.0.1:3000/api/max/webhook')).toMatch(/HTTPS/)
    expect(httpsWebhookProblem('not a url')).toMatch(/NUXT_PUBLIC_APP_URL/)
  })

  it('checks a Bitrix24 incoming webhook', () => {
    const url = 'https://ingeo.bitrix24.ru/rest/1/abcDEF/'
    expect(bitrixWebhookProblem('')).toBeNull()
    expect(bitrixWebhookProblem(url)).toBeNull()
    expect(bitrixWebhookProblem('http://ingeo.bitrix24.ru/rest/1/abc/')).toMatch(/HTTPS/)
    expect(bitrixWebhookProblem('https://ingeo.bitrix24.ru/crm/')).toMatch(/\/rest\//)
    expect(bitrixWebhookHost(url)).toBe('ingeo.bitrix24.ru')
    expect(bitrixWebhookBase(url)).toBe('https://ingeo.bitrix24.ru/rest/1/abcDEF/')
    expect(bitrixProbeUrl(url)).toBe('https://ingeo.bitrix24.ru/rest/1/abcDEF/crm.deal.fields.json')
    const withMethod = 'https://ingeo-lab.bitrix24.by/rest/1/k0secret/crm.deal.add.json'
    expect(bitrixWebhookBase(withMethod)).toBe('https://ingeo-lab.bitrix24.by/rest/1/k0secret/')
    expect(bitrixProbeUrl(withMethod)).toBe('https://ingeo-lab.bitrix24.by/rest/1/k0secret/crm.deal.fields.json')
    expect(bitrixCategoryProbeUrl(url)).toBe('https://ingeo.bitrix24.ru/rest/1/abcDEF/crm.dealcategory.list.json')
    expect(bitrixStatusProbeUrl(url)).toBe('https://ingeo.bitrix24.ru/rest/1/abcDEF/crm.status.list.json')
  })

  it('resolves optional bitrix webhooks with fallback to main', () => {
    const main = 'https://ingeo.bitrix24.ru/rest/1/main/'
    expect(resolveBitrixWebhooks({
      bitrixWebhookUrl: main,
      bitrixCategoryWebhookUrl: null,
      bitrixStatusWebhookUrl: null,
    })).toEqual({
      main,
      category: main,
      status: main,
    })
    expect(resolveBitrixWebhooks({
      bitrixWebhookUrl: main,
      bitrixCategoryWebhookUrl: 'https://ingeo.bitrix24.ru/rest/1/cat/',
      bitrixStatusWebhookUrl: 'https://ingeo.bitrix24.ru/rest/1/st/',
    })).toEqual({
      main,
      category: 'https://ingeo.bitrix24.ru/rest/1/cat/',
      status: 'https://ingeo.bitrix24.ru/rest/1/st/',
    })
  })

  it('keeps token and bitrix status independent', () => {
    const bitrixOnly = maxIntegrationStatus({
      botToken: null,
      botName: null,
      botUserId: null,
      webhookUrl: null,
      subscribedAt: null,
      bitrixWebhookUrl: 'https://ingeo.bitrix24.ru/rest/1/abc/',
      bitrixCategoryWebhookUrl: 'https://ingeo.bitrix24.ru/rest/1/cat/',
      bitrixStatusWebhookUrl: 'https://ingeo.bitrix24.ru/rest/1/st/',
    }, { tokenError: 'Токен бота не принят' })
    expect(bitrixOnly.connected).toBe(false)
    expect(bitrixOnly.bitrixWebhookHost).toBe('ingeo.bitrix24.ru')
    expect(bitrixOnly.bitrixCategoryWebhookHost).toBe('ingeo.bitrix24.ru')
    expect(bitrixOnly.bitrixStatusWebhookHost).toBe('ingeo.bitrix24.ru')
    expect(bitrixOnly.tokenError).toBe('Токен бота не принят')
    expect(bitrixOnly.bitrixError).toBeNull()
    expect(bitrixOnly.bitrixCategoryError).toBeNull()
    expect(bitrixOnly.bitrixStatusError).toBeNull()

    expect(failureMessage({ statusMessage: 'Вебхук Битрикс24 не принят' }, 'fail')).toBe('Вебхук Битрикс24 не принят')
  })

  it('bundles the Russian Trusted CAs used by platform-api2.max.ru', () => {
    const certs = RUSSIAN_TRUSTED_CAS
      .split(/(?=-----BEGIN CERTIFICATE-----)/)
      .map(pem => pem.trim())
      .filter(Boolean)
      .map(pem => new X509Certificate(pem))
    expect(certs.map(cert => cert.subject)).toEqual(expect.arrayContaining([
      expect.stringContaining('Russian Trusted Root CA'),
      expect.stringContaining('Russian Trusted Sub CA'),
    ]))
  })

  it('issues a MAX-safe secret', () => {
    const secret = makeMaxWebhookSecret()
    expect(secret).toMatch(/^[A-Za-z0-9-]{32}$/)
    expect(secretsMatch(secret, secret)).toBe(true)
    expect(secretsMatch(secret, `${secret}x`)).toBe(false)
    expect(secretsMatch('short', 'other')).toBe(false)
  })
})
