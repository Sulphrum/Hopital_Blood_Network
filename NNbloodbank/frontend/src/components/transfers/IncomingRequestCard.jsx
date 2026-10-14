import { motion } from 'framer-motion'
import { MapPin, Eye, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UrgencyBadge } from '@/components/ui/Badge'
import { InfoChip } from '@/components/ui/InfoChip'
import { cn } from '@/utils'

export function IncomingRequestCard({ request, onDetails, onAccept, onReject, index = 0 }) {
  const isCritical = request.urgency === 'critical'
  const isPending  = request.status === 'pending'

  const statusColors = {
    pending:  null,
    accepted: 'border-healthy/30 bg-healthy/[0.02]',
    rejected: 'border-gray-200 bg-gray-50/50 opacity-70',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'interactive-card overflow-hidden',
        isCritical && isPending && 'border-critical/30 ring-1 ring-critical/10',
        statusColors[request.status]
      )}
    >
      {isCritical && isPending && (
        <div className="bg-critical/5 px-6 py-2 text-xs font-semibold text-critical">
          ⚡ Urgent — Immediate decision needed
        </div>
      )}

      <div className="p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left */}
          <div className="min-w-0 flex-1">
            {/* Hospital in shortage that sent us a donation request */}
            <div className="mb-3 rounded-xl border border-red-100 bg-red-50/50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-critical">Needs Blood · Requesting Donation</p>
              <p className="mt-0.5 text-sm font-bold text-text">{request.requestingHospital.name}</p>
              <p className="text-xs text-text-muted">{request.requestingHospital.location}</p>
            </div>

            {/* Blood type + urgency badges */}
            <div className="flex flex-wrap items-center gap-2">
              <UrgencyBadge urgency={request.urgency} size="md" />
              <span className="rounded-lg bg-primary/8 px-2.5 py-1 text-sm font-bold text-primary">
                {request.bloodType}
              </span>
              <span className="text-sm text-text-muted">{request.units} units requested</span>
            </div>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-muted">{request.reason}</p>
          </div>

          {/* Right: distance chip only + actions */}
          <div className="flex flex-col items-stretch gap-3 sm:items-end lg:min-w-[180px]">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <InfoChip icon={MapPin} variant="distance">{request.distance} km</InfoChip>
            </div>

            {request.status === 'accepted' && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-healthy/20 bg-healthy/10 px-3 py-1.5 text-xs font-semibold text-healthy">
                <Check className="h-3.5 w-3.5" /> Accepted
              </span>
            )}
            {request.status === 'rejected' && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-text-muted">
                <X className="h-3.5 w-3.5" /> Rejected
              </span>
            )}

            {isPending && (
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button variant="secondary" size="sm" onClick={() => onDetails(request)}>
                  <Eye className="h-4 w-4" />
                  Details
                </Button>
                <Button variant="success" size="sm" onClick={() => onAccept(request)}>
                  <Check className="h-4 w-4" />
                  Accept
                </Button>
                <Button variant="danger" size="sm" onClick={() => onReject(request)}>
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
