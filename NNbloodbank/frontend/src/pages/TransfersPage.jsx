import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, Inbox, History, Lightbulb } from 'lucide-react'
import { PageHeader, PageLoader, EmptyState } from '@/components/ui/PageElements'
import { SearchBar, FilterDropdown } from '@/components/ui/FormElements'
import { SuggestedTransferCard } from '@/components/transfers/SuggestedTransferCard'
import { IncomingRequestCard } from '@/components/transfers/IncomingRequestCard'
import { TransferDetailsModal } from '@/components/transfers/TransferDetailsModal'
import { TransferHistoryCard } from '@/components/transfers/TransferHistoryCard'
import { useAsyncData } from '@/hooks'
import {
  getTransferSuggestions,
  getIncomingRequests,
  getTransferHistory,
  getIncomingRequestDetail,
  sendTransferRequest,
  acceptIncomingRequest,
  rejectIncomingRequest,
} from '@/services/transfers'
import { cn } from '@/utils'

// ─── Tab definitions ──────────────────────────────
const TABS = [
  { id: 'suggested', label: 'Request Blood',      icon: Lightbulb },
  { id: 'incoming',  label: 'Donation Requests',  icon: Inbox     },
  { id: 'history',   label: 'Transfer History',   icon: History   },
]

// ─── Tab pill ─────────────────────────────────────
function TabPill({ tab, active, badge, onClick }) {
  const Icon = tab.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-primary text-white shadow-md shadow-primary/20'
          : 'text-text-muted hover:bg-gray-100 hover:text-text'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {tab.label}
      {badge > 0 && (
        <span className={cn(
          'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
          active ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'
        )}>
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────
export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState('suggested')

  // Data fetching
  const {
    data: suggestions,
    loading: loadingSuggested,
    refetch: refetchSuggested,
  } = useAsyncData(getTransferSuggestions, [], { refreshIntervalMs: 8000 })

  const {
    data: incoming,
    loading: loadingIncoming,
    refetch: refetchIncoming,
  } = useAsyncData(getIncomingRequests, [], { refreshIntervalMs: 8000 })

  const {
    data: history,
    loading: loadingHistory,
    refetch: refetchHistory,
  } = useAsyncData(getTransferHistory, [], { refreshIntervalMs: 15000 })

  // Filters — shared across all tabs
  const [search,        setSearch]        = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [bloodFilter,   setBloodFilter]   = useState('')

  // Detail modal state
  const [detailOpen,    setDetailOpen]    = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData,    setDetailData]    = useState(null)

  // ── Counts for badges ───────────────────────────
  const criticalSuggested = suggestions?.filter((t) => t.urgency === 'critical').length || 0
  const pendingIncoming   = incoming?.filter((r) => r.status === 'pending').length     || 0

  // ── Filter helpers ──────────────────────────────
  function applyFilters(items = [], searchFields = ['bloodType', 'reason']) {
    const q = search.toLowerCase()
    return items.filter((item) => {
      const matchesSearch = !q || searchFields.some((f) => {
        const val = typeof item[f] === 'string' ? item[f] : (item[f]?.name || '')
        return val.toLowerCase().includes(q)
      })
      const matchesUrgency = !urgencyFilter || item.urgency === urgencyFilter
      const matchesBlood   = !bloodFilter   || item.bloodType === bloodFilter
      return matchesSearch && matchesUrgency && matchesBlood
    })
  }

  const filteredSuggested = useMemo(
    () => applyFilters(suggestions || [], ['bloodType', 'reason']),
    [suggestions, search, urgencyFilter, bloodFilter]
  )
  const filteredIncoming = useMemo(
    () => applyFilters(incoming || [], ['bloodType', 'reason']),
    [incoming, search, urgencyFilter, bloodFilter]
  )
  const filteredHistory = useMemo(
    () => applyFilters(history || [], ['bloodType']),
    [history, search, urgencyFilter, bloodFilter]
  )

  // ── Handlers: Suggested tab ─────────────────────
  const handleSendRequest = async (transfer) => {
    await sendTransferRequest(transfer)   // pass full object, not just transfer.id
    refetchSuggested()
    refetchHistory()                      // show the new pending entry in history
  }

  // ── Handlers: Incoming tab ──────────────────────
  const handleOpenDetails = async (request) => {
    setDetailLoading(true)
    setDetailOpen(true)
    setDetailData(null)
    const full = await getIncomingRequestDetail(request)
    setDetailData(full)
    setDetailLoading(false)
  }

  const handleAcceptFromCard = async (request) => {
    await acceptIncomingRequest(request)
    refetchIncoming()
    refetchHistory()
  }

  const handleRejectFromCard = async (request) => {
    await rejectIncomingRequest(request)
    refetchIncoming()
    refetchHistory()                      // show the rejected entry in history
  }

  const handleAcceptFromModal = async (request) => {
    await acceptIncomingRequest(request)
    setDetailOpen(false)
    refetchIncoming()
    refetchHistory()
  }

  const handleRejectFromModal = async (request) => {
    await rejectIncomingRequest(request)
    setDetailOpen(false)
    refetchIncoming()
  }

  // ── Loading guard ───────────────────────────────
  if (loadingSuggested && loadingIncoming) return <PageLoader />

  const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

  return (
    <div className="page-container">
      <PageHeader
        title="Transfers"
        description="Manage blood transfers for requests and network coordination"
        badge={
          criticalSuggested > 0 ? (
            <span className="rounded-full bg-critical/10 px-3 py-1 text-xs font-bold text-critical">
              {criticalSuggested} critical
            </span>
          ) : null
        }
      />

      {/* ── 3-Tab bar ──────────────────────────────── */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-1.5">
        {TABS.map((tab) => (
          <TabPill
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            badge={
              tab.id === 'suggested' ? criticalSuggested :
              tab.id === 'incoming'  ? pendingIncoming    : 0
            }
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* ── Filters ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search hospitals, blood type..."
          className="flex-1"
        />
        <FilterDropdown
          value={bloodFilter}
          onChange={setBloodFilter}
          placeholder="All Blood Types"
          options={bloodTypes.map((bt) => ({ value: bt, label: bt }))}
          className="w-full sm:w-36"
        />
        <FilterDropdown
          value={urgencyFilter}
          onChange={setUrgencyFilter}
          placeholder="All Urgency"
          options={[
            { value: 'critical', label: 'Critical' },
            { value: 'high',     label: 'High'     },
            { value: 'medium',   label: 'Medium'   },
            { value: 'low',      label: 'Low'      },
          ]}
          className="w-full sm:w-36"
        />
      </div>

      {/* ── Tab panels ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* SUGGESTED FOR YOU */}
        {activeTab === 'suggested' && (
          <motion.div
            key="suggested"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {loadingSuggested ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading suggestions…</p>
            ) : filteredSuggested.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="No transfer suggestions"
                description="Your hospital network looks balanced right now. Check back soon."
              />
            ) : (
              filteredSuggested.map((t, i) => (
                <SuggestedTransferCard
                  key={t.id}
                  transfer={t}
                  index={i}
                  onSendRequest={handleSendRequest}
                />
              ))
            )}
          </motion.div>
        )}

        {/* REQUESTS FOR YOU */}
        {activeTab === 'incoming' && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Summary line */}
            {!loadingIncoming && filteredIncoming.length > 0 && (
              <p className="text-sm text-text-muted">
                Showing <strong>{filteredIncoming.length}</strong> request{filteredIncoming.length !== 1 ? 's' : ''}.
                {pendingIncoming > 0 && <> <span className="font-semibold text-warning">{pendingIncoming} pending</span> decision.</>}
              </p>
            )}

            {loadingIncoming ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading incoming requests…</p>
            ) : filteredIncoming.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No incoming requests"
                description="No other hospitals have sent transfer requests to you yet."
              />
            ) : (
              filteredIncoming.map((r, i) => (
                <IncomingRequestCard
                  key={r.id}
                  request={r}
                  index={i}
                  onDetails={handleOpenDetails}
                  onAccept={handleAcceptFromCard}
                  onReject={handleRejectFromCard}
                />
              ))
            )}
          </motion.div>
        )}

        {/* TRANSFER HISTORY */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {loadingHistory ? (
              <p className="py-8 text-center text-sm text-text-muted">Loading history…</p>
            ) : filteredHistory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No transfer history"
                description="Completed and processed transfers will appear here."
              />
            ) : (
              <>
                {filteredHistory.map((entry, i) => (
                  <TransferHistoryCard key={entry.id} entry={entry} index={i} />
                ))}
                {filteredHistory.length >= 5 && (
                  <div className="flex justify-center pt-2">
                    <button className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
                      View More →
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Details Modal (Requests for You) ────────── */}
      <TransferDetailsModal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        detail={detailLoading ? null : detailData}
        onAccept={handleAcceptFromModal}
        onReject={handleRejectFromModal}
      />
    </div>
  )
}
