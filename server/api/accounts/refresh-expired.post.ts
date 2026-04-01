import { defineApiHandler } from '~/server/utils/api'
import { refreshExpiredAccounts } from '~/server/utils/account-service'
import { isReadmeScreenshotMode, refreshReadmeDemoAccounts } from '~/server/utils/readme-demo'

export default defineApiHandler(async () => {
  if (isReadmeScreenshotMode()) {
    return refreshReadmeDemoAccounts()
  }

  return refreshExpiredAccounts()
})
