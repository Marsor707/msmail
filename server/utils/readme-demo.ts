import type {
  AccountListItem,
  AccountTagColor,
  MailDetail,
  MailSummary,
  RefreshExpiredAccountsResult,
} from '~/shared/types'

interface ReadmeDemoAccount extends AccountListItem {
  mailbox: MailSummary[]
}

const FUTURE_TOKEN_EXPIRES_AT = '2026-04-30T08:30:00.000Z'
const PAST_TOKEN_EXPIRES_AT = '2026-03-28T08:30:00.000Z'

const README_DEMO_ACCOUNTS: ReadmeDemoAccount[] = [
  {
    id: 101,
    email: 'alpha.ops@contoso.test',
    password: 'DemoPassword!23',
    clientId: 'demo-client-alpha',
    refreshToken: 'demo-refresh-alpha',
    tagColor: 'blue',
    hasRefreshToken: true,
    hasAccessToken: true,
    tokenExpires: FUTURE_TOKEN_EXPIRES_AT,
    createdAt: '2026-03-18T09:20:00.000Z',
    updatedAt: '2026-03-30T06:30:00.000Z',
    mailbox: [
      {
        id: 'graph-quarterly-report',
        subject: 'Q1 运维周报与工单汇总',
        fromName: 'Operations Desk',
        fromAddress: 'ops-desk@contoso.test',
        receivedAt: '2026-03-30T06:18:00.000Z',
        hasAttachments: true,
        isRead: false,
      },
      {
        id: 'graph-security-notice',
        subject: '安全例检提醒',
        fromName: 'Security Center',
        fromAddress: 'security@contoso.test',
        receivedAt: '2026-03-29T10:05:00.000Z',
        hasAttachments: false,
        isRead: true,
      },
      {
        id: 'graph-release-window',
        subject: '本周发布窗口确认',
        fromName: 'Release Manager',
        fromAddress: 'release@contoso.test',
        receivedAt: '2026-03-28T14:10:00.000Z',
        hasAttachments: false,
        isRead: false,
      },
    ],
  },
  {
    id: 102,
    email: 'finance.alerts@example.test',
    password: 'DemoPassword!24',
    clientId: 'demo-client-finance',
    refreshToken: 'demo-refresh-finance',
    tagColor: 'orange',
    hasRefreshToken: true,
    hasAccessToken: false,
    tokenExpires: PAST_TOKEN_EXPIRES_AT,
    createdAt: '2026-03-20T08:10:00.000Z',
    updatedAt: '2026-03-29T04:20:00.000Z',
    mailbox: [
      {
        id: 'imap-monthly-billing',
        subject: '月结账单已生成',
        fromName: 'Finance Bot',
        fromAddress: 'billing@example.test',
        receivedAt: '2026-03-29T04:10:00.000Z',
        hasAttachments: true,
        isRead: true,
      },
      {
        id: 'imap-payment-followup',
        subject: '付款回执补充信息',
        fromName: 'AP Team',
        fromAddress: 'ap@example.test',
        receivedAt: '2026-03-27T11:40:00.000Z',
        hasAttachments: false,
        isRead: true,
      },
    ],
  },
  {
    id: 103,
    email: 'support.queue@demo.test',
    password: 'DemoPassword!25',
    clientId: 'demo-client-support',
    refreshToken: 'demo-refresh-support',
    tagColor: null,
    hasRefreshToken: true,
    hasAccessToken: false,
    tokenExpires: null,
    createdAt: '2026-03-22T03:30:00.000Z',
    updatedAt: '2026-03-30T01:12:00.000Z',
    mailbox: [
      {
        id: 'graph-ticket-followup',
        subject: '工单 #20260330 需要补充截图',
        fromName: 'Support Lead',
        fromAddress: 'support@demo.test',
        receivedAt: '2026-03-30T01:05:00.000Z',
        hasAttachments: false,
        isRead: false,
      },
    ],
  },
]

const README_DEMO_DETAILS: Record<string, MailDetail> = {
  'alpha.ops@contoso.test:graph-quarterly-report': {
    id: 'graph-quarterly-report',
    subject: 'Q1 运维周报与工单汇总',
    fromName: 'Operations Desk',
    fromAddress: 'ops-desk@contoso.test',
    toRecipients: ['alpha.ops@contoso.test', 'team.lead@contoso.test'],
    ccRecipients: ['audit@example.test'],
    receivedAt: '2026-03-30T06:18:00.000Z',
    isRead: false,
    hasAttachments: true,
    internetMessageId: '<demo-graph-quarterly-report@contoso.test>',
    bodyType: 'html',
    body: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.7;">
        <h2 style="margin: 0 0 12px;">本周处理概览</h2>
        <p style="margin: 0 0 12px;">
          已完成 12 条告警归档、3 条发布确认以及 1 次权限巡检。
        </p>
        <ul style="margin: 0 0 16px 18px; padding: 0;">
          <li>未读告警：2 条</li>
          <li>待确认附件：1 份</li>
          <li>重点工单：网络连通性复核</li>
        </ul>
        <p style="margin: 0 0 12px;">
          详情文档：
          <a href="https://example.test/docs/q1-ops-report">查看演示链接</a>
        </p>
        <div style="padding: 12px 14px; border-radius: 12px; background: #f3f4f6;">
          本邮件内容仅用于 README 截图演示，不含真实用户数据。
        </div>
      </div>
    `,
    preview: '已完成 12 条告警归档、3 条发布确认以及 1 次权限巡检。',
  },
}

export function isReadmeScreenshotMode() {
  return process.env.README_SCREENSHOT_MODE === '1'
}

export function listReadmeDemoAccounts(options: {
  keyword?: string
  tagColor?: AccountTagColor
}) {
  const keyword = options.keyword?.trim().toLowerCase()

  return README_DEMO_ACCOUNTS
    .filter((account) => {
      if (options.tagColor && account.tagColor !== options.tagColor) {
        return false
      }

      if (keyword && !account.email.toLowerCase().includes(keyword)) {
        return false
      }

      return true
    })
    .map(({ mailbox: _mailbox, ...account }) => ({ ...account }))
}

export function getReadmeDemoAccountByEmail(email: string) {
  const matched = README_DEMO_ACCOUNTS.find((account) => account.email === email)

  if (!matched) {
    return null
  }

  const { mailbox: _mailbox, ...account } = matched
  return { ...account }
}

export function listReadmeDemoMessages(email: string, limit: number) {
  const matched = README_DEMO_ACCOUNTS.find((account) => account.email === email)

  if (!matched) {
    return null
  }

  return matched.mailbox.slice(0, limit).map((item) => ({ ...item }))
}

export function getReadmeDemoMessageDetail(email: string, messageId: string) {
  const matched = README_DEMO_DETAILS[`${email}:${messageId}`]

  if (!matched) {
    return null
  }

  return {
    ...matched,
    toRecipients: [...matched.toRecipients],
    ccRecipients: [...matched.ccRecipients],
  }
}

export function refreshReadmeDemoAccounts(): RefreshExpiredAccountsResult {
  const refreshedAt = new Date().toISOString()

  return {
    refreshedAccounts: README_DEMO_ACCOUNTS
      .filter((account) => account.hasRefreshToken && (!account.hasAccessToken || !isFutureDate(account.tokenExpires)))
      .map(({ mailbox: _mailbox, ...account }) => ({
        ...account,
        hasAccessToken: true,
        tokenExpires: FUTURE_TOKEN_EXPIRES_AT,
        updatedAt: refreshedAt,
      })),
    failedAccounts: [],
  }
}

function isFutureDate(value: string | null) {
  if (!value) {
    return false
  }

  return new Date(value).getTime() > Date.now()
}
