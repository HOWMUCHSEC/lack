import { createContext, useContext, useEffect, useState, useRef, type PropsWithChildren } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import * as LocalDB from '../../wailsjs/go/main/DB'
import type { UserPlan } from '@/types'

export type { UserPlan }

export interface UserProfile {
  id: string
  email: string
  name: string
  plan: UserPlan
  avatar?: string
}

interface UserContextValue {
  user: UserProfile | null
  loading: boolean
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

/**
 * UserProvider - 全局用户状态管理
 * 统一订阅 Supabase auth 状态变化，避免重复订阅
 */
export function UserProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Track in-flight database operations to prevent concurrent calls
  const switchingUserIdRef = useRef<string | null | 'default'>(null)
  const isInitializedRef = useRef(false)

  // Helper function to switch database with deduplication
  const switchDatabase = async (userId: string | null) => {
    const targetId = userId || 'default'

    // Skip if already switching to this user
    if (switchingUserIdRef.current === targetId) {
      console.log('数据库切换已在进行中，跳过重复调用:', targetId)
      return
    }

    switchingUserIdRef.current = targetId

    try {
      if (userId) {
        await LocalDB.OpenForUser(userId)
        console.log('已切换到用户数据库:', userId)
      } else {
        await LocalDB.OpenForUser('') // Empty string switches to default
        console.log('已切换到默认数据库')
      }
    } catch (e) {
      console.error('数据库切换失败:', e)
      throw e
    } finally {
      switchingUserIdRef.current = null
    }
  }

  useEffect(() => {
    // 获取当前用户
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (authUser) {
          setUser(transformUser(authUser))
          await switchDatabase(authUser.id)
        } else {
          await switchDatabase(null)
        }

        isInitializedRef.current = true
      } catch (error) {
        console.error('获取用户信息失败:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // 监听认证状态变化（全局唯一订阅）
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Skip initial auth state change if we just initialized
      if (!isInitializedRef.current) {
        return
      }

      if (session?.user) {
        setUser(transformUser(session.user))
        switchDatabase(session.user.id).catch((err: unknown) =>
          console.error('切换用户数据库失败:', err),
        )
      } else {
        setUser(null)
        switchDatabase(null).catch((err: unknown) =>
          console.error('切换到默认数据库失败:', err),
        )
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>
}

/**
 * useUser - 获取当前用户状态
 * 必须在 UserProvider 内使用
 */
// eslint-disable-next-line react-refresh/only-export-components -- co-located hook
export function useUser(): UserContextValue {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

function transformUser(authUser: User): UserProfile {
  const metadata = authUser.user_metadata || {}
  const plan = (metadata.plan as UserPlan) || 'trial'

  return {
    id: authUser.id,
    email: authUser.email || '',
    name: metadata.full_name || metadata.name || authUser.email?.split('@')[0] || '用户',
    plan,
    avatar: metadata.avatar_url || metadata.picture,
  }
}
