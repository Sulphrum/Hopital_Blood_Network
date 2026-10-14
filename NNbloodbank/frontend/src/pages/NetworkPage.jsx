import { useState, useMemo } from 'react'
import { PageHeader, PageLoader } from '@/components/ui/PageElements'
import { FilterBar } from '@/components/ui/FilterBar'
import { FilterDropdown } from '@/components/ui/FormElements'
import { HospitalMap, MapLegend, NetworkSummary } from '@/components/map/HospitalMap'
import { HospitalCard, HospitalDetailPanel } from '@/components/network/HospitalCard'
import { useAsyncData } from '@/hooks'
import { getNetworkData } from '@/services/network'

export default function NetworkPage() {
  const { data, loading } = useAsyncData(getNetworkData)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const filteredHospitals = useMemo(() => {
    if (!data?.hospitals) return []
    const list = data.hospitals
    if (!statusFilter) return list
    return list.filter((h) => h.status === statusFilter)
  }, [data, statusFilter])

  const selectedHospital = filteredHospitals.find((h) => h.id === selectedId) ||
    data?.hospitals.find((h) => h.id === selectedId) || null

  if (loading || !data) return <PageLoader />

  const { legend } = data

  return (
    <div className="page-container">
      <PageHeader
        title="Network View"
        description="Real-time blood inventory across connected hospitals in the Pune network"
      />

      <NetworkSummary hospitals={data.hospitals} />

      <FilterBar>
        <FilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Hospitals"
          options={[
            { value: 'healthy', label: 'Healthy' },
            { value: 'warning', label: 'Warning' },
            { value: 'critical', label: 'Critical' },
          ]}
          className="w-40"
        />
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-1 shadow-card">
            <HospitalMap
              hospitals={filteredHospitals}
              selectedId={selectedId}
              onSelect={setSelectedId}
              height="480px"
            />
          </div>
          <MapLegend items={legend} />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <HospitalDetailPanel hospital={selectedHospital} />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-light">
              Hospitals ({filteredHospitals.length})
            </h3>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {filteredHospitals.map((hospital) => (
                <HospitalCard
                  key={hospital.id}
                  hospital={hospital}
                  isSelected={selectedId === hospital.id}
                  onClick={() => setSelectedId(hospital.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
