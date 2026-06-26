import { useCallback, useRef } from 'react'

/**
 * A hook that returns a throttled version of the callback function.
 * The callback will be invoked at most once per `delay` milliseconds.
 *
 * @param callback - The function to throttle
 * @param delay - Minimum milliseconds between invocations (default: 500ms)
 * @returns A throttled version of the callback
 *
 * @example
 * const throttledHandler = useThrottledCallback((data) => {
 *   console.log('Throttled:', data)
 * }, 500)
 */
export function useThrottledCallback<T extends (...args: unknown[]) => void>(
    callback: T,
    delay: number = 500
): T {
    const lastCallRef = useRef<number>(0)
    const callbackRef = useRef(callback)

    // Keep callback ref up to date
    callbackRef.current = callback

    return useCallback(
        ((...args: Parameters<T>) => {
            const now = Date.now()
            if (now - lastCallRef.current >= delay) {
                lastCallRef.current = now
                callbackRef.current(...args)
            }
        }) as T,
        [delay]
    )
}
