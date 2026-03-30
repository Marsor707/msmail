import { z } from 'zod'
import { defineApiHandler, appError } from '~/server/utils/api'
import { getAccountMessageDetail } from '~/server/utils/mail-provider'
import { getReadmeDemoMessageDetail, isReadmeScreenshotMode } from '~/server/utils/readme-demo'

const querySchema = z.object({
  email: z.string().email('邮箱格式不合法'),
  messageId: z.string().trim().min(1, 'messageId 不能为空'),
})

export default defineApiHandler(async (event) => {
  const queryResult = querySchema.safeParse(getQuery(event))

  if (!queryResult.success) {
    throw appError(400, 'INVALID_QUERY', queryResult.error.issues[0]?.message || '请求参数不合法')
  }

  if (isReadmeScreenshotMode()) {
    const detail = getReadmeDemoMessageDetail(queryResult.data.email, queryResult.data.messageId)

    if (!detail) {
      throw appError(404, 'MESSAGE_NOT_FOUND', '邮件不存在或已被删除')
    }

    return detail
  }

  return getAccountMessageDetail(queryResult.data.email, queryResult.data.messageId)
})
