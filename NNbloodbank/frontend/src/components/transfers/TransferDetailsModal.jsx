import { AnimatePresence, motion } from 'framer-motion'
import { X, Check, AlertTriangle, ShieldCheck, ShieldAlert, Droplets, Clock, MapPin, Sparkles, AlertCircle, Flame } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UrgencyBadge } from '@/components/ui/Badge'
import { cn } from '@/utils'

/* ─── helpers ─────────────────────────────────────── */
function Section({ title, icon: Icon, children, accent = 'gray', className }) {
  const accentClasses = {
    gray:     'border-gray-100 bg-gray-50/60',
    blue:     'border-blue-100  bg-blue-50/50',
    red:      'border-red-100   bg-red-50/50',
    orange:   'border-orange-100 bg-orange-50/50',
    green:    'border-green-100  bg-green-50/40',
    critical: 'border-critical/20 bg-critical/[0.04]',
    warning:  'border-warning/20  bg-warning/[0.04]',
    healthy:  'border-healthy/20  bg-healthy/[0.03]',
  }
  return (
    <div className={cn('rounded-2xl border p-5', accentClasses[accent], className)}>
      {(title || Icon) && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-text-muted" />}
          {title && <p className="text-sm font-semibold text-text">{title}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

function StockBar({ current, after, threshold }) {
  const maxVal = Math.max(current, threshold * 2, 1)
  const pctCurrent = Math.min((current / maxVal) * 100, 100)
  const pctAfter   = Math.min((after   / maxVal) * 100, 100)
  const pctThresh  = Math.min((threshold / maxVal) * 100, 100)

  return (
    <div className="space-y-2">
      {/* Current */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-text-muted">
          <span>Current stock</span>
          <span className="font-semibold text-text">{current} units</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary/60 transition-all duration-700"
            style={{ width: `${pctCurrent}%` }}
          />
          {/* threshold marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-orange-400"
            style={{ left: `${pctThresh}%` }}
          />
        </div>
      </div>

      {/* After transfer */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-text-muted">
          <span>After transfer</span>
          <span className={cn('font-semibold', after < threshold ? 'text-critical' : after <= threshold + 2 ? 'text-warning' : 'text-healthy')}>
            {after} units
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              after < threshold ? 'bg-critical/70' : after <= threshold + 2 ? 'bg-warning/70' : 'bg-healthy/70'
            )}
            style={{ width: `${pctAfter}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-orange-400"
            style={{ left: `${pctThresh}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] text-text-light">
        Orange marker = critical threshold ({threshold} units)
      </p>
    </div>
  )
}

/* ─── main modal ─────────────────────────────────── */
export function TransferDetailsModal({ isOpen, onClose, detail, onAccept, onReject }) {
  if (!detail) return null
  const { detail: d, ...request } = detail
  const isPending  = request.status === 'pending'

  const riskIcon  = d.stockRisk === 'critical'
    ? AlertTriangle
    : d.stockRisk === 'warning'
      ? ShieldAlert
      : ShieldCheck

  const riskAccent = d.stockRisk === 'critical'
    ? 'critical'
    : d.stockRisk === 'warning'
      ? 'warning'
      : 'healthy'

  const riskTextColor = {
    critical: 'text-critical',
    warning:  'text-warning',
    safe:     'text-healthy',
  }[d.stockRisk] || 'text-healthy'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22 }}
              className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-100 p-6 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-text">Transfer Request Details</h2>
                  <p className="mt-0.5 text-sm text-text-muted">
                    From <span className="font-medium text-text">{request.requestingHospital.name}</span>
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* ① Request Context */}
                <Section title="Request Context" icon={AlertCircle} accent="blue">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">Blood Type</p>
                      <p className="mt-1 text-lg font-bold text-primary">{request.bloodType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">Units Requested</p>
                      <p className="mt-1 text-lg font-bold text-text">{request.units}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">Distance</p>
                      <p className="mt-1 text-lg font-bold text-text">{request.distance} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">Urgency</p>
                      <div className="mt-1"><UrgencyBadge urgency={request.urgency} /></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">AI Match</p>
                      <p className="mt-1 text-sm font-semibold text-healthy">{request.aiScore}% confidence</p>
                    </div>
                  </div>

                  {/* Forecast reason */}
                  <div className="mt-3 rounded-xl border border-blue-100 bg-white/70 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-1">Why the model flagged this</p>
                    <p className="text-sm text-text-muted">{d.forecastContext.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-muted">
                      <span>Their stock: <strong className="text-critical">{d.forecastContext.requestingCurrentStock} units</strong></span>
                      <span>Threshold: <strong>{d.forecastContext.requestingThreshold} units</strong></span>
                      {d.forecastContext.deficit > 0 && (
                        <span>Deficit: <strong className="text-critical">{d.forecastContext.deficit} units</strong></span>
                      )}
                    </div>
                  </div>
                </Section>

                {/* ② Impact on Your Stock */}
                <Section title="Impact on Your Stock" icon={Droplets} accent={riskAccent}>
                  <StockBar
                    current={d.myCurrentStock}
                    after={d.myStockAfter}
                    threshold={d.threshold}
                  />

                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-white/80 border border-gray-100 p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">Your stock now</p>
                      <p className="mt-1 text-lg font-bold text-text">{d.myCurrentStock}</p>
                      <p className="text-[10px] text-text-muted">units</p>
                    </div>
                    <div className="flex items-center justify-center text-2xl text-text-light">→</div>
                    <div className={cn(
                      'rounded-xl border p-2.5',
                      d.stockRisk === 'critical' ? 'border-critical/20 bg-critical/5' :
                      d.stockRisk === 'warning'  ? 'border-warning/20  bg-warning/5'  :
                      'border-healthy/20 bg-healthy/5'
                    )}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-light">After transfer</p>
                      <p className={cn('mt-1 text-lg font-bold', riskTextColor)}>{d.myStockAfter}</p>
                      <p className="text-[10px] text-text-muted">units remaining</p>
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className={cn(
                    'mt-3 flex items-start gap-2 rounded-xl border p-3',
                    d.stockRisk === 'critical' ? 'border-critical/20 bg-critical/[0.06]' :
                    d.stockRisk === 'warning'  ? 'border-warning/20  bg-warning/[0.06]'  :
                    'border-healthy/20 bg-healthy/[0.06]'
                  )}>
                    {(() => {
                      const RIcon = riskIcon
                      return <RIcon className={cn('mt-0.5 h-4 w-4 shrink-0', riskTextColor)} />
                    })()}
                    <p className={cn('text-sm font-medium', riskTextColor)}>{d.stockVerdict}</p>
                  </div>
                </Section>

                {/* ③ Expiry Context (conditional) */}
                {d.nearExpiry && d.expiryNote && (
                  <Section title="Expiry Context" icon={Clock} accent="orange">
                    <div className="flex items-start gap-2">
                      <Flame className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <p className="text-sm text-text-muted">{d.expiryNote}</p>
                    </div>
                    <p className="mt-2 text-xs font-medium text-warning">
                      Transferring near-expiry units prevents wastage and serves an immediate need.
                    </p>
                  </Section>
                )}

              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 p-5">
                {isPending ? (
                  <>
                    <Button variant="danger" onClick={() => onReject(request)}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button variant="success" onClick={() => onAccept(request)}>
                      <Check className="h-4 w-4" /> Accept Transfer
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={onClose}>Close</Button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
