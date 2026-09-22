export type MaxStatus = {
  connected: boolean
  botName: string | null
  botUserId: number | null
  webhookUrl: string | null
  subscribedAt: number | null
  bitrixWebhookHost: string | null
  allowlistEnabled: boolean
  allowFrom: string
  tokenError: string | null
  bitrixError: string | null
}
