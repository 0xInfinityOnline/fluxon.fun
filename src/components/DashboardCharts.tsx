import { Metric, Post } from '../types'
import { useI18n } from '../lib/i18n'

type Point = { x: number; y: number }

const COLORS = {
  green: '#22c55e',
  blue: '#60a5fa',
  amber: '#f59e0b',
  grid: '#1f3d2a',
  axis: '#1f3d2a',
  text: '#a7f3d0',
}

function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const m = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0)
  return (v: number) => {
    if (!isFinite(v)) return r0
    if (d1 === d0) return (r0 + r1) / 2
    return r0 + (v - d0) * m
  }
}

function linePath(points: Point[]) {
  if (points.length === 0) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function getDate(m: Metric) {
  return m.date ? new Date(m.date) : new Date()
}

function ChartLine({
  data,
  xValues,
  yValues,
  color = COLORS.green,
  height = 160,
  padding = 24,
  strokeWidth = 2,
  grid = true,
  label,
  onPointClick,
  selectedX,
}: {
  data: any[]
  xValues: (d: any) => number
  yValues: (d: any) => number
  color?: string
  height?: number
  padding?: number
  strokeWidth?: number
  grid?: boolean
  label?: string
  onPointClick?: (x: number) => void
  selectedX?: number | undefined
}) {
  const width = 420
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const xs = data.map(xValues)
  const ys = data.map(yValues)
  const minX = xs.length ? Math.min(...xs) : 0
  const maxX = xs.length ? Math.max(...xs) : 1
  const minY = 0
  const maxY = ys.length ? Math.max(...ys) : 1
  const sx = scaleLinear([minX, maxX], [padding, padding + innerW])
  const sy = scaleLinear([minY, maxY], [padding + innerH, padding])
  const pts: Point[] = data.map((d) => ({ x: sx(xValues(d)), y: sy(yValues(d)) }))

  const gridLines = grid
    ? [0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={padding} x2={padding + innerW} y1={padding + innerH * t} y2={padding + innerH * t} stroke={COLORS.grid} strokeDasharray="3 4" strokeWidth={1} />
      ))
    : null

  // Axes
  const axes = (
    <g>
      <line x1={padding} y1={padding + innerH} x2={padding + innerW} y2={padding + innerH} stroke={COLORS.axis} />
      <line x1={padding} y1={padding} x2={padding} y2={padding + innerH} stroke={COLORS.axis} />
      <text x={padding - 4} y={padding + innerH} fill={COLORS.text} fontSize={10} textAnchor="end">0</text>
      <text x={padding - 4} y={padding + 8} fill={COLORS.text} fontSize={10} textAnchor="end">{Math.round(maxY)}</text>

      {/* x-axis ticks: min, mid, max */}
      {xs.length > 0 && (
        <g>
          <text x={padding} y={padding + innerH + 12} fill={COLORS.text} fontSize={10} textAnchor="start">{new Date(minX).toLocaleDateString()}</text>
          <text x={padding + innerW / 2} y={padding + innerH + 12} fill={COLORS.text} fontSize={10} textAnchor="middle">{new Date((minX + maxX) / 2).toLocaleDateString()}</text>
          <text x={padding + innerW} y={padding + innerH + 12} fill={COLORS.text} fontSize={10} textAnchor="end">{new Date(maxX).toLocaleDateString()}</text>
        </g>
      )}
    </g>
  )

  // Don't render paths if we don't have valid points
  const pathData = linePath(pts);
  
  return (
    <svg width={width} height={height} className="w-full">
      {gridLines}
      {axes}
      {/* Only render paths if we have valid path data */}
      {pathData && (
        <>
          <path d={`${pathData} L${padding + innerW},${padding + innerH} L${padding},${padding + innerH} Z`} fill={color} opacity={0.12} />
          <path d={pathData} fill="none" stroke={color} strokeWidth={strokeWidth} />
        </>
      )}
      {/* selected day marker */}
      {typeof selectedX === 'number' && (
        <line x1={scaleLinear([minX, maxX], [padding, padding + innerW])(selectedX)} x2={scaleLinear([minX, maxX], [padding, padding + innerW])(selectedX)} y1={padding} y2={padding + innerH} stroke={color} strokeDasharray="4 3" opacity={0.7} />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} style={{ cursor: onPointClick ? 'pointer' : 'default' }} onClick={() => onPointClick?.(xs[i])} />
          <title>{ys[i]}</title>
        </g>
      ))}
      {label && (
        <text x={padding} y={16} fill={COLORS.text} fontSize={12}>
          {label}
        </text>
      )}
    </svg>
  )
}

function ChartBars({
  data,
  xLabel,
  yValues,
  color = COLORS.green,
  height = 200,
  padding = 24,
  maxBars = 10,
  label,
}: {
  data: any[]
  xLabel: (d: any) => string
  yValues: (d: any) => number
  color?: string
  height?: number
  padding?: number
  maxBars?: number
  label?: string
}) {
  const width = 420
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  // Handle empty data case
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className="w-full">
        <text x="50%" y="50%" textAnchor="middle" fill={COLORS.text}>
          No data available
        </text>
      </svg>
    )
  }

  const trimmed = data.slice(0, maxBars)
  const ys = trimmed.map(yValues)
  const maxY = Math.max(...ys, 1) // Ensure we have at least 1 to avoid division by zero
  const barW = Math.max(10, innerW / Math.max(1, trimmed.length)) // Ensure minimum bar width

  return (
    <svg width={width} height={height} className="w-full">
      {trimmed.map((d, i) => {
        const value = yValues(d)
        const h = value > 0 ? (value / maxY) * innerH : 0
        return (
          <g key={i} transform={`translate(${padding + i * barW}, ${padding + innerH - Math.max(0, h)})`}>
            <rect 
              width={Math.max(0, barW - 2)} 
              height={Math.max(0, h)} 
              fill={color} 
              rx={2}
            />
            <rect x={-10} y={-20} width={barW + 20} height={40} fill="transparent">
              <title>{value}</title>
            </rect>
          </g>
        )
      })}
      {label && (
        <text x={padding} y={16} fill={COLORS.text} fontSize={12}>
          {label}
        </text>
      )}
    </svg>
  )
}

export function DashboardCharts({ metrics, posts, onSelectDay, selectedDay }: { metrics: Metric[]; posts: Post[]; onSelectDay?: (d: Date) => void; selectedDay?: Date }) {
  const { t } = useI18n()
  // Prepare time series
  const series = [...metrics]
    .map((m) => ({
      t: getDate(m).getTime(),
      impressions: (m as any).impresiones ?? (m as any).impressions ?? 0,
      likes: (m as any).meGusta ?? (m as any).likes ?? 0,
      interactions: (m as any).interacciones ?? (m as any).interactions ?? 0,
    }))
    .sort((a, b) => a.t - b.t)

  const topPosts = [...posts]
    .map((p) => ({
      id: p.id,
      text: p.content || '',
      likes: p.likes ?? 0,
      impressions: p.impressions ?? 0,
    }))
    .sort((a, b) => (b.likes - a.likes) || (b.impressions - a.impressions))

  // Summary stats
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const totalImpr = sum(series.map((d) => d.impressions))
  const totalLikes = sum(series.map((d) => d.likes))
  const totalInter = sum(series.map((d) => d.interactions))

  // Best posting time heatmap (weekday x hour) using likes
  const buckets: Record<string, { count: number; likes: number }> = {}
  posts.forEach((p) => {
    const dt = p.publishedAt ? new Date(p.publishedAt) : null
    if (!dt) return
    const w = dt.getDay() // 0-6
    const h = dt.getHours() // 0-23
    const key = `${w}-${h}`
    if (!buckets[key]) buckets[key] = { count: 0, likes: 0 }
    buckets[key].count += 1
    buckets[key].likes += p.likes ?? 0
  })
  let maxAvg = 0
  const avg = (w: number, h: number) => {
    const b = buckets[`${w}-${h}`]
    if (!b || b.count === 0) return 0
    const v = b.likes / b.count
    if (v > maxAvg) maxAvg = v
    return v
  }
  const dayNames = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')]

  // Top mentions from post text
  const mentionCounts: Record<string, number> = {}
  posts.forEach((p) => {
    const text = p.content || ''
    const matches = text.match(/@([A-Za-z0-9_]{2,30})/g) || []
    matches.forEach((m) => {
      const key = m.toLowerCase()
      mentionCounts[key] = (mentionCounts[key] || 0) + 1
    })
  })
  const mentions = Object.entries(mentionCounts)
    .map(([handle, count]) => ({ handle, count }))
    .sort((a, b) => b.count - a.count)

  // Selected day marker (align to nearest point in series)
  const selT = selectedDay ? new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate()).getTime() : undefined
  const dayEq = (t: number) => {
    const d = new Date(t)
    return selectedDay && d.getFullYear() === selectedDay.getFullYear() && d.getMonth() === selectedDay.getMonth() && d.getDate() === selectedDay.getDate()
  }
  const selectedX = selT && series.find((s) => dayEq(s.t))?.t

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-emerald-700/30 p-4 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <div className="text-sm text-green-500/80 mb-2">{t('totals')}</div>
        <div className="flex gap-6 text-lg">
          <div><span className="text-green-500/80">{t('impressions').slice(0,4)}.</span> <span className="font-bold">{totalImpr}</span></div>
          <div><span className="text-green-500/80">{t('likes')}</span> <span className="font-bold">{totalLikes}</span></div>
          <div><span className="text-green-500/80">{t('interactionsShort')}</span> <span className="font-bold">{totalInter}</span></div>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <ChartLine
          data={series}
          xValues={(d) => d.t}
          yValues={(d) => d.impressions}
          label={t('impressionsOverTime')}
          onPointClick={(t) => onSelectDay?.(new Date(t))}
          selectedX={selectedX}
        />
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <ChartLine data={series} xValues={(d) => d.t} yValues={(d) => d.likes} label={t('likesOverTime')} color={COLORS.blue} onPointClick={(t) => onSelectDay?.(new Date(t))} selectedX={selectedX} />
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <ChartLine data={series} xValues={(d) => d.t} yValues={(d) => d.interactions} label={t('engagementTrend')} color={COLORS.amber} onPointClick={(t) => onSelectDay?.(new Date(t))} selectedX={selectedX} />
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <ChartBars data={topPosts} xLabel={(d) => String(d.id)} yValues={(d) => d.likes} label={t('topPostsByLikes')} />
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 md:col-span-2 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <div className="text-sm text-green-500/80 mb-2">{t('bestPostingTime')}</div>
        <div className="overflow-x-auto">
          <svg width={720} height={240} className="w-full">
            {/* day labels */}
            {dayNames.map((d, i) => (
              <text key={d} x={8} y={40 + i * 26} fill={COLORS.text} fontSize={10}>{d}</text>
            ))}
            {/* hour labels every 3h */}
            {Array.from({ length: 24 }).map((_, h) => (
              h % 3 === 0 ? <text key={h} x={40 + h * 26} y={24} fill={COLORS.text} fontSize={10} textAnchor="middle">{h}</text> : null
            ))}
            {/* cells */}
            {Array.from({ length: 7 }).map((_, w) => (
              Array.from({ length: 24 }).map((_, h) => {
                const v = avg(w, h)
                const alpha = maxAvg ? Math.min(1, v / maxAvg) : 0
                const fill = `rgba(34,197,94,${alpha})`
                return <rect key={`${w}-${h}`} x={30 + h * 26} y={28 + w * 26} width={24} height={24} rx={5} fill={fill} stroke={COLORS.grid} />
              })
            ))}
          </svg>
        </div>
      </div>
      <div className="rounded-xl border border-emerald-700/30 p-4 md:col-span-2 bg-gradient-to-b from-emerald-900/20 to-emerald-900/5 shadow-lg shadow-emerald-900/10">
        <div className="text-sm text-green-500/80 mb-2">{t('topMentions')}</div>
        <ChartBars data={mentions} xLabel={(d) => d.handle} yValues={(d) => d.count} label={t('handlesByCount')} />
      </div>
    </div>
  )
}
