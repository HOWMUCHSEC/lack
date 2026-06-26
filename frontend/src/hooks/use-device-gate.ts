import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as SystemSvc from '../../wailsjs/go/main/SystemService'

const TOKEN_LEN = 12
const DEBUG_PREFIX = '[DeviceGate]'

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^0-9a-f]/g, '')
}

function pickValidTokens(tokens: unknown): string[] {
  if (!Array.isArray(tokens)) return []
  return tokens.map((t) => norm(String(t))).filter((t) => t.length === TOKEN_LEN)
}

function hasIncludeMatch(localMacs: string[], allowedTokens: string[]): boolean {
  const locals = localMacs.map(norm).filter((x) => x.length === TOKEN_LEN)
  const remotes = pickValidTokens(allowedTokens)
  console.debug(DEBUG_PREFIX, '客户端匹配开始', { locals, remotes })
  if (remotes.length === 0 || locals.length === 0) {
    console.debug(DEBUG_PREFIX, '客户端匹配输入为空', {
      localsCount: locals.length,
      remotesCount: remotes.length,
    })
    return false
  }
  const remoteSet = new Set(remotes)
  const hit = locals.find((l) => remoteSet.has(l))
  const ok = Boolean(hit)
  if (ok) {
    console.debug(DEBUG_PREFIX, '客户端匹配命中', { mac: hit })
  } else {
    console.debug(DEBUG_PREFIX, '客户端匹配未命中')
  }
  return ok
}

export function useDeviceGate() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [hasUser, setHasUser] = useState(false)
  const [localMacs, setLocalMacs] = useState<string[]>([])
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  const requestSeqRef = useRef(0)

  const runDeviceCheck = useCallback(async (seq: number) => {
    console.debug(DEBUG_PREFIX, '开始设备检查', { seq })
    try {
      await supabase.auth.refreshSession()
      console.debug(DEBUG_PREFIX, '刷新 session 成功')
    } catch (e) {
      console.warn(DEBUG_PREFIX, '刷新 session 失败', e)
    }
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user || null
    const loggedIn = !!user
    console.debug(DEBUG_PREFIX, '用户状态', { loggedIn, userId: user?.id, email: user?.email })
    if (!loggedIn) {
      console.debug(DEBUG_PREFIX, '未登录，跳过 MAC 检查')
      return { hasUser: false, allowed: true, localMacs: [] }
    }

    let macs: string[] = []
    try {
      macs = (await SystemSvc.GetMACs()) as string[]
      console.debug(DEBUG_PREFIX, '获取本机 MAC 成功', { macs, count: macs.length })
    } catch (e) {
      console.error(DEBUG_PREFIX, '获取本机 MAC 失败', e)
      macs = []
    }

    // Prefer DB-side validation via RPC
    let ok = false
    try {
      console.debug(DEBUG_PREFIX, '调用 RPC is_this_device_allowed', { local_macs: macs })
      const { data: allowedRes, error: allowedErr } = await supabase.rpc('is_this_device_allowed', {
        local_macs: macs,
      })
      if (allowedErr) throw allowedErr
      ok = Boolean(allowedRes)
      console.debug(DEBUG_PREFIX, 'RPC 返回结果', { allowed: ok, raw: allowedRes })
    } catch (e) {
      console.warn(DEBUG_PREFIX, 'RPC 验证失败，回退到客户端匹配', e)
      // Fallback to client-side match using any previously defined rules
      try {
        console.debug(DEBUG_PREFIX, '调用 RPC get_my_mac_tokens')
        const { data: tokensFallback } = await supabase.rpc('get_my_mac_tokens', {
          include_inactive: false,
        })
        const allowedTokens = pickValidTokens(tokensFallback as unknown)
        console.debug(DEBUG_PREFIX, '数据库中的 tokens', { allowedTokens })
        ok = hasIncludeMatch(macs, allowedTokens)
        console.debug(DEBUG_PREFIX, '客户端匹配结果', {
          ok,
          localMacs: macs.map(norm),
          remoteTokens: allowedTokens,
        })
      } catch (e2) {
        console.error(DEBUG_PREFIX, '客户端匹配也失败', e2)
        ok = false
      }
    }
    console.debug(DEBUG_PREFIX, '最终检查结果', { allowed: ok })
    return { hasUser: true, allowed: ok, localMacs: macs }
  }, [])

  const recheck = useCallback(async () => {
    const seq = ++requestSeqRef.current
    if (busyRef.current) {
      pendingRef.current = true
      console.debug(DEBUG_PREFIX, '设备检查进行中，排队重检', { seq })
      return
    }

    busyRef.current = true
    setChecking(true)
    try {
      let activeSeq = seq
      do {
        pendingRef.current = false
        const result = await runDeviceCheck(activeSeq)
        if (activeSeq === requestSeqRef.current) {
          setHasUser(result.hasUser)
          setAllowed(result.allowed)
          setLocalMacs(result.localMacs)
        } else {
          console.debug(DEBUG_PREFIX, '跳过过期设备检查结果', {
            seq: activeSeq,
            latestSeq: requestSeqRef.current,
          })
        }
        activeSeq = requestSeqRef.current
      } while (pendingRef.current)
    } finally {
      busyRef.current = false
      setChecking(false)
      console.debug(DEBUG_PREFIX, '设备检查结束')
    }
  }, [runDeviceCheck])

  useEffect(() => {
    recheck()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        recheck()
      }
      if (event === 'SIGNED_OUT') {
        requestSeqRef.current += 1
        pendingRef.current = false
        setHasUser(false)
        setAllowed(true)
        setLocalMacs([])
        setChecking(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [recheck])

  return useMemo(
    () => ({ checking, allowed, hasUser, localMacs, recheck }),
    [checking, allowed, hasUser, localMacs, recheck],
  )
}
