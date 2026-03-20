import { defineApiHandler, appError } from '~/server/utils/api'
import { deleteAccountById } from '~/server/utils/account-service'

export default defineApiHandler(async (event) => {
  const rawId = getRouterParam(event, 'id')
  const id = Number(rawId)

  if (!rawId || Number.isNaN(id) || id <= 0) {
    throw appError(400, 'INVALID_ACCOUNT_ID', '账号 ID 不合法')
  }

  return deleteAccountById(id)
})
