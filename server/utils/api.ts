import type { H3Error, H3Event } from 'h3'
import { createError, defineEventHandler, setResponseStatus } from 'h3'

type HandlerResult<T> = Promise<T> | T

interface NormalizedError {
  statusCode: number
  code: string
  message: string
  data: unknown
}

export function appError(
  statusCode: number,
  code: string,
  message: string,
  data: Record<string, unknown> = {},
) {
  return createError({
    statusCode,
    statusMessage: message,
    data: {
      code,
      ...data,
    },
  })
}

export function defineApiHandler<T>(
  handler: (event: H3Event) => HandlerResult<T>,
) {
  return defineEventHandler(async (event) => {
    try {
      const data = await handler(event)
      return {
        success: true,
        code: 'OK',
        message: 'ok',
        data,
      }
    } catch (error) {
      const normalized = normalizeError(error)
      setResponseStatus(event, normalized.statusCode)
      return {
        success: false,
        code: normalized.code,
        message: normalized.message,
        data: normalized.data,
      }
    }
  })
}

function normalizeError(error: unknown): NormalizedError {
  if (isH3Error(error)) {
    const data = error.data as Record<string, unknown> | undefined
    return {
      statusCode: error.statusCode || 500,
      code: typeof data?.code === 'string' ? data.code : 'INTERNAL_ERROR',
      message: error.statusMessage || error.message || '服务异常',
      data: data ?? null,
    }
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: error.message || '服务异常',
      data: null,
    }
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: '服务异常',
    data: null,
  }
}

function isH3Error(error: unknown): error is H3Error {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      'statusMessage' in error,
  )
}
