import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, AlertTriangle, Sparkles, KeyRound } from 'lucide-react'
import { PageHeader, PageLoader, ChartCard, MetricCard } from '@/components/ui/PageElements'
import { FilterDropdown } from '@/components/ui/FormElements'
import { StatusBadge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import {
  ForecastChart,
  ConfidenceGauge,
  HistoricalBarChart,
  ChartLegend,
} from '@/components/charts/Charts'
import { useAsyncData } from '@/hooks'
import { getForecastData } from '@/services/forecast'
import { getGeminiInsight } from '@/services/gemini'
import { BLOOD_TYPES, cn } from '@/utils'

const CRITICAL_THRESHOLD = 10

// ── Risk Timeline ─────────────────────────────────────────────────────────────
function WarningTimeline({ criticalInHours, predictedDate }) {
  const steps = [
    { label: 'Current', status: 'active', desc: 'Monitoring stock levels' },
    { label: 'Warning', status: criticalInHours ? 'upcoming' : 'safe', desc: criticalInHours ? 'Declining trend detected' : 'No warning' },
    { label: 'Critical', status: criticalInHours ? 'danger' : 'safe', desc: criticalInHours ? `Expected in ${criticalInHours}h` : 'Not projected' },
  ]

  return (
    <div className="interactive-card h-full p-6">
      <h3 className="text-sm font-semibold text-text">Risk Timeline</h3>
      <div className="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, i) => (
          <div key={step.label} className="relative flex flex-1 flex-col items-center text-center">
            {i < steps.length - 1 && (
              <div className="absolute left-[calc(50%+20px)] top-4 hidden h-px w-[calc(100%-40px)] bg-gray-200 sm:block" />
            )}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                step.status === 'active' && 'border-primary bg-primary text-white',
                step.status === 'upcoming' && 'border-warning bg-warning/10 text-warning',
                step.status === 'danger' && 'border-critical bg-critical/10 text-critical',
                step.status === 'safe' && 'border-healthy bg-healthy/10 text-healthy'
              )}
            >
              {i + 1}
            </div>
            <p className="mt-3 text-sm font-semibold text-text">{step.label}</p>
            <p className="mt-1 max-w-[120px] text-xs text-text-muted">{step.desc}</p>
          </div>
        ))}
      </div>
      {predictedDate && (
        <p className="mt-4 text-center text-xs text-text-muted">
          Projected critical date: <span className="font-medium text-critical">{predictedDate}</span>
        </p>
      )}
    </div>
  )
}

// ── AI Insight Card ───────────────────────────────────────────────────────────
function AiInsightCard({ geminiContext, confidence, criticalInHours }) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)

  const bloodType = geminiContext?.bloodType
  const predictedCritical = geminiContext?.predictedCritical
  const trend = geminiContext?.trend
  const stockBucket = geminiContext ? Math.floor(geminiContext.currentStock / 2) * 2 : 0

  useEffect(() => {
    if (!geminiContext) return
    setLoading(true)

    // getGeminiInsight always returns a non-null text (falls back to local insight)
    getGeminiInsight(geminiContext).then(({ text, fromCache: cached }) => {
      setInsight(text)
      setFromCache(!!cached)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloodType, predictedCritical, trend, stockBucket])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex h-full lg:col-span-3"
    >
      <div className="interactive-card flex h-full flex-col overflow-hidden border-primary/15">
        {/* Header */}
        <div className="border-b border-primary/10 bg-primary/[0.03] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Brain className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-subheading text-text flex items-center gap-2">
                  AI Insight
                  <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                </h3>
                <p className="text-xs text-text-muted">
                  From NN model output &amp; stock metrics
                </p>
              </div>
            </div>
            {/* Live / Cached badge */}
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              fromCache ? 'bg-gray-100 text-text-muted' : 'bg-primary/10 text-primary'
            )}>
              <motion.span
                className={cn('h-1.5 w-1.5 rounded-full', fromCache ? 'bg-gray-400' : 'bg-primary')}
                animate={{ opacity: loading ? [1, 0.3, 1] : 1 }}
                transition={{ duration: 1, repeat: loading ? Infinity : 0 }}
              />
              {loading ? 'Generating…' : fromCache ? 'Cached' : 'Live'}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-6">
          <div className="flex-1">
            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-2.5">
                <div className="h-3.5 w-full animate-pulse rounded-full bg-gray-100" />
                <div className="h-3.5 w-5/6 animate-pulse rounded-full bg-gray-100" />
                <div className="h-3.5 w-4/6 animate-pulse rounded-full bg-gray-100" />
              </div>
            )}

            {/* Insight text — always present once loaded */}
            {insight && !loading && (
              <motion.p
                key={insight}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-sm leading-relaxed text-text-muted"
              >
                {insight}
              </motion.p>
            )}

            {criticalInHours && !loading && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-critical/20 bg-critical/5 px-4 py-2.5 text-sm font-medium text-critical">
                <AlertTriangle className="h-4 w-4" />
                Action required within {criticalInHours} hours
              </div>
            )}
          </div>

          {/* NN Confidence pinned to bottom */}
          <div className="mt-auto pt-6">
            <div className="inline-flex items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs font-medium">
              <span className="text-text-muted">NN Confidence:</span>
              <span className="font-bold text-primary">{confidence}%</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ForecastPage() {
  const [bloodType, setBloodType] = useState('O-')
  const [dateRange, setDateRange] = useState('14d')
  const { data: forecast, loading } = useAsyncData(
    () => getForecastData(bloodType, dateRange),
    [bloodType, dateRange],
    { refreshIntervalMs: 4000 }
  )

  if (loading || !forecast) return <PageLoader />

  const riskVariant = forecast.riskLevel === 'critical' ? 'critical' : forecast.riskLevel === 'warning' ? 'warning' : 'healthy'

  return (
    <div className="page-container">
      <PageHeader
        title="Shortage Prediction"
        description="Neural network forecasting to anticipate blood stock shortages before they impact patient care"
        badge={
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {forecast.bloodType}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <FilterDropdown
              value={bloodType}
              onChange={setBloodType}
              placeholder="Blood Type"
              options={BLOOD_TYPES.map((t) => ({ value: t, label: t }))}
              className="w-36"
            />
            <FilterDropdown
              value={dateRange}
              onChange={setDateRange}
              placeholder="Date Range"
              options={[
                { value: '7d', label: 'Next 7 Days' },
                { value: '14d', label: 'Next 14 Days' },
                { value: '30d', label: 'Next 30 Days' },
              ]}
              className="w-40"
            />
          </div>
        }
      />

      {/* ── Metric cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current Stock"
          variant={riskVariant}
          value={
            <p className="metric-value">
              <AnimatedNumber value={forecast.currentStock} />
              <span className="ml-1.5 text-lg font-medium text-text-muted">units</span>
            </p>
          }
          sublabel={`${forecast.bloodType} available now`}
        />

        <MetricCard
          label="Critical Countdown"
          variant={forecast.criticalInHours ? 'critical' : 'healthy'}
          value={
            forecast.criticalInHours ? (
              <p className="metric-value text-critical">
                <AnimatedNumber value={forecast.criticalInHours} />
                <span className="text-lg font-medium">h</span>
              </p>
            ) : (
              <p className="metric-value text-healthy">Safe</p>
            )
          }
          sublabel={forecast.criticalInHours ? 'Until critical threshold' : 'No shortage predicted'}
        />

        <MetricCard
          label="Model Confidence"
          value={
            <div className="flex justify-center py-1">
              <ConfidenceGauge value={forecast.confidence} size={140} />
            </div>
          }
        />

        <MetricCard
          label="Risk Assessment"
          variant={riskVariant}
          value={<div className="mt-1"><StatusBadge status={forecast.riskLevel} size="lg" /></div>}
        />
      </div>

      {/* ── Chart ── */}
      <ChartCard
        title="Stock Trend & Forecast"
        description="Solid line shows actual inventory. Dashed line is the NN prediction with confidence bounds."
        legend={
          <ChartLegend
            items={[
              { label: 'Current Stock', color: '#C62828' },
              { label: 'NN Forecast', color: '#FB8C00' },
              { label: 'Critical Threshold', color: '#D32F2F' },
            ]}
          />
        }
      >
        <ForecastChart data={forecast.chartData} criticalThreshold={forecast.criticalThreshold || CRITICAL_THRESHOLD} />
      </ChartCard>

      {/* ── Real Trend Explanation ── */}
      <div className="interactive-card p-6">
        <h3 className="text-sm font-semibold text-text">Trend Explanation</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{forecast.trendExplanation}</p>
      </div>

      {/* ── AI Insight + Risk Timeline ── */}
      <div className="grid items-stretch gap-6 lg:grid-cols-5">
        <AiInsightCard
          geminiContext={forecast.geminiContext}
          confidence={forecast.confidence}
          criticalInHours={forecast.criticalInHours}
        />
        <div className="h-full lg:col-span-2">
          <WarningTimeline
            criticalInHours={forecast.criticalInHours}
            predictedDate={forecast.predictedDate}
          />
        </div>
      </div>

      {/* ── Historical Trend + Recent Predictions ── */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ChartCard title="Historical Trend" description="Monthly usage vs received">
          <HistoricalBarChart data={forecast.historicalTrend} height={200} />
        </ChartCard>
        <div className="interactive-card flex flex-col p-5">
          <h3 className="text-sm font-semibold text-text">Recent Predictions</h3>
          <div className="mt-4 flex flex-1 flex-col justify-center space-y-3">
            {(forecast.allRecentPredictions || []).slice(0, 4).map((pred) => (
              <div key={pred.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <span className="text-sm font-bold text-primary">{pred.bloodType}</span>
                  <p className="text-xs text-text-muted">{pred.prediction}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text">{pred.confidence}%</p>
                  <p className={cn('text-xs capitalize', pred.outcome === 'confirmed' ? 'text-healthy' : pred.outcome === 'pending' ? 'text-warning' : 'text-text-muted')}>
                    {pred.outcome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
