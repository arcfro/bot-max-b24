import { BAD_ID, NO_DEAL } from '#shared/max-commands'
import type { DealFile, DealResponse, RevisionResponse } from '#shared/miniapp-deal'
import { parseDealIdInput } from '#shared/miniapp-id'

export function useMiniappDeal(initData: Ref<string>, ready: Ref<boolean>) {
  const dealId = ref<string | null>(null)
  const dealTitle = ref('')
  const dealIdInput = ref('')
  const title = ref('')
  const amount = ref('')
  const begin = ref('')
  const close = ref('')
  const clientName = ref('')
  const fileInput = ref<HTMLInputElement | null>(null)
  const fileLabel = ref('Выбрать файл')
  const files = ref<DealFile[]>([])
  const pending = ref(false)
  const looking = ref(false)
  const deletingFileId = ref<string | null>(null)
  const error = ref('')
  const message = ref('')

  let loadedId = ''
  let lastRevision = 0
  let loadTimer: ReturnType<typeof setTimeout> | undefined
  let lookup = 0

  function markRevision(revision?: number) {
    if (revision != null) lastRevision = revision
  }

  function showDeal(deal: DealResponse, fill: boolean) {
    loadedId = deal.id || ''
    dealId.value = deal.id
    dealTitle.value = deal.title || ''
    dealIdInput.value = deal.id || ''
    files.value = deal.files ?? []
    markRevision(deal.revision)
    if (!fill) return
    title.value = deal.title || ''
    amount.value = deal.amount || ''
    begin.value = deal.begin || ''
    close.value = deal.close || ''
    clientName.value = deal.client || ''
  }

  function inputDealId(): string | null {
    return parseDealIdInput(dealIdInput.value)
  }

  function canAutoSync(): boolean {
    if (!ready.value || !initData.value || pending.value || looking.value || deletingFileId.value) return false
    const typed = inputDealId()
    return !typed || typed === loadedId
  }

  async function openDeal(id: string) {
    if (id !== inputDealId()) return
    const ticket = ++lookup
    looking.value = true
    error.value = ''
    try {
      const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
        method: 'POST',
        body: { initData: initData.value, id },
      })
      if (ticket !== lookup || id !== inputDealId()) return
      showDeal(deal, true)
      message.value = ''
    }
    catch (e: unknown) {
      if (ticket !== lookup || id !== inputDealId()) return
      const status = fetchErrorStatus(e)
      const text = apiErrorMessage(e, '')
      if (status === 404 || /not[_\s-]*found/i.test(text)) error.value = 'Сделка не найдена'
      else error.value = apiErrorMessage(e, 'Сделка не найдена')
    }
    finally {
      if (ticket === lookup) looking.value = false
    }
  }

  function queueDealLookup(value: string) {
    const id = parseDealIdInput(value)
    if (loadTimer) clearTimeout(loadTimer)
    looking.value = false
    if (/^ID:/i.test(value.trim()) && !id) {
      error.value = BAD_ID
      return
    }
    if (!ready.value || !id || id === loadedId) return
    loadTimer = setTimeout(() => openDeal(id), 300)
  }

  watch(dealIdInput, queueDealLookup)
  watch(ready, (isReady) => {
    if (isReady) queueDealLookup(dealIdInput.value)
  })

  async function loadActiveDeal() {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData: initData.value },
    })
    showDeal(deal, true)
  }

  async function refreshActiveDeal() {
    if (!canAutoSync()) return
    try {
      const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
        method: 'POST',
        body: { initData: initData.value },
      })
      if (!canAutoSync()) return
      showDeal(deal, true)
    }
    catch {
      // тихо: бот мог сменить сделку на несуществующую
    }
  }

  async function syncRevision() {
    if (!canAutoSync()) return
    try {
      const rev = await $fetch<RevisionResponse>('/api/miniapp/revision', {
        method: 'POST',
        body: { initData: initData.value },
      })
      if (!canAutoSync()) return
      if (rev.updatedAt === lastRevision && rev.dealId === dealId.value) return
      await refreshActiveDeal()
    }
    catch {
      // ignore
    }
  }

  function resetFileInput() {
    fileLabel.value = 'Выбрать файл'
    if (fileInput.value) fileInput.value.value = ''
  }

  function pickFile() {
    if (pending.value || looking.value || !ready.value) return
    fileInput.value?.click()
  }

  async function onFile(event: Event) {
    const input = event.target as HTMLInputElement
    const picked = input.files?.[0]
    if (!picked) return
    if (!dealId.value) {
      error.value = NO_DEAL
      resetFileInput()
      return
    }
    fileLabel.value = picked.name
    await uploadFile(picked)
  }

  async function uploadFile(picked: File) {
    error.value = ''
    message.value = ''
    pending.value = true
    try {
      const body = new FormData()
      body.set('initData', initData.value)
      body.set('file', picked)
      const deal = await $fetch<DealResponse>('/api/miniapp/apply', { method: 'POST', body })
      showDeal(deal, true)
      message.value = deal.message || 'Файл прикреплён'
      resetFileInput()
    }
    catch (e: unknown) {
      error.value = apiErrorMessage(e, 'Не удалось прикрепить файл')
      resetFileInput()
    }
    finally {
      pending.value = false
    }
  }

  async function deleteFile(fileId: string) {
    if (!dealId.value || pending.value || looking.value || deletingFileId.value) return
    error.value = ''
    message.value = ''
    deletingFileId.value = fileId
    try {
      const deal = await $fetch<DealResponse>('/api/miniapp/delete-file', {
        method: 'POST',
        body: { initData: initData.value, fileId },
      })
      showDeal(deal, false)
      message.value = deal.message || 'Файл удалён'
    }
    catch (e: unknown) {
      error.value = apiErrorMessage(e, 'Не удалось удалить файл')
    }
    finally {
      deletingFileId.value = null
    }
  }

  async function submit(forceNew = false) {
    error.value = ''
    message.value = ''
    pending.value = true
    try {
      const body = new FormData()
      body.set('initData', initData.value)
      body.set('title', title.value)
      body.set('amount', amount.value)
      body.set('begin', begin.value)
      body.set('close', close.value)
      body.set('client', clientName.value)
      if (forceNew) body.set('newDeal', '1')
      const deal = await $fetch<DealResponse>('/api/miniapp/apply', { method: 'POST', body })
      showDeal(deal, true)
      message.value = deal.message || 'Записано'
    }
    catch (e: unknown) {
      error.value = apiErrorMessage(e, 'Не удалось записать')
    }
    finally {
      pending.value = false
    }
  }

  return {
    dealId,
    dealTitle,
    dealIdInput,
    title,
    amount,
    begin,
    close,
    clientName,
    fileInput,
    fileLabel,
    files,
    pending,
    looking,
    deletingFileId,
    error,
    message,
    loadActiveDeal,
    syncRevision,
    pickFile,
    onFile,
    deleteFile,
    submit,
  }
}
