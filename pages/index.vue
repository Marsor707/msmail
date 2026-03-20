<script setup lang="ts">
import type { AccountListItem, ImportAccountsResult } from '~/shared/types'

const importText = ref('')
const importLoading = ref(false)
const deletingId = ref<number | null>(null)
const importResult = ref<ImportAccountsResult | null>(null)
const importError = ref('')

const {
  data: accountsData,
  pending,
  refresh,
} = await useAsyncData('accounts', () => useApiRequest<AccountListItem[]>('/api/accounts'))

const accounts = computed(() => accountsData.value?.data ?? [])
const canSubmitImport = computed(() => importText.value.trim().length > 0 && !importLoading.value)

const workflowSteps = [
  {
    title: '批量导入账号',
    description: '按固定格式一次性导入多个微软邮箱账号，重复邮箱会自动覆盖旧配置。',
  },
  {
    title: '统一检查 Token',
    description: '工作台集中展示 refresh token 与 access token 状态，便于快速发现异常账号。',
  },
  {
    title: '进入邮件阅读',
    description: '按账号进入最近邮件列表，再下钻到正文详情页完成排查、验收或接口联调。',
  },
]

const latestUpdatedAt = computed(() => {
  if (accounts.value.length === 0) {
    return null
  }

  return [...accounts.value]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]
    ?.updatedAt ?? null
})

const workspaceStats = computed(() => [
  {
    label: '已接入账号',
    value: String(accounts.value.length),
    desc: '当前工作台收录的邮箱数量',
  },
  {
    label: '可直接读取',
    value: String(accounts.value.filter((item) => item.hasAccessToken && isFutureDate(item.tokenExpires)).length),
    desc: '存在未过期 Access Token 的账号数',
  },
  {
    label: '可刷新恢复',
    value: String(accounts.value.filter((item) => item.hasRefreshToken).length),
    desc: '具备 refresh_token 的账号数',
  },
  {
    label: '最近变更',
    value: latestUpdatedAt.value ? formatCompactDate(latestUpdatedAt.value) : '暂无',
    desc: '按账号更新时间统计',
  },
])

const accountCards = computed(() =>
  accounts.value.map((account) => ({
    account,
    tokenState: getTokenState(account),
  })),
)

async function reloadAccounts() {
  await refresh()
}

async function submitImport() {
  importLoading.value = true
  importError.value = ''
  importResult.value = null

  const response = await useApiRequest<ImportAccountsResult>('/api/accounts/import', {
    method: 'POST',
    body: {
      text: importText.value,
    },
  })

  if (!response.success) {
    importError.value = response.message
    importLoading.value = false
    return
  }

  importResult.value = response.data
  importText.value = ''
  await refresh()
  importLoading.value = false
}

async function removeAccount(id: number) {
  if (!window.confirm('确认删除这个邮箱账号吗？')) {
    return
  }

  deletingId.value = id
  const response = await useApiRequest<{ id: number }>(`/api/accounts/${id}`, {
    method: 'DELETE',
  })

  deletingId.value = null

  if (!response.success) {
    window.alert(response.message)
    return
  }

  await refresh()
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

function formatCompactDate(value: string | null) {
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
      tone: 'success',
      detail: `有效期至 ${formatDate(account.tokenExpires)}`,
    }
  }

  if (account.hasRefreshToken) {
    return {
      label: '待刷新',
      tone: 'info',
      detail: account.tokenExpires
        ? `Access Token 已失效，可通过 refresh_token 重新拉取`
        : '尚未生成 Access Token，可按需刷新',
    }
  }

  return {
    label: '配置缺失',
    tone: 'danger',
    detail: '缺少 refresh_token，请重新导入该账号',
  }
}
</script>

<template>
  <section class="dashboard-stack">
    <div class="surface-card hero-panel">
      <div class="hero-main">
        <span class="eyebrow-chip">Mail Operations Console</span>
        <h1 class="hero-title">把微软邮箱账号、Token 与邮件读取统一放进一个工作台。</h1>
        <p class="hero-text">
          这套控制台聚焦三个动作：批量导入账号、集中查看 token 状态、快速进入邮件详情页。
          适合排障、验收和接口联调，不需要再在脚本、数据库和接口文档之间来回切换。
        </p>

        <div class="hero-actions">
          <a class="btn primary" href="#import-panel">开始导入账号</a>
          <button
            class="btn secondary"
            :disabled="pending"
            @click="reloadAccounts"
          >
            {{ pending ? '同步中...' : '刷新工作台' }}
          </button>
        </div>

        <div class="workflow-grid">
          <article
            v-for="(step, index) in workflowSteps"
            :key="step.title"
            class="workflow-card"
          >
            <span class="workflow-index">0{{ index + 1 }}</span>
            <h2>{{ step.title }}</h2>
            <p>{{ step.description }}</p>
          </article>
        </div>
      </div>

      <div class="stat-stack">
        <div
          v-for="card in workspaceStats"
          :key="card.label"
          class="metric-card"
        >
          <small>{{ card.label }}</small>
          <strong>{{ card.value }}</strong>
          <p>{{ card.desc }}</p>
        </div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div
        id="import-panel"
        class="surface-card"
      >
        <div class="panel-header">
          <div>
            <h2 class="section-title">批量导入账号</h2>
            <p class="section-desc">支持一次性覆盖更新多个邮箱配置，适合初始化和批量修复。</p>
          </div>
          <span class="status-badge neutral">Ctrl / Cmd + Enter 可快速提交</span>
        </div>

        <div class="callout-box">
          <span class="overline">导入格式</span>
          <pre class="snippet-box">email----password----client_id----refresh_token</pre>
          <p class="callout-text">
            每行一个账号。重复邮箱会覆盖密码、client_id 与 refresh_token，并清空旧的 Access Token 缓存。
          </p>
        </div>

        <label class="form-label" for="import-textarea">导入内容</label>
        <textarea
          id="import-textarea"
          v-model="importText"
          class="textarea"
          placeholder="user@example.com----password----client-id----refresh-token"
          @keydown.ctrl.enter.prevent="submitImport"
          @keydown.meta.enter.prevent="submitImport"
        />

        <div class="actions">
          <button
            class="btn primary"
            :disabled="!canSubmitImport"
            @click="submitImport"
          >
            {{ importLoading ? '导入中...' : '开始导入' }}
          </button>
          <button
            class="btn secondary"
            :disabled="importLoading || !importText"
            @click="importText = ''"
          >
            清空文本
          </button>
        </div>

        <ul class="bullet-list hint-list">
          <li>推荐先导入，再刷新工作台查看 token 状态是否正常。</li>
          <li>若同一个邮箱重新导入，系统会按最新一行配置为准。</li>
          <li>仅页面展示必要元信息，不返回密码与 token 明文。</li>
        </ul>

        <div
          v-if="importResult"
          class="result-box"
        >
          <div class="result-grid">
            <div class="result-item">
              <span>解析行数</span>
              <strong>{{ importResult.totalLines }}</strong>
            </div>
            <div class="result-item">
              <span>成功写入</span>
              <strong>{{ importResult.successCount }}</strong>
            </div>
            <div class="result-item">
              <span>新增账号</span>
              <strong>{{ importResult.createdCount }}</strong>
            </div>
            <div class="result-item">
              <span>覆盖更新</span>
              <strong>{{ importResult.updatedCount }}</strong>
            </div>
          </div>

          <template v-if="importResult.errorCount > 0">
            <div class="result-errors">
              失败 {{ importResult.errorCount }} 行：
            </div>
            <span
              v-for="item in importResult.errors"
              :key="`${item.line}-${item.reason}`"
              class="result-error-line"
            >
              第 {{ item.line }} 行：{{ item.reason }}
            </span>
          </template>
        </div>

        <div
          v-if="importError"
          class="error-box"
        >
          {{ importError }}
        </div>
      </div>

      <div class="surface-card">
        <div class="panel-header">
          <div>
            <h2 class="section-title">账号工作台</h2>
            <p class="section-desc">
              以账号卡片展示 token 可用性、更新时间与快捷入口，移动端也更容易浏览。
            </p>
          </div>

          <button
            class="btn secondary"
            :disabled="pending"
            @click="reloadAccounts"
          >
            {{ pending ? '刷新中...' : '刷新列表' }}
          </button>
        </div>

        <div
          v-if="accounts.length === 0 && !pending"
          class="empty-box"
        >
          当前还没有导入任何邮箱账号。先在左侧粘贴账号配置，再回来查看状态和邮件入口。
        </div>

        <div
          v-else
          class="account-list"
        >
          <article
            v-for="item in accountCards"
            :key="item.account.id"
            class="account-card"
          >
            <div class="account-card-head">
              <div>
                <span class="overline">账号邮箱</span>
                <h3>{{ item.account.email }}</h3>
              </div>
              <span
                class="status-badge"
                :class="item.tokenState.tone"
              >
                {{ item.tokenState.label }}
              </span>
            </div>

            <p class="account-detail">{{ item.tokenState.detail }}</p>

            <div class="account-card-grid">
              <div class="info-tile">
                <span>Client ID</span>
                <code class="mono-text">{{ item.account.clientId }}</code>
              </div>
              <div class="info-tile">
                <span>刷新凭证</span>
                <strong>{{ item.account.hasRefreshToken ? '已导入' : '缺失' }}</strong>
              </div>
              <div class="info-tile">
                <span>Access Token</span>
                <strong>{{ item.account.hasAccessToken ? '已缓存' : '未缓存' }}</strong>
              </div>
              <div class="info-tile">
                <span>最近更新</span>
                <strong>{{ formatDate(item.account.updatedAt) }}</strong>
              </div>
            </div>

            <div class="row-actions">
              <NuxtLink
                class="mini-btn"
                :to="`/account/${encodeURIComponent(item.account.email)}`"
              >
                查看邮件
              </NuxtLink>
              <button
                class="mini-btn danger"
                :disabled="deletingId === item.account.id"
                @click="removeAccount(item.account.id)"
              >
                {{ deletingId === item.account.id ? '删除中...' : '删除账号' }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
