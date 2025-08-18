import { useEffect, useState } from 'react'
import './App.css'
import { CSVUpload } from './components/CSVUpload'
import { useAppStore } from './store'
import { useI18n } from './lib/i18n'
import { DashboardCharts } from './components/DashboardCharts'

function App() {
  const { user, setUser, error, isLoading, setError, setToken, logout, hasUploaded, setHasUploaded, token, setMetrics, setPosts, metrics, posts, language, setLanguage } = useAppStore()
  const { t } = useI18n()
  const [fileUploaded, setFileUploaded] = useState(hasUploaded)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [aiText, setAiText] = useState('')
  // Date filters & drilldown
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined)
  const [postQuery, setPostQuery] = useState<string>('')

  const inRange = (d?: Date) => {
    if (!d) return true
    let ok = true
    if (dateFrom) ok = ok && d >= new Date(dateFrom)
    if (dateTo) ok = ok && d <= new Date(`${dateTo}T23:59:59`)
    return ok
  }
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const displayMetrics = metrics.filter((m: any) => inRange(m?.date ? new Date(m.date) : undefined))
  const postsByRange = posts.filter((p: any) => inRange(p?.publishedAt ? new Date(p.publishedAt) : undefined))
  const byDay = selectedDay
    ? postsByRange.filter((p: any) => p.publishedAt && sameDay(new Date(p.publishedAt), selectedDay))
    : postsByRange
  const displayPosts = byDay.filter((p: any) => {
    if (!postQuery) return true
    const q = postQuery.toLowerCase()
    return (
      (p.content || '').toLowerCase().includes(q) ||
      ((p as any).handle || '').toLowerCase().includes(q)
    )
  })
  const [aiResult, setAiResult] = useState<{ recommendations?: string; viralityScore?: number } | null>(null)
  const [sortBy, setSortBy] = useState<'likes' | 'impressions' | 'engagementRate'>('likes')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [minValue, setMinValue] = useState<number>(0)
  const [uploads, setUploads] = useState<Array<{ uploadId: string; csvType: 'overview' | 'content'; fileName?: string; rowsImported: number; uploadedAt: string }>>([])
  // Pagination for posts table
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)
  // Connected user display name
  const displayName = user ? ((user as any).username || user.email) : ''

  const extractHandle = (url?: string): string | undefined => {
    if (!url) return undefined
    try {
      const u = new URL(url)
      // expected: x.com/<handle>/status/<id>
      const seg = u.pathname.split('/').filter(Boolean)
      const handle = seg[0]
      if (handle && handle.length <= 30) return handle.startsWith('@') ? handle : `@${handle}`
    } catch { }
    return undefined
  }

  const loadAnalytics = async () => {
    if (!user?.id) return
    try {
      setError(null)
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const [mResp, pResp] = await Promise.all([
        fetch(`http://localhost:3001/api/analytics/metrics/${user.id}`, { headers }),
        fetch(`http://localhost:3001/api/analytics/posts/${user.id}?limit=1000`, { headers }),
      ])
      const mData = await mResp.json()
      const pData = await pResp.json()
      if (!mResp.ok) throw new Error(mData?.error || 'Failed loading metrics')
      if (!pResp.ok) throw new Error(pData?.error || 'Failed loading posts')
      setMetrics(mData)
      // map backend -> frontend Post
      const mappedPosts = (Array.isArray(pData) ? pData : []).map((p: any) => ({
        id: String(p.postId ?? p.id ?? ''),
        userId: String(user?.id ?? ''),
        content: String(p.textoPost ?? p.content ?? ''),
        hashtags: undefined,
        publishedAt: p.fecha ? new Date(p.fecha) : undefined,
        engagementRate: p.interacciones ?? undefined,
        impressions: p.impresiones ?? p.impressions ?? 0,
        likes: p.meGusta ?? p.likes ?? 0,
        url: p.urlPost ?? p.url ?? undefined,
        handle: extractHandle(p.urlPost ?? p.url ?? undefined),
        createdAt: new Date(),
      }))
      setPosts(mappedPosts)
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics')
    }
  }

  const loadUploads = async () => {
    if (!token) return
    try {
      const resp = await fetch('http://localhost:3001/api/csv/uploads', { headers: { Authorization: `Bearer ${token}` } })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Failed to load uploads')
      setUploads(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load uploads')
    }
  }

  useEffect(() => {
    if (user) {
      if (fileUploaded) void loadAnalytics()
      void loadUploads()
    }
  }, [user, fileUploaded])

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
  }, [sortBy, sortDir, minValue, postQuery, dateFrom, dateTo, selectedDay])

  const resetData = async () => {
    if (!token) return setError('You must be logged in')
    if (!confirm('Delete all your uploaded data? This cannot be undone.')) return
    try {
      const resp = await fetch('http://localhost:3001/api/csv/reset', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to reset')
      }
      setMetrics([])
      setPosts([])
      setUploads([])
      setHasUploaded(false)
      setAiResult(null)
      setAiText('')
      setFileUploaded(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to reset')
    }
  }

  const analyzeText = async () => {
    if (!token || !user?.id) return setError('You must be logged in')
    if (!aiText.trim()) return setError('Please enter some text to analyze')
    try {
      setError(null)
      const resp = await fetch('http://localhost:3001/api/ai/analyze-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: aiText, userId: user.id, modelName: 'deepseek' }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'AI analysis failed')
      setAiResult({ recommendations: data.recommendations, viralityScore: data.viralityScore })
    } catch (e: any) {
      setError(e?.message || 'AI analysis failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute top-1/2 -right-4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center transform rotate-6 hover:rotate-12 transition-transform duration-300">
                <span className="text-2xl font-black">F</span>
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Fluxon.Fun
                </h1>
                <p className="text-sm text-white/60 font-medium">Social Media Analytics with AI</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Created by text - only shown on larger screens */}
              <div className="hidden md:flex items-center text-sm text-white/60">
                {t('createdBy')}
                <a
                  href="https://x.com/0xInfinityAI"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 text-purple-300 hover:text-purple-200 font-medium flex items-center"
                >
                  @0xInfinityAI
                </a>
              </div>

              {/* Donation Button */}
              <a
                href="https://www.buymeacoffee.com/0xInfinityAI"
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-semibold px-4 py-2 rounded-full text-sm transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-amber-500/30"
              >
                <span className="text-base">☕</span>
                <span>{t('donate')}</span>
              </a>

              {user && (
                <>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-white/60 font-medium">{t('language')}</label>
                    <select
                      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                    >
                      <option value="en">{t('english')}</option>
                      <option value="es">{t('spanish')}</option>
                    </select>
                  </div>
                  <button
                    className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-2 text-sm font-medium hover:bg-white/20 transition-all duration-300 hover:scale-105"
                    onClick={() => logout()}
                  >
                    {t('logout')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          {!user ? (
            /* Auth Section */
            <div className="max-w-md mx-auto">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2">
                    {mode === 'login' ? t('signIn') : t('register')}
                  </h2>
                  <p className="text-white/60">
                    {mode === 'login' ? 'Welcome back!' : 'Join the community'}
                  </p>
                </div>

                <div className="space-y-6">
                  {mode === 'register' && (
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">{t('username')}</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        type="text"
                        className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                        placeholder={t('yourHandle')}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{t('email')}</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder={t('emailPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{t('password')}</label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold py-4 rounded-xl hover:from-purple-600 hover:to-cyan-600 transform hover:scale-[1.02] transition-all duration-300 shadow-lg"
                    onClick={async () => {
                      try {
                        setError(null)
                        const url = mode === 'login' ? 'http://localhost:3001/api/auth/login' : 'http://localhost:3001/api/auth/register'
                        const body: any = mode === 'login' ? { email, password } : { username, email, password }
                        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                        const data = await resp.json()
                        if (!resp.ok) throw new Error(data?.error || 'Auth failed')
                        setToken(data.token)
                        const u = data.user
                        // Persist username if available so it can be displayed in the dashboard header
                        setUser({ id: String(u.userId), email: u.email, preferredAiModel: u.selectedAiModel, createdAt: new Date(u.createdAt), updatedAt: new Date(), username: (u as any).username } as any)
                      } catch (e: any) {
                        setError(e?.message || 'Auth failed')
                      }
                    }}
                  >
                    {mode === 'login' ? t('signIn') : t('register')}
                  </button>

                  <div className="text-center">
                    <button
                      className="text-white/60 hover:text-white underline text-sm font-medium transition-colors duration-300"
                      onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                    >
                      {mode === 'login' ? t('needAccount') : t('haveAccount')}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
                    <p className="text-sm text-red-200">{error}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Dashboard Section */
            <div className="space-y-8">
              {!fileUploaded ? (
                /* Upload Prompt */
                <div className="text-center py-20">
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-12 max-w-2xl mx-auto">
                    <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-8 transform rotate-6">
                      <span className="text-3xl">📊</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-4">{t('uploadMoreCSVs')}</h2>
                    <p className="text-white/60 text-lg mb-8">{t('csvSupportTitle')}</p>
                    <CSVUpload onUploadComplete={() => { setFileUploaded(true); setHasUploaded(true) }} />
                  </div>
                </div>
              ) : (
                /* Main Dashboard */
                <div className="space-y-8">
                  {/* Dashboard Header */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-3xl font-bold mb-2">{t('dashboard')}</h2>
                        {displayName && (
                          <div className="text-sm text-white/70 mb-1">
                            {t('user')}: <span className="font-semibold">{displayName}</span>
                          </div>
                        )}
                        <p className="text-white/60">Track your social media performance</p>
                      </div>
                      <div className="flex gap-4">
                        <button
                          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 text-sm font-medium hover:bg-white/20 transition-all duration-300 hover:scale-105"
                          onClick={() => loadAnalytics()}
                        >
                          {t('refresh')}
                        </button>
                        <button
                          className="bg-red-500/20 border border-red-500/50 rounded-full px-6 py-3 text-sm font-medium hover:bg-red-500/30 transition-all duration-300 hover:scale-105"
                          onClick={resetData}
                        >
                          {t('resetData')}
                        </button>
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white/5 rounded-2xl p-6 mb-8">
                      <div className="flex flex-wrap gap-4 items-end">
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('from')}</label>
                          <input
                            type="date"
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('to')}</label>
                          <input
                            type="date"
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                          />
                        </div>
                        <button
                          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm font-medium hover:bg-white/20 transition-all duration-300"
                          onClick={() => {
                            setDateFrom('');
                            setDateTo('');
                            setSelectedDay(undefined);
                          }}
                        >
                          {t('clear')}
                        </button>
                        {selectedDay && (
                          <div className="bg-purple-500/20 border border-purple-500/50 rounded-xl px-4 py-2 text-sm">
                            {t('day')}: {selectedDay.toLocaleDateString()}
                            <button className="ml-3 text-purple-300 hover:text-white" onClick={() => setSelectedDay(undefined)}>×</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/60 text-sm font-medium">{t('accountOverviewRows')}</p>
                            <p className="text-3xl font-bold mt-2">{displayMetrics.length}</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center">
                            📈
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/60 text-sm font-medium">{t('postsIngested')}</p>
                            <p className="text-3xl font-bold mt-2">{displayPosts.length}</p>
                          </div>
                          <div className="w-12 h-12 bg-cyan-500/30 rounded-xl flex items-center justify-center">
                            📝
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="bg-white/5 rounded-2xl p-6">
                      <DashboardCharts
                        metrics={displayMetrics as any}
                        posts={displayPosts as any}
                        onSelectDay={(d) => setSelectedDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
                        selectedDay={selectedDay}
                      />
                    </div>
                  </div>

                  {/* Posts Table Section */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                    <h3 className="text-2xl font-bold mb-6">Posts Analysis</h3>

                    {posts.length === 0 && (
                      <div className="text-center py-8 text-yellow-300/90">
                        {t('noPostsYet')}
                      </div>
                    )}

                    {/* Table Controls */}
                    <div className="bg-white/5 rounded-2xl p-6 mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('sortBy')}</label>
                          <select
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                          >
                            <option value="impressions">{t('impressions')}</option>
                            <option value="likes">{t('likes')}</option>
                            <option value="engagementRate">{t('engagement')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('minValue')}</label>
                          <input
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            type="number"
                            value={minValue}
                            onChange={(e) => setMinValue(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('direction')}</label>
                          <select
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={sortDir}
                            onChange={(e) => setSortDir(e.target.value as any)}
                          >
                            <option value="desc">{t('desc')}</option>
                            <option value="asc">{t('asc')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('perPage')}</label>
                          <select
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                          >
                            {[10, 20, 50, 100].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-white/60 mb-2">{t('search')}</label>
                          <input
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="text or @handle"
                            value={postQuery}
                            onChange={(e) => { setPostQuery(e.target.value); setPage(1) }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Posts Table */}
                    <div className="bg-white/5 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-white/10 border-b border-white/20">
                            <tr>
                              <th className="text-left py-4 px-6 font-semibold">{t('date')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('user')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('text')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('likes')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('impressions').slice(0, 4)}.</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('interactionsShort')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('link')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const filtered = displayPosts
                                .filter((p) => {
                                  const v = sortBy === 'likes' ? (p.likes ?? 0) : sortBy === 'impressions' ? (p.impressions ?? 0) : (p.engagementRate ?? 0)
                                  return v >= minValue
                                })
                                .sort((a, b) => {
                                  const av = sortBy === 'likes' ? (a.likes ?? 0) : sortBy === 'impressions' ? (a.impressions ?? 0) : (a.engagementRate ?? 0)
                                  const bv = sortBy === 'likes' ? (b.likes ?? 0) : sortBy === 'impressions' ? (b.impressions ?? 0) : (b.engagementRate ?? 0)
                                  return sortDir === 'desc' ? bv - av : av - bv
                                })
                                .filter((p) => {
                                  if (!postQuery) return true
                                  const text = p.content ?? ''
                                  const handle = (p as any).handle ?? ''
                                  return text.toLowerCase().includes(postQuery.toLowerCase()) || handle.toLowerCase().includes(postQuery.toLowerCase())
                                })
                              const total = filtered.length
                              const totalPages = Math.max(1, Math.ceil(total / perPage))
                              const safePage = Math.min(page, totalPages)
                              const start = (safePage - 1) * perPage
                              const end = start + perPage
                              return filtered.slice(start, end).map((p) => (
                                <tr key={String(p.id)} className="border-b border-white/10 hover:bg-white/5 transition-colors duration-200">
                                  <td className="py-4 px-6">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : '—'}</td>
                                  <td className="py-4 px-6">
                                    <span className="bg-purple-500/20 border border-purple-500/50 rounded-full px-3 py-1 text-xs font-medium">
                                      {(p as any).handle ?? '—'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 max-w-[420px] truncate" title={p.content ?? ''}>{p.content ?? '—'}</td>
                                  <td className="py-4 px-6">
                                    <span className="bg-pink-500/20 border border-pink-500/50 rounded-lg px-2 py-1 text-xs font-bold">
                                      {p.likes ?? 0}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    <span className="bg-cyan-500/20 border border-cyan-500/50 rounded-lg px-2 py-1 text-xs font-bold">
                                      {p.impressions ?? 0}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    <span className="bg-green-500/20 border border-green-500/50 rounded-lg px-2 py-1 text-xs font-bold">
                                      {p.engagementRate ?? 0}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    {(p as any).url ? (
                                      <a
                                        className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 hover:scale-105"
                                        href={(p as any).url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {t('open')}
                                      </a>
                                    ) : '—'}
                                  </td>
                                </tr>
                              ))
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {(() => {
                      const total = displayPosts
                        .filter((p) => {
                          const v = sortBy === 'likes' ? (p.likes ?? 0) : sortBy === 'impressions' ? (p.impressions ?? 0) : (p.engagementRate ?? 0)
                          return v >= minValue
                        })
                        .filter((p) => {
                          if (!postQuery) return true
                          const text = p.content ?? ''
                          const handle = (p as any).handle ?? ''
                          return text.toLowerCase().includes(postQuery.toLowerCase()) || handle.toLowerCase().includes(postQuery.toLowerCase())
                        }).length
                      const totalPages = Math.max(1, Math.ceil(total / perPage))
                      const safePage = Math.min(page, totalPages)
                      return (
                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/20">
                          <div className="text-sm text-white/60">
                            {t('page')} {safePage} {t('of')} {totalPages} • {perPage} {t('perPage')}
                          </div>
                          <div className="flex gap-3">
                            <button
                              className="bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm font-medium hover:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={safePage <= 1}
                            >
                              {t('prev')}
                            </button>
                            <button
                              className="bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm font-medium hover:bg-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safePage >= totalPages}
                            >
                              {t('next')}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Upload Management Section */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold">{t('uploadMore')}</h3>
                      <button
                        className="bg-white/10 border border-white/20 rounded-full px-6 py-2 text-sm font-medium hover:bg-white/20 transition-all duration-300"
                        onClick={loadUploads}
                      >
                        {t('refreshList')}
                      </button>
                    </div>

                    {uploads.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-white/60">{t('noUploadsYet')}</p>
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-2xl overflow-hidden mb-6">
                        <table className="w-full text-sm">
                          <thead className="bg-white/10 border-b border-white/20">
                            <tr>
                              <th className="text-left py-4 px-6 font-semibold">{t('fileName')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('type')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('rowsImported')}</th>
                              <th className="text-left py-4 px-6 font-semibold">{t('uploadedAt')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uploads.map((u) => (
                              <tr key={u.uploadId} className="border-b border-white/10 hover:bg-white/5 transition-colors duration-200">
                                <td className="py-4 px-6 font-medium">{u.fileName ?? '—'}</td>
                                <td className="py-4 px-6">
                                  <span className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/50 rounded-full px-3 py-1 text-xs font-bold">
                                    {u.csvType}
                                  </span>
                                </td>
                                <td className="py-4 px-6">
                                  <span className="bg-green-500/20 border border-green-500/50 rounded-lg px-2 py-1 text-xs font-bold">
                                    {u.rowsImported}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-white/60">{new Date(u.uploadedAt).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* New Upload Section */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/30 rounded-2xl p-6">
                      <h4 className="text-lg font-semibold mb-4">Upload New CSV</h4>
                      <CSVUpload onUploadComplete={() => { setHasUploaded(true); setFileUploaded(true); void loadUploads(); void loadAnalytics(); }} />
                    </div>
                  </div>

                  {/* AI Analysis Section */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                        🤖
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{t('agentTitle')}</h3>
                        <p className="text-white/60">{t('agentSubtitle')}</p>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-6">
                      <textarea
                        value={aiText}
                        onChange={(e) => setAiText(e.target.value)}
                        placeholder={t('postIdeaPlaceholder')}
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[120px] resize-none transition-all duration-300"
                      />
                      <div className="mt-4">
                        <button
                          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-8 rounded-xl hover:from-purple-600 hover:to-pink-600 transform hover:scale-[1.02] transition-all duration-300 shadow-lg"
                          onClick={analyzeText}
                        >
                          {t('analyze')} ✨
                        </button>
                      </div>

                      {aiResult && (
                        <div className="mt-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-green-500/30 rounded-lg flex items-center justify-center">
                              📊
                            </div>
                            <div>
                              <p className="text-sm text-white/60 font-medium">{t('viralityScore')}</p>
                              <p className="text-2xl font-bold text-green-400">{aiResult.viralityScore ?? '—'}</p>
                            </div>
                          </div>
                          {aiResult.recommendations && (
                            <div className="bg-white/10 rounded-xl p-4">
                              <h4 className="font-semibold mb-2 text-green-300">Recommendations:</h4>
                              <div className="whitespace-pre-wrap text-white/90 text-sm leading-relaxed">{aiResult.recommendations}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {posts.length === 0 && (
                    <div className="text-center py-8">
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-2xl p-6 max-w-md mx-auto">
                        <p className="text-yellow-300/90">{t('noPostsLoaded')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-6 py-3">
                <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                <span className="text-sm font-medium">{t('processing')}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-red-500/30 rounded-full flex items-center justify-center">⚠️</div>
                  <p className="text-sm text-red-200 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm text-white/60">
              Built with ❤️ by{' '}
              <a
                className="text-purple-400 hover:text-purple-300 underline transition-colors duration-300"
                href="https://x.com/0xInfinityAI"
                target="_blank"
                rel="noreferrer"
              >
                @0xInfinityAI
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App