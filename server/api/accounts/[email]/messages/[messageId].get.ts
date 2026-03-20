import { defineApiHandler, appError } from '~/server/utils/api'
import { getAccountMessageDetail } from '~/server/utils/microsoft-graph'

export default defineApiHandler(async (event) => {
  const email = decodeURIComponent(getRouterParam(event, 'email') || '')
  const messageId = decodeURIComponent(getRouterParam(event, 'messageId') || '')

  if (!email) {
    throw appError(400, 'EMAIL_REQUIRED', '邮箱不能为空')
  }

  if (!messageId) {
    throw appError(400, 'MESSAGE_ID_REQUIRED', 'messageId 不能为空')
  }

  return getAccountMessageDetail(email, messageId)
})
