import type { MaxStatus } from '#shared/max-status'

export function useMaxSettings() {
  const maxToken = ref('')
  const bitrixWebhook = ref('')
  const bitrixCategoryWebhook = ref('')
  const bitrixStatusWebhook = ref('')
  const maxPending = ref(false)
  const maxErrors = ref<string[]>([])
  const allowFrom = ref('')
  const allowlistEnabled = ref(false)
  const allowPending = ref(false)
  const allowError = ref('')
  const allowSaved = ref(false)

  const { data: maxStatus, error: fetchError, refresh } = useFetch<MaxStatus>('/api/settings/max')

  const loadError = computed(() => fetchError.value
    ? apiErrorMessage(fetchError.value, 'Не удалось загрузить статус')
    : '')

  watch(maxStatus, (status) => {
    if (!status) return
    allowFrom.value = status.allowFrom
    allowlistEnabled.value = status.allowlistEnabled
  }, { immediate: true })

  const maxWebhookHint = computed(() => {
    const origin = String(useRuntimeConfig().public.appUrl || '').replace(/\/$/, '')
    return origin ? `${origin}/api/max/webhook` : '/api/max/webhook'
  })

  function formatDateTime(ms: number) {
    return new Date(ms).toLocaleString('ru-RU')
  }

  async function saveAllowlist() {
    allowError.value = ''
    allowSaved.value = false
    allowPending.value = true
    try {
      const res = await $fetch<MaxStatus>('/api/settings/max', {
        method: 'POST',
        body: {
          allowFrom: allowFrom.value,
          allowlistEnabled: allowlistEnabled.value,
        },
      })
      maxStatus.value = res
      allowSaved.value = true
    }
    catch (e: unknown) {
      allowError.value = apiErrorMessage(e, 'Не удалось сохранить список')
    }
    finally {
      allowPending.value = false
    }
  }

  async function connectMax() {
    maxErrors.value = []
    maxPending.value = true
    const sentToken = maxToken.value.trim()
    const sentBitrix = bitrixWebhook.value.trim()
    const sentBitrixCategory = bitrixCategoryWebhook.value.trim()
    const sentBitrixStatus = bitrixStatusWebhook.value.trim()
    try {
      const res = await $fetch<MaxStatus>('/api/settings/max', {
        method: 'POST',
        body: {
          token: sentToken,
          bitrixWebhook: sentBitrix,
          bitrixCategoryWebhook: sentBitrixCategory,
          bitrixStatusWebhook: sentBitrixStatus,
        },
      })
      maxStatus.value = res
      if (sentToken && !res.tokenError) maxToken.value = ''
      if (sentBitrix && !res.bitrixError) bitrixWebhook.value = ''
      if (sentBitrixCategory && !res.bitrixCategoryError) bitrixCategoryWebhook.value = ''
      if (sentBitrixStatus && !res.bitrixStatusError) bitrixStatusWebhook.value = ''
      maxErrors.value = [
        res.tokenError,
        res.bitrixError,
        res.bitrixCategoryError,
        res.bitrixStatusError,
      ].filter((line): line is string => !!line)
    }
    catch (e: unknown) {
      maxErrors.value = [apiErrorMessage(e, 'Не удалось подключить')]
    }
    finally {
      maxPending.value = false
    }
  }

  return {
    maxToken,
    bitrixWebhook,
    bitrixCategoryWebhook,
    bitrixStatusWebhook,
    maxStatus,
    maxPending,
    maxErrors,
    allowFrom,
    allowlistEnabled,
    allowPending,
    allowError,
    allowSaved,
    loadError,
    maxWebhookHint,
    formatDateTime,
    saveAllowlist,
    connectMax,
    refresh,
  }
}
