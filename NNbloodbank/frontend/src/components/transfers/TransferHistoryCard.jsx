import { motion } from 'framer-motion'
import { ArrowRight, Check, X, Clock } from 'lucide-react'
import { cn } from '@/utils'

const STATUS_CONFIG = {
  completed:   { label: 'Completed',    dot: 'bg-healthy',  text: 'text-healthy',    ring: 'border-healthy/30  bg-healthy/[0.03]'  },
  in_progress: { label: 'In Progress',  dot: 'bg-blue-500', text: 'text-blue-600',   ring: 'border-blue-200    bg-blue-50/40'       },
  accepted:    { label: 'Accepted',     dot: 'bg-healthy',  text: 'text-healthy',    ring: 'border-healthy/20  bg-healthy/[0.02]'   },
  rejected:    { label: 'Rejected',     dot: 'bg-gray-400', text: 'text-text-muted', ring: 'border-gray-200    bg-gray-50/60 opacity-70' },
  pending:     { label: 'Request Sent', dot: 'bg-warning',  text: 'text-warning',    ring: 'border-orange-200  bg-orange-50/30'     },
}

export function TransferHistoryCard({ entry, index = 0 }) {
  if (!entry) return null   // guard: never crash on undefined entry

  const cfg        = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending
  const isOutgoing = entry.direction === 'outgoing'

  // Null-safe — prevents crash when sessionHistory entry fields are undefined
  const fromName = entry.fromHospital?.name || '—'
  const toName   = entry.toHospital?.name   || '—'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn('interactive-card overflow-hidden', cfg.ring)}
    >
      <div className="flex items-center gap-4 p-4 lg:p-5">
        {/* Status indicator */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className={cn('h-2.5 w-2.5 rounded-full', cfg.dot)} />
          {(entry.status === 'completed' || entry.status === 'accepted') && (
            <Check className="h-4 w-4 text-healthy" />
          )}
          {entry.status === 'rejected'    && <X     className="h-4 w-4 text-text-muted" />}
          {entry.status === 'in_progress' && <Clock className="h-4 w-4 text-blue-500"   />}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={cn('text-xs font-semibold', cfg.text)}>{cfg.label}</span>
            {entry.bloodType && (
              <span className="rounded-md bg-primary/8 px-2 py-0.5 text-xs font-bold text-primary">
                {entry.bloodType}
              </span>
            )}
            {entry.units != null && (
              <span className="text-xs text-text-muted">{entry.units} units</span>
            )}
            {isOutgoing
              ? <span className="rounded-md bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600">Sent</span>
              : <span className="rounded-md bg-blue-50   border border-blue-100   px-2 py-0.5 text-[10px] font-semibold text-blue-600">Received</span>
            }
          </div>

          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <p className="truncate text-sm font-medium text-text">{fromName}</p>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-text-light sm:block" />
            <p className="truncate text-sm text-text-muted">{toName}</p>
          </div>
        </div>

        {/* Date */}
        {entry.completedAt && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-text-muted">
              {new Date(entry.completedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs text-text-light">
              {new Date(entry.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
