import { apiGet, haversineKm, normalizeBackendStatus, CRITICAL_THRESHOLDS } from '@/services/api'
import { getSelectedHospitalId } from '@/services/auth'

// ─────────────────────────────────────────────
// In-memory overrides (simulate DB until wired)
// ─────────────────────────────────────────────
const statusOverrides  = new Map()   // suggested transfer statuses
const requestStatuses  = new Map()   // incoming request statuses
const stockAdjustments = new Map()   // hospital_id:blood_type → delta
const sessionHistory   = []          // live history entries from this session

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function hospitalLookup() {
  const hospitals = await apiGet('/hospitals')
  return new Map(hospitals.map((h) => [h.id, h]))
}

function mapTransfer(item, hospitals) {
  const from = hospitals.get(item.from_hospital_id)
  const to   = hospitals.get(item.to_hospital_id)
  const fromCoords = from ? [from.lat, from.lng] : null
  const toCoords   = to   ? [to.lat,   to.lng]   : null
  const id = String(item.suggestion_id)
  return {
    id,
    fromHospital: {
      id:       item.from_hospital_id,
      name:     item.from_hospital_name,
      location: from?.city || 'Network',
    },
    toHospital: {
      id:       item.to_hospital_id,
      name:     item.to_hospital_name,
      location: to?.city || 'Network',
    },
    bloodType:         item.blood_type,
    units:             item.quantity,
    distance:          haversineKm(fromCoords, toCoords),
    expiryHours:       Math.max(0, item.days_to_expiry * 24),
    expiryDays:        item.days_to_expiry,
    urgency:           item.urgency,
    status:            statusOverrides.get(id) || normalizeBackendStatus(item.status),
    aiScore:           Math.round((item.forecast_confidence || 0) * 100),
    reason:            item.reason,
    createdAt:         new Date().toISOString(),
    sourceSurplusUnits:   item.source_surplus_units,
    currentStock:         item.current_stock,
    thresholdUsed:        item.threshold_used,
    earliestExpiryDate:   item.earliest_expiry_date,
  }
}

// ─────────────────────────────────────────────
// Suggested Transfers (outgoing – our model)
// ─────────────────────────────────────────────
export async function getTransferSuggestions() {
  const myHospitalId = Number(getSelectedHospitalId()) || 1
  const [response, hospitals] = await Promise.all([
    apiGet('/transfers/suggestions'),
    hospitalLookup(),
  ])

  // Tab 1 — "Request Blood":
  // My hospital has a critical shortage. The model identified hospitals
  // that have surplus stock and can donate TO me. I see them here so I
  // can send them a request asking for blood.
  // Filter: I am the DESTINATION (to_hospital_id = me)
  return response.suggestions
    .filter((item) => item.to_hospital_id === myHospitalId)
    .map((item) => mapTransfer(item, hospitals))
}

export async function sendTransferRequest(transfer) {
  // Use 'sent' — distinct from the backend's 'pending' — so the card can tell the difference
  statusOverrides.set(String(transfer.id), 'sent')

  // Push to live history immediately
  sessionHistory.unshift({
    id:           `hist-sent-${transfer.id}-${Date.now()}`,
    status:       'pending',
    direction:    'outgoing',
    fromHospital: transfer.fromHospital,
    toHospital:   transfer.toHospital,
    bloodType:    transfer.bloodType,
    units:        transfer.units,
    completedAt:  new Date().toISOString(),
  })

  return { success: true }
}

// ─────────────────────────────────────────────
// Incoming Requests (from other hospitals)
// Generated deterministically from the same
// suggestion pool but viewed from the other end
// ─────────────────────────────────────────────
export async function getIncomingRequests() {
  const myHospitalId = Number(getSelectedHospitalId()) || 1
  const [response, hospitals] = await Promise.all([
    apiGet('/transfers/suggestions'),
    hospitalLookup(),
  ])

  // Tab 2 — "Donation Requests":
  // My hospital has surplus stock. Other hospitals in critical need have
  // sent a request asking me to donate. I see only those requests here.
  // Filter: I am the SOURCE (from_hospital_id = me)
  const incoming = response.suggestions
    .filter((item) => item.from_hospital_id === myHospitalId)
    .map((item) => {
      const id   = `req-${item.suggestion_id}`
      const from = hospitals.get(item.from_hospital_id)  // me — the donor
      const to   = hospitals.get(item.to_hospital_id)    // the hospital requesting blood
      const fromCoords = from ? [from.lat, from.lng] : null
      const toCoords   = to   ? [to.lat,   to.lng]   : null
      return {
        id,
        suggestionId: String(item.suggestion_id),
        // The hospital IN NEED that has requested blood from us
        requestingHospital: {
          id:       item.to_hospital_id,
          name:     item.to_hospital_name,
          location: to?.city || 'Network',
        },
        myHospital: {
          id:       item.from_hospital_id,
          name:     item.from_hospital_name,
          location: from?.city || 'Network',
        },
        bloodType:          item.blood_type,
        units:              item.quantity,
        distance:           haversineKm(fromCoords, toCoords),
        expiryDays:         item.days_to_expiry,
        urgency:            item.urgency,
        aiScore:            Math.round((item.forecast_confidence || 0) * 100),
        status:             requestStatuses.get(id) || 'pending',
        receivedAt:         new Date(Date.now() - Math.random() * 3_600_000).toISOString(),
        reason:             item.reason,
        currentStock:       item.current_stock,
        thresholdUsed:      item.threshold_used,
        sourceSurplusUnits: item.source_surplus_units,
        earliestExpiryDate: item.earliest_expiry_date,
      }
    })

  if (incoming.length === 0) {
    return _demoIncomingRequests(myHospitalId, hospitals)
  }
  return incoming
}

function _demoIncomingRequests(myHospitalId, hospitals) {
  // Demo: show 3 hospitals offering to send blood TO the signed-in hospital
  const others = [...hospitals.values()].filter((h) => h.id !== myHospitalId)
  if (others.length === 0) return []
  const me = hospitals.get(myHospitalId)

  const templates = [
    { bloodType: 'O-',  units: 2, urgency: 'critical', aiScore: 92, thresholdUsed: 5,  currentStock: 3,  expiryDays: 2, sourceSurplus: 8 },
    { bloodType: 'A+',  units: 4, urgency: 'high',     aiScore: 87, thresholdUsed: 12, currentStock: 8,  expiryDays: 5, sourceSurplus: 6 },
    { bloodType: 'B+',  units: 3, urgency: 'medium',   aiScore: 78, thresholdUsed: 14, currentStock: 11, expiryDays: 9, sourceSurplus: 5 },
  ]

  return templates.map((t, i) => {
    const offeringHospital = others[i % others.length]  // the one sending blood TO us
    const meCoords         = me              ? [me.lat,              me.lng]              : null
    const offerCoords      = offeringHospital ? [offeringHospital.lat, offeringHospital.lng] : null
    const id        = `demo-req-${i + 1}`
    const today     = new Date()
    const expiryDate = new Date(today)
    expiryDate.setDate(today.getDate() + t.expiryDays)

    return {
      id,
      suggestionId: id,
      // The hospital WITH SURPLUS offering to send blood to us
      requestingHospital: {
        id:       offeringHospital.id,
        name:     offeringHospital.name,
        location: offeringHospital.city || 'Network',
      },
      myHospital: {
        id:       myHospitalId,
        name:     me?.name || 'Your Hospital',
        location: me?.city || 'Network',
      },
      bloodType:          t.bloodType,
      units:              t.units,
      distance:           haversineKm(offerCoords, meCoords),
      expiryDays:         t.expiryDays,
      urgency:            t.urgency,
      aiScore:            t.aiScore,
      status:             requestStatuses.get(id) || 'pending',
      receivedAt:         new Date(Date.now() - (i + 1) * 1_200_000).toISOString(),
      reason:             `${offeringHospital.name} has ${t.sourceSurplus} surplus units of ${t.bloodType} expiring soon. Your hospital has been flagged as needing this blood type by the neural forecast.`,
      currentStock:       t.currentStock,
      thresholdUsed:      t.thresholdUsed,
      sourceSurplusUnits: t.sourceSurplus,
      earliestExpiryDate: expiryDate.toISOString().split('T')[0],
    }
  })
}

// ─────────────────────────────────────────────

// Detail payload (for the rich Details modal)
// ─────────────────────────────────────────────
export async function getIncomingRequestDetail(request) {
  const myHospitalId = Number(getSelectedHospitalId()) || 1

  // Fetch my current stock for the relevant blood type
  let myCurrentStock = request.sourceSurplusUnits + request.thresholdUsed // fallback estimate
  try {
    const stockItems = await apiGet(`/hospitals/${myHospitalId}/stock`)
    const match = stockItems.find((s) => s.blood_type === request.bloodType)
    if (match) myCurrentStock = match.count
  } catch (_) { /* use fallback */ }

  // Apply any previous in-session stock adjustments
  const adjKey = `${myHospitalId}:${request.bloodType}`
  const adj    = stockAdjustments.get(adjKey) || 0
  myCurrentStock = Math.max(0, myCurrentStock + adj)

  const myStockAfter = Math.max(0, myCurrentStock - request.units)
  const threshold    = CRITICAL_THRESHOLDS[request.bloodType] || request.thresholdUsed || 5

  let stockVerdict = ''
  let stockRisk    = 'safe'
  if (myStockAfter < threshold) {
    stockRisk    = 'critical'
    stockVerdict = `⚠ Caution — fulfilling this would drop your ${request.bloodType} below your critical threshold (${threshold} units).`
  } else if (myStockAfter <= threshold + 2) {
    stockRisk    = 'warning'
    stockVerdict = `⚡ Caution — fulfilling this would bring your ${request.bloodType} close to your warning threshold.`
  } else {
    stockVerdict = `✓ Safe to fulfill — your ${request.bloodType} stock stays healthy after transfer.`
  }

  // Expiry context
  const nearExpiry = request.expiryDays <= 4
  const expiryNote = nearExpiry
    ? `${request.units} of these units expire within ${request.expiryDays} days — transferring them prevents wastage instead of risking expiry.`
    : null

  // Parse reason for forecast context
  const forecastContext = _parseForecastContext(request)

  return {
    ...request,
    detail: {
      myCurrentStock,
      myStockAfter,
      threshold,
      stockRisk,
      stockVerdict,
      nearExpiry,
      expiryNote,
      forecastContext,
    },
  }
}

function _parseForecastContext(request) {
  // Extract numbers from reason string or build from available fields
  const stock   = request.currentStock
  const thresh  = request.thresholdUsed
  const deficit = Math.max(0, thresh - stock)
  const hours   = request.urgency === 'critical' ? 24 : request.urgency === 'high' ? 36 : 48

  return {
    predictedCriticalIn:  hours,
    requestingCurrentStock: stock,
    requestingThreshold:  thresh,
    deficit,
    summary: `Predicted critical in ${hours} hours — current stock ${stock} units, threshold ${thresh} units${deficit > 0 ? `, deficit ${deficit} units` : ''}.`,
  }
}

// ─────────────────────────────────────────────
// Accept / Reject incoming requests
// ─────────────────────────────────────────────
export async function acceptIncomingRequest(request) {
  const myHospitalId = Number(getSelectedHospitalId()) || 1
  requestStatuses.set(request.id, 'accepted')

  // Update our stock downward (we send blood out)
  const myKey   = `${myHospitalId}:${request.bloodType}`
  const current = stockAdjustments.get(myKey) || 0
  stockAdjustments.set(myKey, current - request.units)

  // Push completed entry to live history immediately
  sessionHistory.unshift({
    id:           `hist-acc-${request.id}-${Date.now()}`,
    status:       'completed',
    direction:    'outgoing',
    fromHospital: request.myHospital,
    toHospital:   request.requestingHospital,
    bloodType:    request.bloodType,
    units:        request.units,
    completedAt:  new Date().toISOString(),
  })

  return { success: true, status: 'accepted' }
}

export async function rejectIncomingRequest(request) {
  requestStatuses.set(request.id, 'rejected')

  // Push rejected entry to live history
  sessionHistory.unshift({
    id:           `hist-rej-${request.id}-${Date.now()}`,
    status:       'rejected',
    direction:    'outgoing',
    fromHospital: request.myHospital,
    toHospital:   request.requestingHospital,
    bloodType:    request.bloodType,
    units:        request.units,
    completedAt:  new Date().toISOString(),
  })

  return { success: true, status: 'rejected' }
}

// ─────────────────────────────────────────────
// Transfer History
// ─────────────────────────────────────────────
export async function getTransferHistory() {
  const myHospitalId = Number(getSelectedHospitalId()) || 1
  const hospitals    = await hospitalLookup()
  const me           = hospitals.get(myHospitalId)
  const demo         = _buildDemoHistory(me, hospitals, myHospitalId)

  // Strip out any corrupt/incomplete session entries (e.g. from old broken sends)
  // before prepending to demo data — prevents blank cards in history
  const validSession = sessionHistory.filter(
    (e) => e && e.bloodType && e.fromHospital?.name && e.toHospital?.name
  )

  return [...validSession, ...demo]
}

function _buildDemoHistory(me, hospitals, myId) {
  const others = [...hospitals.values()].filter((h) => h.id !== myId)
  if (others.length === 0) return []
  const myName = me?.name || 'Your Hospital'
  const myLoc  = me?.city || 'Network'

  const now = Date.now()
  const daysAgo = (d) => new Date(now - d * 86_400_000).toISOString()

  return [
    {
      id:         'hist-1',
      status:     'completed',
      direction:  'outgoing',
      fromHospital: { name: myName,                   location: myLoc },
      toHospital:   { name: others[0]?.name || 'Hospital B', location: others[0]?.city || 'Network' },
      bloodType:  'O-',
      units:      2,
      completedAt: daysAgo(0.3),
    },
    {
      id:         'hist-2',
      status:     'completed',
      direction:  'incoming',
      fromHospital: { name: others[1]?.name || 'Hospital C', location: others[1]?.city || 'Network' },
      toHospital:   { name: myName, location: myLoc },
      bloodType:  'A+',
      units:      4,
      completedAt: daysAgo(1),
    },
    {
      id:         'hist-3',
      status:     'in_progress',
      direction:  'outgoing',
      fromHospital: { name: myName, location: myLoc },
      toHospital:   { name: others[2]?.name || 'Hospital D', location: others[2]?.city || 'Network' },
      bloodType:  'B+',
      units:      3,
      completedAt: daysAgo(2),
    },
    {
      id:         'hist-4',
      status:     'accepted',
      direction:  'incoming',
      fromHospital: { name: others[0]?.name || 'Hospital B', location: others[0]?.city || 'Network' },
      toHospital:   { name: myName, location: myLoc },
      bloodType:  'AB+',
      units:      1,
      completedAt: daysAgo(3),
    },
    {
      id:         'hist-5',
      status:     'rejected',
      direction:  'outgoing',
      fromHospital: { name: myName, location: myLoc },
      toHospital:   { name: others[1]?.name || 'Hospital C', location: others[1]?.city || 'Network' },
      bloodType:  'O+',
      units:      5,
      completedAt: daysAgo(4),
    },
  ]
}

// ─────────────────────────────────────────────
// Legacy compat (still used by old modal path)
// ─────────────────────────────────────────────
export async function getTransferById(id) {
  const suggestions = await getTransferSuggestions()
  const transfer    = suggestions.find((t) => String(t.id) === String(id))
  if (!transfer) return null
  return {
    ...transfer,
    fromStock:       { total: transfer.sourceSurplusUnits || transfer.units },
    toStock:         { total: transfer.currentStock },
    forecast:        `${transfer.bloodType} destination threshold ${transfer.thresholdUsed}; recommendation from NN risk + rule-based matching.`,
    timeline:        [
      { step: 'Request Initiated', time: 'Pending', status: 'pending' },
      { step: 'Approval',          time: 'Pending', status: 'pending' },
      { step: 'In Transit',        time: 'Pending', status: 'pending' },
      { step: 'Delivery',          time: 'Pending', status: 'pending' },
    ],
    expectedImpact: `Moves ${transfer.units} units before expiry on ${transfer.earliestExpiryDate}.`,
  }
}

export async function acceptTransfer(id) {
  statusOverrides.set(String(id), 'accepted')
  const transfer = (await getTransferSuggestions()).find((t) => String(t.id) === String(id))
  if (!transfer) return null
  return { ...transfer, status: 'accepted' }
}

export async function rejectTransfer(id) {
  statusOverrides.set(String(id), 'rejected')
  const transfer = (await getTransferSuggestions()).find((t) => String(t.id) === String(id))
  if (!transfer) return null
  return { ...transfer, status: 'rejected' }
}
