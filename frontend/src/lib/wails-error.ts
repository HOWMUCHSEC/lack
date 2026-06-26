/**
 * Wails 调用错误处理工具
 * 提供统一的错误处理、日志记录和用户提示
 */
import * as Sentry from '@sentry/react'
import { toast } from 'sonner'
import i18next from '@/i18n'

export interface WailsCallOptions {
  /** 静默模式，不显示 toast */
  silent?: boolean
  /** 自定义错误消息 */
  errorMessage?: string
  /** 是否上报到 Sentry */
  reportToSentry?: boolean
}

/**
 * 包装 Wails 调用，统一处理错误
 * @param fn Wails 绑定函数调用
 * @param options 配置选项
 * @returns Promise 结果或 null（出错时）
 */
export async function wailsCall<T>(
  fn: () => Promise<T>,
  options: WailsCallOptions = {},
): Promise<T | null> {
  const { silent = false, errorMessage, reportToSentry = true } = options

  try {
    return await fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))

    // 日志记录
    console.error('[Wails Call Error]', err)

    // 上报 Sentry
    if (reportToSentry) {
      Sentry.captureException(err, {
        tags: { source: 'wails_call' },
      })
    }

    // 显示 toast 提示
    if (!silent) {
      const message = errorMessage || i18next.t('common.operationFailed', '操作失败')
      toast.error(message, {
        description: err.message,
      })
    }

    return null
  }
}

/**
 * 包装 Wails 调用，出错时返回默认值
 * @param fn Wails 绑定函数调用
 * @param defaultValue 默认值
 * @param options 配置选项
 * @returns Promise 结果或默认值
 */
export async function wailsCallWithDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  options: WailsCallOptions = {},
): Promise<T> {
  const result = await wailsCall(fn, options)
  return result ?? defaultValue
}

/**
 * 包装 Wails 调用，出错时抛出异常（用于需要上层处理错误的场景）
 * @param fn Wails 绑定函数调用
 * @param options 配置选项
 * @returns Promise 结果
 */
export async function wailsCallOrThrow<T>(
  fn: () => Promise<T>,
  options: WailsCallOptions = {},
): Promise<T> {
  const { silent = true, reportToSentry = true } = options

  try {
    return await fn()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))

    console.error('[Wails Call Error]', err)

    if (reportToSentry) {
      Sentry.captureException(err, {
        tags: { source: 'wails_call' },
      })
    }

    if (!silent) {
      toast.error(i18next.t('common.operationFailed', '操作失败'), {
        description: err.message,
      })
    }

    throw err
  }
}
