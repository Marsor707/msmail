export interface ApiEnvelope<T> {
  success: boolean
  code: string
  message: string
  data: T | null
}

export const MAIL_PROTOCOLS = ['graph', 'imap'] as const

export type MailProtocol = (typeof MAIL_PROTOCOLS)[number]

export const ACCOUNT_TAG_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'gray',
] as const

export type AccountTagColor = (typeof ACCOUNT_TAG_COLORS)[number]

export interface AccountListItem {
  id: number
  email: string
  password: string
  clientId: string
  refreshToken: string
  tagColor: AccountTagColor | null
  hasRefreshToken: boolean
  hasAccessToken: boolean
  tokenExpires: string | null
  createdAt: string
  updatedAt: string
}

export interface ImportLineError {
  line: number
  content: string
  reason: string
}

export interface ImportAccountsResult {
  totalLines: number
  successCount: number
  updatedCount: number
  createdCount: number
  errorCount: number
  errors: ImportLineError[]
}

export interface MailSummary {
  id: string
  subject: string
  fromName: string
  fromAddress: string
  receivedAt: string
  hasAttachments: boolean
  isRead: boolean
}

export interface MailDetail {
  id: string
  subject: string
  fromName: string
  fromAddress: string
  toRecipients: string[]
  ccRecipients: string[]
  receivedAt: string
  isRead: boolean
  hasAttachments: boolean
  internetMessageId: string
  bodyType: 'html' | 'text'
  body: string
  preview: string
}
