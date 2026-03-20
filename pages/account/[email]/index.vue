<script setup lang="ts">
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import type { MailSummary } from '~/shared/types'

const route = useRoute()
const email = computed(() => decodeURIComponent(String(route.params.email || '')))
const limit = ref(20)

const limitOptions = [
  { value: 10, label: '最近 10 封' },
  { value: 20, label: '最近 20 封' },
  { value: 50, label: '最近 50 封' },
  { value: 100, label: '最近 100 封' },
]

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
    key: 'total',
    label: '当前展示',
    value: mails.value.length,
    suffix: '封',
    variant: 'count',
  },
  {
    key: 'unread',
    label: '未读邮件',
    value: mails.value.filter((mail) => !mail.isRead).length,
    suffix: '封',
    variant: 'count',
  },
  {
    key: 'attachment',
    label: '包含附件',
    value: mails.value.filter((mail) => mail.hasAttachments).length,
    suffix: '封',
    variant: 'count',
  },
  {
    key: 'latest',
    label: '最新邮件时间',
    value: mails.value[0]?.receivedAt ? formatCompactDate(mails.value[0].receivedAt) : '暂无',
    suffix: '',
    variant: 'timestamp',
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
  <section class="mail-page">
    <ACard class="page-card" :bordered="false">
      <div class="page-card__header">
        <div class="page-card__header-main">
          <ABreadcrumb class="page-breadcrumb">
            <ABreadcrumbItem>
              <NuxtLink to="/">账号管理</NuxtLink>
            </ABreadcrumbItem>
            <ABreadcrumbItem>{{ email }}</ABreadcrumbItem>
          </ABreadcrumb>

          <ATypographyTitle :level="3" style="margin: 0">
            邮件列表
          </ATypographyTitle>
          <ATypographyText class="page-card__subtitle">
            当前邮箱：{{ email }}
          </ATypographyText>
        </div>

        <div class="page-toolbar">
          <div class="page-toolbar__field">
            <select
              v-model.number="limit"
              class="page-toolbar__select"
            >
              <option
                v-for="option in limitOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <NuxtLink to="/" class="page-toolbar__link">
            <AButton class="page-toolbar__button">
              <template #icon>
                <ArrowLeftOutlined />
              </template>
              返回首页
            </AButton>
          </NuxtLink>

          <AButton
            class="page-toolbar__button"
            :loading="pending"
            @click="reloadMails"
          >
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新邮件
          </AButton>
        </div>
      </div>

      <div class="mail-summary-grid">
        <div
          v-for="item in mailboxStats"
          :key="item.key"
          class="mail-summary-grid__item"
        >
          <ACard class="stat-card" :bordered="false">
            <div class="stat-card__label">{{ item.label }}</div>
            <div
              :class="[
                'stat-card__value',
                {
                  'stat-card__value--timestamp': item.variant === 'timestamp',
                },
              ]"
            >
              <span>{{ item.value }}</span>
              <span v-if="item.suffix" class="stat-card__suffix">{{ item.suffix }}</span>
            </div>
          </ACard>
        </div>
      </div>
    </ACard>

    <AAlert
      v-if="errorMessage"
      type="error"
      show-icon
      :message="errorMessage"
    />

    <ACard v-else class="list-card" :bordered="false" title="最近邮件">
      <AEmpty
        v-if="mails.length === 0 && !pending"
        description="当前没有读取到邮件"
      />

      <ASkeleton
        v-else-if="pending && mails.length === 0"
        active
        :paragraph="{ rows: 6 }"
      />

      <AList v-else :data-source="mails" item-layout="vertical">
        <template #renderItem="{ item }">
          <AListItem class="mail-list-item">
            <template #actions>
              <ATag :color="item.isRead ? 'default' : 'warning'">
                {{ item.isRead ? '已读' : '未读' }}
              </ATag>
              <ATag :color="item.hasAttachments ? 'processing' : 'default'">
                {{ item.hasAttachments ? '有附件' : '无附件' }}
              </ATag>
            </template>

            <template #extra>
              <NuxtLink :to="`/account/${encodeURIComponent(email)}/message/${encodeURIComponent(item.id)}`">
                <AButton type="link">查看详情</AButton>
              </NuxtLink>
            </template>

            <AListItemMeta>
              <template #title>
                <div class="mail-item__title">
                  <span class="mail-item__subject">{{ item.subject || '（无主题）' }}</span>
                  <ATypographyText type="secondary">
                    {{ formatDate(item.receivedAt) }}
                  </ATypographyText>
                </div>
              </template>

              <template #description>
                <div class="mail-item__meta">
                  <span>{{ item.fromName || '未知发件人' }}</span>
                  <span>{{ item.fromAddress }}</span>
                </div>
              </template>
            </AListItemMeta>
          </AListItem>
        </template>
      </AList>
    </ACard>
  </section>
</template>
