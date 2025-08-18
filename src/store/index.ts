import { create } from 'zustand'
import { User, Post, Metric, AIAnalysis } from '../types'

interface AppState {
  user: User | null
  token: string | null
  hasUploaded: boolean
  posts: Post[]
  metrics: Metric[]
  analyses: AIAnalysis[]
  preferredAiModel: string
  language: 'en' | 'es'
  isLoading: boolean
  error: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
  setHasUploaded: (v: boolean) => void
  setPosts: (posts: Post[]) => void
  setMetrics: (metrics: Metric[]) => void
  setAnalyses: (analyses: AIAnalysis[]) => void
  setPreferredAiModel: (model: string) => void
  setLanguage: (lang: 'en' | 'es') => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem('fluxon_user')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed?.createdAt) parsed.createdAt = new Date(parsed.createdAt)
      if (parsed?.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt)
      return parsed as User
    } catch {
      return null
    }
  })(),
  token: (() => {
    try { return localStorage.getItem('fluxon_token') } catch { return null }
  })(),
  hasUploaded: (() => {
    try { return localStorage.getItem('fluxon_hasUploaded') === 'true' } catch { return false }
  })(),
  posts: [],
  metrics: [],
  analyses: [],
  preferredAiModel: 'deepseek',
  language: (() => {
    try { return (localStorage.getItem('fluxon_lang') as 'en' | 'es') || 'en' } catch { return 'en' }
  })(),
  isLoading: false,
  error: null,
  setUser: (user) => {
    try {
      if (user) localStorage.setItem('fluxon_user', JSON.stringify(user))
      else localStorage.removeItem('fluxon_user')
    } catch {}
    set({ user })
  },
  setToken: (token) => {
    try {
      if (token) localStorage.setItem('fluxon_token', token)
      else localStorage.removeItem('fluxon_token')
    } catch {}
    set({ token })
  },
  logout: () => {
    try {
      localStorage.removeItem('fluxon_user')
      localStorage.removeItem('fluxon_token')
    } catch {}
    set({ user: null, token: null })
  },
  setHasUploaded: (v) => {
    try { localStorage.setItem('fluxon_hasUploaded', String(v)) } catch {}
    set({ hasUploaded: v })
  },
  setPosts: (posts) => set({ posts }),
  setMetrics: (metrics) => set({ metrics }),
  setAnalyses: (analyses) => set({ analyses }),
  setPreferredAiModel: (model) => set({ preferredAiModel: model }),
  setLanguage: (lang) => {
    try { localStorage.setItem('fluxon_lang', lang) } catch {}
    set({ language: lang })
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))
