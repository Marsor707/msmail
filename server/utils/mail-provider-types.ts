import type { MailDetail, MailProtocol, MailSummary } from '~/shared/types'

export interface MailProviderAccount {
  email: string
  clientId: string
  refreshToken: string
  accessToken: string | null
  tokenExpires: Date | null
  mailProtocol: MailProtocol
}

export interface MailProvider {
  listAccountMessages(account: MailProviderAccount, limit: number): Promise<MailSummary[]>
  getAccountMessageDetail(account: MailProviderAccount, messageId: string): Promise<MailDetail>
}
