import { z } from 'zod'
import { appError, defineApiHandler } from '~/server/utils/api'
import { exportAccountsByIds } from '~/server/utils/account-service'

const bodySchema = z.object({
  ids: z
    .array(z.coerce.number().int().positive('账号 ID 不合法'))
    .min(1, '请先勾选要导出的账号'),
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const result = bodySchema.safeParse(body)

  if (!result.success) {
    throw appError(400, 'INVALID_BODY', result.error.issues[0]?.message || '请求参数不合法')
  }

  return exportAccountsByIds(result.data.ids)
})
