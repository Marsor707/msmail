import { z } from 'zod'
import { defineApiHandler, appError } from '~/server/utils/api'
import { importAccountsFromText } from '~/server/utils/account-service'

const bodySchema = z.object({
  text: z.string().trim().min(1, '导入内容不能为空'),
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const result = bodySchema.safeParse(body)

  if (!result.success) {
    throw appError(400, 'INVALID_BODY', result.error.issues[0]?.message || '请求参数不合法')
  }

  return importAccountsFromText(result.data.text)
})
