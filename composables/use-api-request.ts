import type { ApiEnvelope } from '~/shared/types'

export async function useApiRequest<T>(
  url: string,
  options?: Parameters<typeof $fetch<ApiEnvelope<T>>>[1],
) {
  try {
    return await $fetch<ApiEnvelope<T>>(url, options)
  } catch (error) {
    const data = (error as { data?: ApiEnvelope<T> }).data
    if (data && typeof data.success === 'boolean') {
      return {
        ...data,
        data: data.success ? data.data : null,
      }
    }

    const normalizedError = error as {
      data?: { message?: string }
      statusCode?: number
      statusMessage?: string
      message?: string
    }

    return {
      success: false,
      code: normalizedError.statusCode ? `HTTP_${normalizedError.statusCode}` : 'REQUEST_FAILED',
      message:
        normalizedError.data?.message ||
        normalizedError.statusMessage ||
        normalizedError.message ||
        '请求失败',
      data: null,
    }
  }
}
