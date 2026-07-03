import { Building2, MapPin, Phone, Droplets, AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { cn, formatNumber } from '@/utils'

export function HospitalCard({ hospital, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border bg-white p-4 text-left shadow-card transition-all duration-200',
        isSelected ? 'border-primary/30 ring-2 ring-primary/10' : 'border-gray-100 hover:border-gray-200 hover:shadow-card-hover'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            hospital.status === 'critical' ? 'bg-critical/10' :
            hospital.status === 'warning' ? 'bg-warning/10' : 'bg-healthy/10'
          )}>
            <Building2 className={cn(
              'h-5 w-5',
              hospital.status === 'critical' ? 'text-critical' :
              hospital.status === 'warning' ? 'text-warning' : 'text-healthy'
            )} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{hospital.name}</p>
            <p className="truncate text-xs text-text-muted">{hospital.location}</p>
          </div>
        </div>
        <StatusBadge status={hospital.status} size="sm" />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span><span className="font-bold text-text">{formatNumber(hospital.totalUnits)}</span> <span className="text-text-muted">units</span></span>
        {hospital.distance > 0 && (
          <span className="flex items-center gap-1 text-xs text-text-light">
            <MapPin className="h-3 w-3" />{hospital.distance} km
          </span>
        )}
      </div>
    </button>
  )
}

export function HospitalDetailPanel({ hospital }) {
  if (!hospital) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
        <div>
          <Building2 className="mx-auto h-10 w-10 text-text-light" />
          <p className="mt-3 text-sm font-medium text-text-muted">Select a hospital to view details</p>
        </div>
      </div>
    )
  }

  const bloodTypes = Object.entries(hospital.bloodTypes || {})

  return (
    <div className="interactive-card overflow-hidden">
      <div className="border-b border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-subheading text-text">{hospital.name}</h3>
            <p className="mt-1 text-sm text-text-muted">{hospital.location}</p>
          </div>
          <StatusBadge status={hospital.status} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-text-muted">
          <Phone className="h-4 w-4" />
          {hospital.contact}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 rounded-xl bg-primary/[0.04] p-4">
          <Droplets className="h-5 w-5 text-primary" />
          <div>
            <p className="text-2xl font-bold text-text">{formatNumber(hospital.totalUnits)}</p>
            <p className="text-xs text-text-muted">Total units available</p>
          </div>
        </div>

        {hospital.criticalAlerts?.length > 0 && (
          <div className="mt-4 rounded-xl border border-critical/20 bg-critical/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-critical">
              <AlertTriangle className="h-4 w-4" />
              Critical Alerts
            </div>
            <ul className="mt-2 space-y-1">
              {hospital.criticalAlerts.map((alert, i) => (
                <li key={i} className="text-xs text-text-muted">• {alert}</li>
              ))}
            </ul>
          </div>
        )}

        <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-text-light">Stock by Blood Type</h4>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {bloodTypes.map(([type, units]) => (
            <div key={type} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-sm font-bold text-primary">{type}</span>
              <span className="text-sm font-medium text-text">{units}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
