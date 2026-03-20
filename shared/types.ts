export interface ApiEnvelope<T> {
  success: boolean
  code: string
  message: string
  data: T | null
}

export interface AccountListItem {
  id: number
  email: string
  clientId: string
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
