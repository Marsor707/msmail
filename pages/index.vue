<script setup lang="ts">
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import message from 'ant-design-vue/es/message'
import Modal from 'ant-design-vue/es/modal'
import { formatAccountImportLine } from '~/shared/account-format'
import type {
  AccountListItem,
  ApiEnvelope,
  ImportAccountsResult,
  MailSummary,
} from '~/shared/types'

const ACCOUNT_SEARCH_DEBOUNCE = 300
const importText = ref('')
const importLoading = ref(false)
const importError = ref('')
const importModalOpen = ref(false)
const importResult = ref<ImportAccountsResult | null>(null)
const deletingId = ref<number | null>(null)
const exportLoading = ref(false)
const selectedAccountIds = ref<number[]>([])
const selectedAccountId = ref<number | null>(null)
const accountSearchInput = ref('')
const accountSearchKeyword = ref('')
const mailLimit = ref(20)
const mailboxLoading = ref(false)
const mailboxResponse = ref<ApiEnvelope<MailSummary[]>>(createSuccessEnvelope([]))
const importFileInput = useTemplateRef<HTMLInputElement>('importFileInput')

const mailLimitOptions = [
  { value: 10, label: '最近 10 封' },
  { value: 20, label: '最近 20 封' },
  { value: 50, label: '最近 50 封' },
  { value: 100, label: '最近 100 封' },
]

let accountSearchTimer: ReturnType<typeof setTimeout> | null = null
let mailboxRequestId = 0

const accountListRequestUrl = computed(() => {
  const params = new URLSearchParams()

  if (accountSearchKeyword.value) {
    params.set('keyword', accountSearchKeyword.value)
  }

  const queryString = params.toString()
  return queryString ? `/api/accounts?${queryString}` : '/api/accounts'
})

const {
  data: accountsData,
  pending,
  refresh,
} = await useAsyncData(
  'accounts',
  () => useApiRequest<AccountListItem[]>(accountListRequestUrl.value),
  {
    watch: [accountSearchKeyword],
  },
)

const accountsResponse = computed(() => accountsData.value)
const accounts = computed(() => accountsResponse.value?.data ?? [])
const accountErrorMessage = computed(() =>
  accountsResponse.value?.success === false ? accountsResponse.value.message : '',
)
const canSubmitImport = computed(() => importText.value.trim().length > 0 && !importLoading.value)
const selectedAccountIdSet = computed(() => new Set(selectedAccountIds.value))
const selectedAccounts = computed(() =>
  accounts.value.filter((account) => selectedAccountIdSet.value.has(account.id)),
)
const selectedAccountCount = computed(() => selectedAccounts.value.length)
const canExportAccounts = computed(() => selectedAccountCount.value > 0 && !exportLoading.value)
const selectedAccount = computed(
  () => accounts.value.find((account) => account.id === selectedAccountId.value) ?? null,
)
const selectedEmail = computed(() => selectedAccount.value?.email ?? '')
const mails = computed(() => mailboxResponse.value.data ?? [])
const mailErrorMessage = computed(() =>
  mailboxResponse.value.success === false ? mailboxResponse.value.message : '',
)
const accessibleAccountCount = computed(() =>
  accounts.value.filter((item) => item.hasAccessToken && isFutureDate(item.tokenExpires)).length,
)
const refreshableAccountCount = computed(() =>
  accounts.value.filter((item) => item.hasRefreshToken && !isFutureDate(item.tokenExpires)).length,
)
const currentTokenState = computed(() =>
  selectedAccount.value ? getTokenState(selectedAccount.value) : null,
)
const mailboxOverviewItems = computed(() => {
  if (!selectedAccount.value || !currentTokenState.value) {
    return []
  }

  return [
    {
      key: 'token',
      label: 'Token 状态',
      value: currentTokenState.value.label,
      desc: currentTokenState.value.detail,
      tone: currentTokenState.value.color,
    },
    {
      key: 'updatedAt',
      label: '最近更新时间',
      value: formatDate(selectedAccount.value.updatedAt),
      desc: selectedAccount.value.hasAccessToken ? '已缓存 Access Token' : '尚未缓存 Access Token',
      tone: 'default',
    },
    {
      key: 'mailCount',
      label: '当前加载',
      value: `${mails.value.length} 封`,
      desc: `拉取范围：${mailLimit.value} 封`,
      tone: 'default',
    },
    {
      key: 'unreadCount',
      label: '未读邮件',
      value: `${mails.value.filter((mail) => !mail.isRead).length} 封`,
      desc: '按当前拉取结果实时统计',
      tone: 'default',
    },
    {
      key: 'attachmentCount',
      label: '包含附件',
      value: `${mails.value.filter((mail) => mail.hasAttachments).length} 封`,
      desc: '便于快速定位带附件邮件',
      tone: 'default',
    },
    {
      key: 'latestMail',
      label: '最新来信',
      value: mails.value[0]?.receivedAt ? formatCompactDate(mails.value[0].receivedAt) : '暂无',
      desc: mails.value[0]?.subject || '当前没有读取到邮件',
      tone: 'default',
    },
  ]
})

watch(
  accounts,
  (nextAccounts) => {
    const availableIds = new Set(nextAccounts.map((account) => account.id))
    selectedAccountIds.value = selectedAccountIds.value.filter((id) => availableIds.has(id))

    if (!nextAccounts.length) {
      selectedAccountId.value = null
      return
    }

    if (selectedAccountId.value && availableIds.has(selectedAccountId.value)) {
      return
    }

    const firstAccount = nextAccounts[0]
    selectedAccountId.value = firstAccount ? firstAccount.id : null
  },
  {
    immediate: true,
  },
)

watch(accountSearchInput, (nextValue) => {
  if (accountSearchTimer) {
    clearTimeout(accountSearchTimer)
    accountSearchTimer = null
  }

  const keyword = nextValue.trim()

  if (!keyword) {
    accountSearchKeyword.value = ''
    return
  }

  accountSearchTimer = setTimeout(() => {
    accountSearchKeyword.value = keyword
    accountSearchTimer = null
  }, ACCOUNT_SEARCH_DEBOUNCE)
})

watch([selectedEmail, mailLimit], ([nextEmail, nextLimit], [prevEmail, prevLimit]) => {
  if (nextEmail === prevEmail && nextLimit === prevLimit) {
    return
  }

  void loadMailboxMessages({
    clearBeforeLoad: nextEmail !== prevEmail || nextLimit !== prevLimit,
  })
})

onBeforeUnmount(() => {
  if (accountSearchTimer) {
    clearTimeout(accountSearchTimer)
    accountSearchTimer = null
  }
})

await loadMailboxMessages()

async function reloadAccounts() {
  await refresh()
}

async function reloadMailboxMessages() {
  await loadMailboxMessages({
    clearBeforeLoad: false,
  })
}

async function refreshAccountByEmail(email: string) {
  if (!email) {
    return
  }

  const response = await useApiRequest<AccountListItem>(
    `/api/accounts/detail?email=${encodeURIComponent(email)}`,
  )

  if (!response.success || !response.data) {
    return
  }

  replaceAccountInList(response.data)
}

async function loadMailboxMessages(options: { clearBeforeLoad?: boolean } = {}) {
  const email = selectedEmail.value
  const requestId = ++mailboxRequestId

  if (!email) {
    mailboxResponse.value = createSuccessEnvelope([])
    mailboxLoading.value = false
    return
  }

  mailboxLoading.value = true

  if (options.clearBeforeLoad ?? true) {
    mailboxResponse.value = createSuccessEnvelope([])
  }

  const response = await useApiRequest<MailSummary[]>(
    `/api/accounts/${encodeURIComponent(email)}/messages?limit=${mailLimit.value}`,
  )

  if (requestId !== mailboxRequestId) {
    return
  }

  mailboxResponse.value = response.success
    ? createSuccessEnvelope(Array.isArray(response.data) ? response.data : [])
    : {
        ...response,
        data: [],
      }
  mailboxLoading.value = false

  if (response.success) {
    await refreshAccountByEmail(email)
  }
}

function openImportModal() {
  importError.value = ''
  importResult.value = null
  importModalOpen.value = true
}

function closeImportModal() {
  if (importLoading.value) {
    return
  }

  importModalOpen.value = false
}

function selectAccount(accountId: number) {
  selectedAccountId.value = accountId
}

function replaceAccountInList(nextAccount: AccountListItem) {
  const response = accountsData.value

  if (!response?.success || !Array.isArray(response.data)) {
    return
  }

  const nextAccounts = response.data.slice()
  const currentIndex = nextAccounts.findIndex((account) => account.email === nextAccount.email)

  if (currentIndex < 0) {
    return
  }

  nextAccounts[currentIndex] = nextAccount
  accountsData.value = {
    ...response,
    data: nextAccounts,
  }
}

function setSelectedAccountIds(ids: Array<number | string>) {
  selectedAccountIds.value = Array.from(
    new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  )
}

function setAccountSelected(accountId: number, checked: boolean) {
  if (checked) {
    setSelectedAccountIds([...selectedAccountIds.value, accountId])
    return
  }

  selectedAccountIds.value = selectedAccountIds.value.filter((id) => id !== accountId)
}

function isAccountSelected(accountId: number) {
  return selectedAccountIdSet.value.has(accountId)
}

function handleMailboxSelectionChange(
  accountId: number,
  event: { stopPropagation?: () => void, target?: { checked?: boolean } },
) {
  event.stopPropagation?.()
  setAccountSelected(accountId, Boolean(event.target?.checked))
}

async function importAccounts(text: string) {
  importLoading.value = true
  importError.value = ''
  importResult.value = null

  const response = await useApiRequest<ImportAccountsResult>('/api/accounts/import', {
    method: 'POST',
    body: {
      text,
    },
  })

  if (!response.success || !response.data) {
    importError.value = response.message
    message.error(response.message || '导入失败')
    importLoading.value = false
    return
  }

  importResult.value = response.data
  importText.value = ''
  await refresh()
  message.success(`导入完成，成功写入 ${response.data.successCount} 条账号`)
  importLoading.value = false
}

async function submitImport() {
  await importAccounts(importText.value)
}

function openImportFileSelector() {
  if (importLoading.value) {
    return
  }

  importFileInput.value?.click()
}

async function handleImportFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]

  if (!file) {
    return
  }

  target.value = ''

  if (!file.name.toLowerCase().endsWith('.txt')) {
    message.error('仅支持导入 txt 格式文件')
    return
  }

  const fileText = await file.text()
  const normalizedText = fileText.trim()

  if (!normalizedText) {
    message.warning('所选文件内容为空')
    return
  }

  importText.value = normalizedText
  await importAccounts(normalizedText)
}

async function exportSelectedAccounts() {
  if (!selectedAccounts.value.length) {
    message.warning('请先勾选要导出的账号')
    return
  }

  exportLoading.value = true

  const response = await useApiRequest<string>('/api/accounts/export', {
    method: 'POST',
    body: {
      ids: selectedAccounts.value.map((account) => account.id),
    },
  })

  exportLoading.value = false

  if (!response.success || response.data == null) {
    message.error(response.message || '导出失败')
    return
  }

  const downloadUrl = URL.createObjectURL(
    new Blob(['\uFEFF', response.data], {
      type: 'text/plain;charset=utf-8',
    }),
  )
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = `accounts-export-${formatFileTimestamp(new Date())}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(downloadUrl)

  message.success(`已导出 ${selectedAccountCount.value} 条账号`)
}

function handleImportKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
    return
  }

  event.preventDefault()

  if (!canSubmitImport.value) {
    return
  }

  void submitImport()
}

async function copyAccountImportText(account: AccountListItem, event?: MouseEvent) {
  event?.preventDefault()
  event?.stopPropagation()

  try {
    await copyTextToClipboard(formatAccountImportLine(account))
    message.success('已复制账号信息')
  } catch {
    message.error('复制失败，请重试')
  }
}

function removeAccount(account: AccountListItem, event?: MouseEvent) {
  event?.preventDefault()
  event?.stopPropagation()

  const fallbackAccountId = getAdjacentAccountId(account.id)

  Modal.confirm({
    title: '确认删除账号',
    content: `删除后将移除邮箱 ${account.email} 的本地配置记录。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: {
      danger: true,
    },
    async onOk() {
      deletingId.value = account.id

      const response = await useApiRequest<{ id: number }>(`/api/accounts/${account.id}`, {
        method: 'DELETE',
      })

      deletingId.value = null

      if (!response.success) {
        message.error(response.message || '删除失败')
        return Promise.reject(new Error(response.message))
      }

      await refresh()

      if (account.id === selectedAccountId.value && fallbackAccountId) {
        const nextAccount = accounts.value.find((item) => item.id === fallbackAccountId)
        selectedAccountId.value = nextAccount?.id ?? accounts.value[0]?.id ?? null
      }

      message.success('账号已删除')
    },
  })
}

function getAdjacentAccountId(accountId: number) {
  const currentIndex = accounts.value.findIndex((account) => account.id === accountId)

  if (currentIndex < 0) {
    return null
  }

  return accounts.value[currentIndex + 1]?.id ?? accounts.value[currentIndex - 1]?.id ?? null
}

function formatDate(value: string | null) {
  if (!value) {
    return '未生成'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCompactDate(value: string) {
  if (!value) {
    return '暂无'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function isFutureDate(value: string | null) {
  if (!value) {
    return false
  }

  return new Date(value).getTime() > Date.now()
}

function getTokenState(account: AccountListItem) {
  if (account.hasAccessToken && isFutureDate(account.tokenExpires)) {
    return {
      label: '可直接读取',
      color: 'success',
      detail: `有效期至 ${formatDate(account.tokenExpires)}`,
      icon: CheckCircleFilled,
      iconClass: 'mailbox-list__item-status--success',
    }
  }

  if (account.hasRefreshToken) {
    return {
      label: '待刷新',
      color: 'warning',
      detail: account.tokenExpires ? 'Access Token 已过期' : '尚未生成 Access Token',
      icon: SyncOutlined,
      iconClass: 'mailbox-list__item-status--warning',
    }
  }

  return {
    label: '配置缺失',
    color: 'error',
    detail: '缺少 Refresh Token，请重新导入',
    icon: CloseCircleFilled,
    iconClass: 'mailbox-list__item-status--error',
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  document.body.append(textarea)
  textarea.focus()
  textarea.select()

  const copied = document.execCommand('copy')
  textarea.remove()

  if (!copied) {
    throw new Error('COPY_FAILED')
  }
}

function formatFileTimestamp(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  const seconds = String(value.getSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

function createSuccessEnvelope<T>(data: T): ApiEnvelope<T> {
  return {
    success: true,
    code: 'OK',
    message: '',
    data,
  }
}
</script>

<template>
  <section class="workspace-page">
    <div class="workspace-grid">
      <ACard class="panel-card workspace-sidebar" :bordered="false">
        <div class="workspace-sidebar__hero">
          <div class="workspace-sidebar__hero-main">
            <ATypographyTitle :level="3" style="margin: 0">
              邮箱工作台
            </ATypographyTitle>
          </div>

          <div class="workspace-sidebar__stats">
            <div class="workspace-sidebar__stat">
              <strong>{{ accounts.length }}</strong>
              <span>邮箱账号</span>
            </div>
            <div class="workspace-sidebar__stat">
              <strong>{{ accessibleAccountCount }}</strong>
              <span>可直接读取</span>
            </div>
            <div class="workspace-sidebar__stat">
              <strong>{{ refreshableAccountCount }}</strong>
              <span>待刷新</span>
            </div>
          </div>
        </div>

        <div class="workspace-sidebar__toolbar">
          <AButton type="primary" @click="openImportModal">
            <template #icon>
              <UploadOutlined />
            </template>
            导入账号
          </AButton>

          <AButton :disabled="!canExportAccounts" :loading="exportLoading" @click="exportSelectedAccounts">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出选中（{{ selectedAccountCount }}）
          </AButton>

          <AButton :loading="pending" @click="reloadAccounts">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新列表
          </AButton>
        </div>

        <AInput
          v-model:value="accountSearchInput"
          allow-clear
          class="workspace-sidebar__search"
          placeholder="搜索邮箱账号"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </AInput>

        <AAlert
          v-if="accountErrorMessage"
          type="error"
          show-icon
          :message="accountErrorMessage"
        />

        <div class="workspace-sidebar__list">
          <ASkeleton
            v-if="pending && accounts.length === 0"
            active
            :paragraph="{ rows: 8 }"
          />

          <AEmpty
            v-else-if="accounts.length === 0"
            :description="accountSearchKeyword ? '没有找到匹配的邮箱账号' : '当前还没有导入任何邮箱账号'"
          >
            <AButton type="primary" @click="openImportModal">
              <template #icon>
                <UploadOutlined />
              </template>
              导入首批账号
            </AButton>
          </AEmpty>

          <div v-else class="mailbox-list">
            <article
              v-for="account in accounts"
              :key="account.id"
              :class="[
                'mailbox-list__item',
                {
                  'mailbox-list__item--active': account.id === selectedAccountId,
                },
              ]"
              role="button"
              tabindex="0"
              @click="selectAccount(account.id)"
              @keydown.enter.prevent="selectAccount(account.id)"
              @keydown.space.prevent="selectAccount(account.id)"
            >
              <span
                :class="['mailbox-list__item-status', getTokenState(account).iconClass]"
                :aria-label="getTokenState(account).label"
              >
                <component :is="getTokenState(account).icon" aria-hidden="true" />
              </span>

              <div class="mailbox-list__item-content">
                <div class="mailbox-list__item-head">
                  <div class="mailbox-list__item-leading">
                    <ACheckbox
                      :checked="isAccountSelected(account.id)"
                      @click.stop
                      @change="handleMailboxSelectionChange(account.id, $event)"
                    />

                    <div class="mailbox-list__item-identity">
                      <strong>{{ account.email }}</strong>
                      <span class="table-cell__subtext">创建于 {{ formatDate(account.createdAt) }}</span>
                    </div>
                  </div>
                </div>

                <div class="mailbox-list__item-meta">
                  <div class="mailbox-list__item-meta-row">
                    <span class="mailbox-list__item-meta-label">访问状态</span>
                    <span class="table-cell__subtext">{{ getTokenState(account).detail }}</span>
                  </div>
                  <div class="mailbox-list__item-meta-row">
                    <span class="mailbox-list__item-meta-label">最近更新</span>
                    <span class="table-cell__subtext">{{ formatDate(account.updatedAt) }}</span>
                  </div>
                </div>
              </div>

              <div class="mailbox-list__item-actions">
                <AButton
                  aria-label="复制账号信息"
                  class="account-copy-button"
                  type="text"
                  size="small"
                  title="复制账号信息"
                  @click="copyAccountImportText(account, $event)"
                >
                  <template #icon>
                    <CopyOutlined />
                  </template>
                </AButton>

                <AButton
                  aria-label="删除账号"
                  danger
                  type="text"
                  size="small"
                  title="删除账号"
                  :loading="deletingId === account.id"
                  @click="removeAccount(account, $event)"
                >
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </AButton>
              </div>
            </article>
          </div>
        </div>
      </ACard>

      <div class="workspace-main">
        <ACard class="page-card mailbox-overview-card" :bordered="false">
          <template v-if="selectedAccount">
            <div class="mailbox-overview__header">
              <div class="mailbox-overview__header-main">
                <ATypographyText type="secondary">
                  当前邮箱
                </ATypographyText>
                <ATypographyTitle :level="2" style="margin: 0">
                  {{ selectedAccount.email }}
                </ATypographyTitle>
              </div>

              <AButton :loading="mailboxLoading" @click="reloadMailboxMessages">
                <template #icon>
                  <ReloadOutlined />
                </template>
                刷新邮件
              </AButton>
            </div>

            <div class="mailbox-overview__grid">
              <div
                v-for="item in mailboxOverviewItems"
                :key="item.key"
                :class="[
                  'mailbox-overview__metric',
                  {
                    'mailbox-overview__metric--highlight': item.key === 'token',
                  },
                ]"
              >
                <span class="mailbox-overview__metric-label">{{ item.label }}</span>
                <div class="mailbox-overview__metric-value">
                  <ATag v-if="item.key === 'token'" :color="item.tone">
                    {{ item.value }}
                  </ATag>
                  <span v-else>{{ item.value }}</span>
                </div>
                <span class="mailbox-overview__metric-desc">{{ item.desc }}</span>
              </div>
            </div>
          </template>

          <AEmpty v-else>
            <template #description>
              <span />
            </template>
          </AEmpty>
        </ACard>

        <ACard class="list-card mailbox-mail-card" :bordered="false">
          <template #title>
            具体邮件列表
          </template>

          <template #extra>
            <div class="mailbox-mail-card__toolbar">
              <span class="table-cell__subtext">拉取范围</span>
              <div class="page-toolbar__field mailbox-mail-card__field">
                <select
                  v-model.number="mailLimit"
                  class="page-toolbar__select"
                  :disabled="!selectedAccount"
                >
                  <option
                    v-for="option in mailLimitOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>
            </div>
          </template>

          <AEmpty v-if="!selectedAccount">
            <template #description>
              <span />
            </template>
          </AEmpty>

          <template v-else>
            <AAlert
              v-if="mailErrorMessage"
              class="mailbox-mail-card__alert"
              type="error"
              show-icon
              :message="mailErrorMessage"
            />

            <ASkeleton
              v-else-if="mailboxLoading && mails.length === 0"
              active
              :paragraph="{ rows: 8 }"
            />

            <AEmpty
              v-else-if="mails.length === 0"
              description="当前没有读取到邮件"
            />

            <div v-else class="mail-list">
              <article
                v-for="item in mails"
                :key="item.id"
                class="mail-list-item"
              >
                <div class="mail-list-item__head">
                  <div class="mail-list-item__content">
                    <div class="mail-item__title">
                      <span class="mail-item__subject">{{ item.subject || '（无主题）' }}</span>
                    </div>

                    <div class="mail-item__meta">
                      <span class="mail-item__sender">{{ item.fromName || '未知发件人' }}</span>
                      <span class="mail-item__address">{{ item.fromAddress }}</span>
                    </div>
                  </div>

                  <div class="mail-list-item__aside">
                    <ATypographyText type="secondary" class="mail-item__time">
                      {{ formatDate(item.receivedAt) }}
                    </ATypographyText>

                    <NuxtLink
                      class="mail-list-item__detail"
                      :to="`/account/${encodeURIComponent(selectedAccount.email)}/message/${encodeURIComponent(item.id)}`"
                    >
                      <AButton type="link">查看详情</AButton>
                    </NuxtLink>
                  </div>
                </div>

                <div class="mail-list-item__footer">
                  <div class="mail-list-item__tags">
                    <ATag
                      :class="[
                        'mail-status-tag',
                        {
                          'mail-status-tag--unread': !item.isRead,
                        },
                      ]"
                    >
                      {{ item.isRead ? '已读' : '未读' }}
                    </ATag>
                    <ATag :color="item.hasAttachments ? 'processing' : 'default'">
                      {{ item.hasAttachments ? '有附件' : '无附件' }}
                    </ATag>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </ACard>
      </div>
    </div>

    <Modal
      :open="importModalOpen"
      title="批量导入账号"
      width="760px"
      :mask-closable="!importLoading"
      :confirm-loading="importLoading"
      :ok-button-props="{ disabled: !canSubmitImport }"
      ok-text="开始导入"
      cancel-text="关闭"
      @ok="submitImport"
      @cancel="closeImportModal"
    >
      <AAlert type="info">
        <template #description>
          <div class="import-card__description">
            <p>
              每行 1 条，格式固定：
              <code>email----password----client_id----refresh_token</code>
            </p>
            <p>支持直接粘贴文本，或选择本地 TXT 文件后自动导入。</p>
          </div>
        </template>
      </AAlert>

      <AForm layout="vertical" style="margin-top: 16px">
        <AFormItem label="导入内容">
          <ATextarea
            v-model:value="importText"
            :rows="12"
            placeholder="user@example.com----password----client-id----refresh-token"
            @keydown="handleImportKeydown"
          />
        </AFormItem>
      </AForm>

      <input
        ref="importFileInput"
        class="import-file-input"
        type="file"
        accept=".txt,text/plain"
        @change="handleImportFileChange"
      >

      <div class="import-actions">
        <AButton
          class="import-action-button"
          :disabled="importLoading"
          @click="openImportFileSelector"
        >
          <template #icon>
            <UploadOutlined />
          </template>
          本地导入
        </AButton>

        <AButton
          class="import-action-button"
          :disabled="importLoading || !importText"
          @click="importText = ''"
        >
          清空内容
        </AButton>
      </div>

      <AAlert
        v-if="importError"
        style="margin-top: 20px"
        type="error"
        show-icon
        :message="importError"
      />

      <div v-if="importResult" class="import-result-modal__content">
        <AResult
          status="success"
          :title="`成功写入 ${importResult.successCount} 条账号`"
          :sub-title="`共解析 ${importResult.totalLines} 行，其中新增 ${importResult.createdCount} 条、更新 ${importResult.updatedCount} 条。`"
          class="import-result__desc"
        />

        <ADescriptions size="small" :column="2" bordered>
          <ADescriptionsItem label="解析行数">
            {{ importResult.totalLines }}
          </ADescriptionsItem>
          <ADescriptionsItem label="成功写入">
            {{ importResult.successCount }}
          </ADescriptionsItem>
          <ADescriptionsItem label="新增账号">
            {{ importResult.createdCount }}
          </ADescriptionsItem>
          <ADescriptionsItem label="覆盖更新">
            {{ importResult.updatedCount }}
          </ADescriptionsItem>
        </ADescriptions>

        <AAlert
          v-if="importResult.errorCount > 0"
          class="import-result__alert"
          type="warning"
          show-icon
          :message="`有 ${importResult.errorCount} 行导入失败`"
        />

        <AList
          v-if="importResult.errorCount > 0"
          class="import-result__errors"
          size="small"
          bordered
          :data-source="importResult.errors"
        >
          <template #renderItem="{ item }">
            <AListItem>第 {{ item.line }} 行：{{ item.reason }}</AListItem>
          </template>
        </AList>
      </div>
    </Modal>
  </section>
</template>
