<script setup lang="ts">
import {
  DeleteOutlined,
  DownloadOutlined,
  MailOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import message from 'ant-design-vue/es/message'
import Modal from 'ant-design-vue/es/modal'
import type { AccountListItem, ImportAccountsResult } from '~/shared/types'

const importText = ref('')
const importLoading = ref(false)
const deletingId = ref<number | null>(null)
const exportLoading = ref(false)
const importResult = ref<ImportAccountsResult | null>(null)
const importResultOpen = ref(false)
const importError = ref('')
const isCompactLayout = ref(false)
const selectedAccountIds = ref<number[]>([])
const importFileInput = useTemplateRef<HTMLInputElement>('importFileInput')

let compactLayoutQuery: MediaQueryList | null = null

const {
  data: accountsData,
  pending,
  refresh,
} = await useAsyncData('accounts', () => useApiRequest<AccountListItem[]>('/api/accounts'))

const accounts = computed(() => accountsData.value?.data ?? [])
const accountTableLoading = computed(() => pending.value && accounts.value.length === 0)
const canSubmitImport = computed(() => importText.value.trim().length > 0 && !importLoading.value)
const selectedAccountIdSet = computed(() => new Set(selectedAccountIds.value))
const selectedAccounts = computed(() =>
  accounts.value.filter((account) => selectedAccountIdSet.value.has(account.id)),
)
const selectedAccountCount = computed(() => selectedAccounts.value.length)
const canExportAccounts = computed(() => selectedAccountCount.value > 0 && !exportLoading.value)

const summaryCards = computed(() => {
  const accessibleCount = accounts.value.filter(
    (item) => item.hasAccessToken && isFutureDate(item.tokenExpires),
  ).length
  const refreshableCount = accounts.value.filter(
    (item) => item.hasRefreshToken && !isFutureDate(item.tokenExpires),
  ).length

  return [
    {
      key: 'total',
      title: '已接入账号',
      value: accounts.value.length,
      suffix: '个',
      desc: '当前系统内已保存的邮箱账号数量。',
    },
    {
      key: 'accessible',
      title: '可直接读取',
      value: accessibleCount,
      suffix: '个',
      desc: 'Access Token 仍在有效期内，可直接查看邮件。',
    },
    {
      key: 'refreshable',
      title: '待刷新',
      value: refreshableCount,
      suffix: '个',
      desc: '已有 Refresh Token，但需要重新换取 Access Token。',
    },
  ]
})

const ACCOUNT_SELECTION_COLUMN_WIDTH = 56

const accountColumns = [
  {
    title: '邮箱账号',
    dataIndex: 'email',
    key: 'email',
    width: 260,
  },
  {
    title: 'Access 状态',
    key: 'tokenState',
    width: 280,
  },
  {
    title: 'Client ID',
    dataIndex: 'clientId',
    key: 'clientId',
    width: 260,
  },
  {
    title: '最近更新时间',
    key: 'updatedAt',
    width: 260,
  },
  {
    title: '操作',
    key: 'actions',
    width: 128,
    fixed: 'right',
  },
]

const accountTableScrollX = accountColumns.reduce(
  (sum, column) => sum + (typeof column.width === 'number' ? column.width : 0),
  ACCOUNT_SELECTION_COLUMN_WIDTH,
)

const accountRowSelection = computed(() => ({
  columnWidth: ACCOUNT_SELECTION_COLUMN_WIDTH,
  selectedRowKeys: selectedAccountIds.value,
  onChange: (keys: Array<string | number>) => {
    setSelectedAccountIds(keys)
  },
}))

function syncCompactLayout(target?: MediaQueryList | MediaQueryListEvent) {
  isCompactLayout.value = target?.matches ?? compactLayoutQuery?.matches ?? false
}

watch(
  accounts,
  (nextAccounts) => {
    const availableIds = new Set(nextAccounts.map((account) => account.id))
    selectedAccountIds.value = selectedAccountIds.value.filter((id) => availableIds.has(id))
  },
  {
    immediate: true,
  },
)

function handleCompactLayoutChange(event: MediaQueryListEvent) {
  syncCompactLayout(event)
}

onMounted(() => {
  compactLayoutQuery = window.matchMedia('(max-width: 1100px)')
  syncCompactLayout(compactLayoutQuery)

  if (typeof compactLayoutQuery.addEventListener === 'function') {
    compactLayoutQuery.addEventListener('change', handleCompactLayoutChange)
    return
  }

  compactLayoutQuery.addListener(handleCompactLayoutChange)
})

onBeforeUnmount(() => {
  if (!compactLayoutQuery) {
    return
  }

  if (typeof compactLayoutQuery.removeEventListener === 'function') {
    compactLayoutQuery.removeEventListener('change', handleCompactLayoutChange)
    return
  }

  compactLayoutQuery.removeListener(handleCompactLayoutChange)
})

async function reloadAccounts() {
  await refresh()
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

async function importAccounts(text: string) {
  importLoading.value = true
  importError.value = ''
  importResultOpen.value = false
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
  importResultOpen.value = true
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

function closeImportResult() {
  importResultOpen.value = false
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

function handleMobileSelectionChange(
  accountId: number,
  event: { target?: { checked?: boolean } },
) {
  setAccountSelected(accountId, Boolean(event.target?.checked))
}

function removeAccount(account: AccountListItem) {
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
      message.success('账号已删除')
    },
  })
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
    }
  }

  if (account.hasRefreshToken) {
    return {
      label: '待刷新',
      color: 'warning',
      detail: account.tokenExpires ? 'Access Token 已过期' : '尚未生成 Access Token。',
    }
  }

  return {
    label: '配置缺失',
    color: 'error',
    detail: '缺少 Refresh Token，请重新导入。',
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
</script>

<template>
  <section class="dashboard-page">
    <div class="dashboard-grid">
      <ACard title="批量导入账号" class="panel-card import-card" :bordered="false">
        <AAlert
          type="info"
        >
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
              :rows="14"
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
            type="primary"
            :loading="importLoading"
            :disabled="!canSubmitImport"
            @click="submitImport"
          >
            <template #icon>
              <UploadOutlined />
            </template>
            开始导入
          </AButton>
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

      </ACard>

      <div class="dashboard-main__stack">
        <ARow :gutter="[16, 16]" class="summary-grid dashboard-summary-grid">
          <ACol
            v-for="item in summaryCards"
            :key="item.key"
            :xs="24"
            :sm="24"
            :md="8"
          >
            <ACard class="stat-card" :bordered="false">
              <div class="summary-card__title">
                <ATypographyText strong>{{ item.title }}</ATypographyText>
                <MailOutlined v-if="item.key === 'total'" />
                <ReloadOutlined v-else-if="item.key === 'refreshable'" />
                <UploadOutlined v-else />
              </div>

              <AStatistic :value="item.value" :suffix="item.suffix" />
              <div class="summary-card__desc">{{ item.desc }}</div>
            </ACard>
          </ACol>
        </ARow>

        <ACard class="panel-card" :bordered="false">
          <div class="table-toolbar">
            <div>
              <ATypographyTitle :level="4" style="margin-bottom: 4px">
                账号管理
              </ATypographyTitle>
              <ATypographyText type="secondary">
                统一查看账号状态、Token 可用性与邮件入口。
              </ATypographyText>
            </div>

            <ASpace wrap>
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
            </ASpace>
          </div>

          <ClientOnly>
            <AEmpty
              v-if="accounts.length === 0 && !pending"
              description="当前还没有导入任何邮箱账号"
            />

            <div v-else-if="isCompactLayout" class="account-mobile-list">
              <ACard
                v-for="account in accounts"
                :key="account.id"
                size="small"
                class="account-mobile-card"
                :bordered="false"
              >
                <div class="account-mobile-card__header">
                  <div class="account-mobile-card__title">
                    <ACheckbox
                      class="account-mobile-card__selector"
                      :checked="isAccountSelected(account.id)"
                      @change="handleMobileSelectionChange(account.id, $event)"
                    >
                      <ATypographyText strong>{{ account.email }}</ATypographyText>
                    </ACheckbox>
                    <span class="table-cell__subtext">创建于 {{ formatDate(account.createdAt) }}</span>
                  </div>

                  <ATag :color="getTokenState(account).color">
                    {{ getTokenState(account).label }}
                  </ATag>
                </div>

                <ADescriptions :column="1" size="small">
                  <ADescriptionsItem label="Access 状态">
                    <div class="table-cell__stack">
                      <span class="table-cell__subtext">{{ getTokenState(account).detail }}</span>
                      <span class="table-cell__subtext">
                        {{ account.hasAccessToken ? '已缓存 Access Token' : '未缓存 Access Token' }}
                      </span>
                    </div>
                  </ADescriptionsItem>
                  <ADescriptionsItem label="Client ID">
                    <ATypographyText
                      class="client-id-text"
                      :content="account.clientId"
                      :ellipsis="{ tooltip: account.clientId }"
                    />
                  </ADescriptionsItem>
                  <ADescriptionsItem label="最近更新时间">
                    {{ formatDate(account.updatedAt) }}
                  </ADescriptionsItem>
                </ADescriptions>

                <ASpace class="account-mobile-card__actions" wrap>
                  <NuxtLink :to="`/account/${encodeURIComponent(account.email)}`">
                    <AButton type="primary">查看邮件</AButton>
                  </NuxtLink>
                  <AButton
                    danger
                    :loading="deletingId === account.id"
                    @click="removeAccount(account)"
                  >
                    <template #icon>
                      <DeleteOutlined />
                    </template>
                    删除
                  </AButton>
                </ASpace>
              </ACard>
            </div>

            <ATable
              v-else
              class="account-table"
              :columns="accountColumns"
              :data-source="accounts"
              :loading="accountTableLoading"
              :pagination="{ pageSize: 8, showSizeChanger: false }"
              :row-selection="accountRowSelection"
              :scroll="{ x: accountTableScrollX }"
              table-layout="fixed"
              row-key="id"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'email'">
                  <div class="table-cell__stack">
                    <ATypographyText strong>{{ record.email }}</ATypographyText>
                    <ATypographyText type="secondary" class="table-cell__subtext">
                      创建于 {{ formatDate(record.createdAt) }}
                    </ATypographyText>
                  </div>
                </template>

                <template v-else-if="column.key === 'clientId'">
                  <ATypographyText
                    class="client-id-text"
                    :content="record.clientId"
                    :ellipsis="{ tooltip: record.clientId }"
                  />
                </template>

                <template v-else-if="column.key === 'tokenState'">
                  <div class="table-cell__stack">
                    <ATag :color="getTokenState(record).color">
                      {{ getTokenState(record).label }}
                    </ATag>
                    <span class="table-cell__subtext">{{ getTokenState(record).detail }}</span>
                  </div>
                </template>

                <template v-else-if="column.key === 'updatedAt'">
                  <div class="table-cell__stack">
                    <ATypographyText>{{ formatDate(record.updatedAt) }}</ATypographyText>
                    <span class="table-cell__subtext">
                      {{ record.hasAccessToken ? '已缓存 Access Token' : '未缓存 Access Token' }}
                    </span>
                  </div>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <ASpace class="account-table__actions" :size="4">
                    <NuxtLink :to="`/account/${encodeURIComponent(record.email)}`">
                      <AButton type="link" size="small">查看</AButton>
                    </NuxtLink>
                    <AButton
                      aria-label="删除账号"
                      danger
                      type="text"
                      size="small"
                      title="删除账号"
                      :loading="deletingId === record.id"
                      @click="removeAccount(record)"
                    >
                      <template #icon>
                        <DeleteOutlined />
                      </template>
                    </AButton>
                  </ASpace>
                </template>
              </template>
            </ATable>

            <template #fallback>
              <div class="account-panel-skeleton">
                <ASkeleton active :paragraph="{ rows: 6 }" />
              </div>
            </template>
          </ClientOnly>
        </ACard>
      </div>
    </div>

    <Modal
      :open="importResultOpen"
      title="导入结果"
      width="720px"
      :mask-closable="true"
      @cancel="closeImportResult"
    >
      <div v-if="importResult" class="import-result-modal__content">
        <AResult
          status="success"
          :title="`成功写入 ${importResult.successCount} 条账号`"
          :sub-title="`共解析 ${importResult.totalLines} 行，其中新增 ${importResult.createdCount} 条、更新 ${importResult.updatedCount} 条。`"
          class="import-result__desc"
        />

        <ADescriptions size="small" :column="isCompactLayout ? 1 : 2" bordered>
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

      <template #footer>
        <AButton type="primary" @click="closeImportResult">
          知道了
        </AButton>
      </template>
    </Modal>
  </section>
</template>
