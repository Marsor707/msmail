<script setup lang="ts">
import type { MailSummary } from '~/shared/types'

const route = useRoute()
const email = computed(() => decodeURIComponent(String(route.params.email || '')))
const limit = ref(20)

const {
  data,
  pending,
  refresh,
} = await useAsyncData(
  () => `account-mails:${email.value}:${limit.value}`,
  () =>
    useApiRequest<MailSummary[]>(
      `/api/accounts/${encodeURIComponent(email.value)}/messages?limit=${limit.value}`,
    ),
  {
    watch: [limit],
  },
)

const response = computed(() => data.value)
const mails = computed(() => response.value?.data ?? [])
const errorMessage = computed(() => (response.value?.success === false ? response.value.message : ''))
const mailboxStats = computed(() => [
  {
    label: '当前展示',
    value: `${mails.value.length} 封`,
    desc: '本次列表返回的邮件数量',
  },
  {
    label: '未读邮件',
    value: `${mails.value.filter((mail) => !mail.isRead).length} 封`,
    desc: '便于优先定位新邮件',
  },
  {
    label: '包含附件',
    value: `${mails.value.filter((mail) => mail.hasAttachments).length} 封`,
    desc: '用于排查附件类通知或投递记录',
  },
  {
    label: '最新时间',
    value: mails.value[0]?.receivedAt ? formatCompactDate(mails.value[0].receivedAt) : '暂无',
    desc: '按接口返回顺序取第一封邮件时间',
  },
])

async function reloadMails() {
  await refresh()
}

function formatDate(value: string) {
  if (!value) {
    return '-'
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
</script>

<template>
  <section class="detail-stack">
    <div class="surface-card page-hero">
      <div class="breadcrumb">
        <NuxtLink to="/">账号管理</NuxtLink>
        <span>/</span>
        <span>{{ email }}</span>
      </div>

      <div class="page-hero-head">
        <div>
          <span class="eyebrow-chip">Mailbox Explorer</span>
          <h1 class="page-title">邮件列表</h1>
          <p class="page-subtitle">
            当前邮箱：<strong>{{ email }}</strong>
          </p>
        </div>

        <div class="toolbar-panel">
          <label class="toolbar-field">
            <span>读取范围</span>
            <select
              v-model="limit"
              class="select"
            >
              <option :value="10">最近 10 封</option>
              <option :value="20">最近 20 封</option>
              <option :value="50">最近 50 封</option>
              <option :value="100">最近 100 封</option>
            </select>
          </label>

          <button
            class="btn secondary"
            :disabled="pending"
            @click="reloadMails"
          >
            {{ pending ? '刷新中...' : '刷新邮件' }}
          </button>
        </div>
      </div>

      <div class="inline-metrics">
        <article
          v-for="item in mailboxStats"
          :key="item.label"
          class="compact-metric"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.desc }}</p>
        </article>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="error-box"
    >
      {{ errorMessage }}
    </div>

    <div
      v-else-if="mails.length === 0 && !pending"
      class="empty-box"
    >
      当前没有读取到任何邮件。你可以调整读取数量后再次刷新，确认该账号近期是否有邮件到达。
    </div>

    <div
      v-else
      class="mail-feed"
    >
      <NuxtLink
        v-for="mail in mails"
        :key="mail.id"
        class="mail-card"
        :to="`/account/${encodeURIComponent(email)}/message/${encodeURIComponent(mail.id)}`"
      >
        <span
          class="mail-card-marker"
          :class="{ read: mail.isRead }"
        />

        <div class="mail-card-content">
          <div class="mail-card-head">
            <h2>{{ mail.subject || '（无主题）' }}</h2>
            <span class="mail-time">{{ formatDate(mail.receivedAt) }}</span>
          </div>

          <p class="mail-sender">
            {{ mail.fromName || '未知发件人' }}（{{ mail.fromAddress }}）
          </p>

          <div class="chip-row">
            <span
              class="status-badge"
              :class="mail.isRead ? 'neutral' : 'warning'"
            >
              {{ mail.isRead ? '已读' : '未读' }}
            </span>
            <span class="status-badge neutral">
              {{ mail.hasAttachments ? '包含附件' : '无附件' }}
            </span>
          </div>
        </div>

        <span class="mail-card-link">查看详情</span>
      </NuxtLink>
    </div>
  </section>
</template>
