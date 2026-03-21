export const ACCOUNT_IMPORT_SEPARATOR = '----'

export interface AccountImportPayload {
  email: string
  password: string
  clientId: string
  refreshToken: string
}

export function formatAccountImportLine(account: AccountImportPayload) {
  return [
    account.email,
    account.password,
    account.clientId,
    account.refreshToken,
  ].join(ACCOUNT_IMPORT_SEPARATOR)
}
