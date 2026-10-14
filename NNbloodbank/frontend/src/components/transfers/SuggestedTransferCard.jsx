import { motion } from 'framer-motion'
import { ArrowRight, MapPin, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UrgencyBadge } from '@/components/ui/Badge'
import { InfoChip } from '@/components/ui/InfoChip'
import { cn } from '@/utils'

export function SuggestedTransferCard({ transfer, onSendRequest, index = 0 }) {
  const isCritical = transfer.urgency === 'critical'
  // 'sent' is an explicit status set after clicking — not the same as 'pending' from backend
  const sent = transfer.status === 'sent'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'interactive-card overflow-hidden',
        isCritical && 'border-critical/30 ring-1 ring-critical/10'
      )}
    >
      {isCritical && (
        <div className="bg-critical/5 px-6 py-2 text-xs font-semibold text-critical">
          ⚡ Immediate action recommended
        </div>
      )}

      <div className="p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: hospital route + reason */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyBadge urgency={transfer.urgency} size="md" />
              <span className="rounded-lg bg-primary/8 px-2.5 py-1 text-sm font-bold text-primary">
                {transfer.bloodType}
              </span>
              <span className="text-sm text-text-muted">{transfer.units} units</span>
            </div>

            {/* FROM donor → TO my hospital (needs blood) */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 rounded-xl bg-green-50/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-healthy">Can Donate · Has Surplus</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-text">{transfer.fromHospital.name}</p>
                <p className="truncate text-xs text-text-muted">{transfer.fromHospital.location}</p>
              </div>

              <div className="flex shrink-0 items-center justify-center sm:px-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>

              <div className="min-w-0 flex-1 rounded-xl bg-red-50/60 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-critical">Your Hospital · Needs Blood</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-text">{transfer.toHospital.name}</p>
                <p className="truncate text-xs text-text-muted">{transfer.toHospital.location}</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-text-muted">{transfer.reason}</p>
          </div>

          {/* Right: distance chip + action */}
          <div className="flex flex-col items-stretch gap-3 sm:items-end lg:min-w-[160px]">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <InfoChip icon={MapPin} variant="distance">{transfer.distance} km</InfoChip>
            </div>

            <div className="flex justify-end">
              {sent ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-healthy">
                  <Send className="h-3.5 w-3.5" />
                  Request Sent
                </span>
              ) : (
                <Button size="sm" onClick={() => onSendRequest(transfer)}>
                  <Send className="h-4 w-4" />
                  Send Request
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
