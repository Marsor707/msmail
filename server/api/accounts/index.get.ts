import { defineApiHandler } from '~/server/utils/api'
import { listAccounts } from '~/server/utils/account-service'

export default defineApiHandler(async () => {
  return listAccounts()
})
