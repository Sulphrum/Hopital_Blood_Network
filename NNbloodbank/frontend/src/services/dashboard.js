import { apiGet, CRITICAL_THRESHOLDS, BLOOD_TYPE_ORDER } from '@/services/api'
import { getInventoryPageData } from '@/services/inventory'
import { getSelectedHospitalId } from '@/services/auth'

export async function getDashboardStats() {
  const [inventory, forecastResponse, transferResponse] = await Promise.all([
    getInventoryPageData(),
    apiGet('/forecast/network'),
    apiGet('/transfers/suggestions'),
  ])
  return {
    totalBloodUnits: { value: inventory.summary.totalUnits, change: 0, trend: 'stable' },
    criticalAlerts: {
      value: forecastResponse.forecasts.filter((item) => item.predicted_critical).length,
      change: 0,
      trend: 'stable',
    },
    expiringSoon: { value: inventory.summary.totalExpiringSoon, change: 0, trend: 'stable' },
    incomingTransfers: { value: transferResponse.count, change: 0, trend: 'stable' },
  }
}

export async function getRecentActivity() {
  const transferResponse = await apiGet('/transfers/suggestions')
  return transferResponse.suggestions.slice(0, 6).map((item) => ({
    id: `act-${item.suggestion_id}`,
    type: 'transfer',
    message: `${item.quantity} ${item.blood_type} units recommended from ${item.from_hospital_name} to ${item.to_hospital_name}`,
    timestamp: new Date().toISOString(),
  }))
}

export async function getMiniForecast() {
  const [forecastResponse, hospitals, inventory] = await Promise.all([
    apiGet('/forecast/network'),
    apiGet('/hospitals'),
    getInventoryPageData(),
  ])
  const critical = forecastResponse.forecasts
    .filter((item) => item.predicted_critical)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
  if (!critical) {
    const healthiest = inventory.summary.byBloodType
      .filter((item) => item.status === 'healthy')
      .sort((a, b) => b.available - a.available)[0] || inventory.summary.byBloodType[0]
    return {
      bloodType: healthiest?.bloodType || 'O+',
      currentStock: healthiest?.available || 0,
      criticalInHours: null,
      trend: 'stable',
      hospitalName: null,
      chartData: [
        { day: 'Now', value: healthiest?.available || 0 },
        { day: '+12h', value: healthiest?.available || 0 },
        { day: '+24h', value: healthiest?.available || 0 },
        { day: '+36h', value: healthiest?.available || 0 },
        { day: '+48h', value: healthiest?.available || 0 },
      ],
    }
  }
  const stock = await apiGet(`/hospitals/${critical.hospital_id}/stock`)
  const currentStock = stock.find((item) => item.blood_type === critical.blood_type)?.count || 0
  return {
    bloodType: critical.blood_type,
    currentStock,
    criticalInHours: 48,
    trend: 'decreasing',
    hospitalName: hospitals.find((hospital) => hospital.id === critical.hospital_id)?.name,
    chartData: [
      { day: 'Now', value: currentStock },
      { day: '+12h', value: Math.max(0, currentStock - 2) },
      { day: '+24h', value: Math.max(0, currentStock - 4) },
      { day: '+36h', value: Math.max(0, currentStock - 6) },
      { day: '+48h', value: Math.max(0, currentStock - 8) },
    ],
  }
}

/** Returns shortage alert data for the currently signed-in hospital only */
export async function getShortageAlertData() {
  const [hospitals, forecastResponse] = await Promise.all([
    apiGet('/hospitals'),
    apiGet('/forecast/network'),
  ])

  // Resolve the signed-in hospital — fall back to first hospital if not set
  const selectedId = getSelectedHospitalId()
  const hospital =
    hospitals.find((h) => String(h.id) === String(selectedId)) || hospitals[0]
  if (!hospital) return null

  const [stock, history] = await Promise.all([
    apiGet(`/hospitals/${hospital.id}/stock`),
    apiGet(`/hospitals/${hospital.id}/stock/history?days=7`)
  ])
  const bloodTypeMap = Object.fromEntries(stock.map((s) => [s.blood_type, s.count]))
  
  // Group history by blood type
  const historyMap = {}
  history.forEach((h) => {
    if (!historyMap[h.blood_type]) historyMap[h.blood_type] = []
    historyMap[h.blood_type].push({ 
      day: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
      value: h.count 
    })
  })

  const bloodTypes = BLOOD_TYPE_ORDER.map((bt) => {
    const count = bloodTypeMap[bt] ?? null
    const threshold = CRITICAL_THRESHOLDS[bt] || 8
    let status = 'healthy'
    if (count === null) status = 'unknown'
    else if (count < threshold) status = 'critical'
    else if (count === threshold) status = 'warning'

    // Use real history from backend if available, otherwise fallback to basic array
    let chartData = []
    if (historyMap[bt] && historyMap[bt].length > 0) {
      chartData = [...historyMap[bt]]
      // Ensure 'Now' is the last point if today's date isn't exactly the same as 'Now'
      if (count !== null) {
        chartData.push({ day: 'Now', value: count })
      }
    } else if (count !== null) {
      chartData = [
        { day: '-4', value: Math.max(0, count + 4) },
        { day: '-3', value: Math.max(0, count + 3) },
        { day: '-2', value: Math.max(0, count + 2) },
        { day: '-1', value: Math.max(0, count + 1) },
        { day: 'Now', value: count },
      ]
    }

    return { bloodType: bt, count, threshold, status, chartData }
  })

  // Overall status — worst blood type wins
  let overallStatus = 'healthy'
  if (bloodTypes.some((bt) => bt.status === 'critical')) overallStatus = 'critical'
  else if (bloodTypes.some((bt) => bt.status === 'warning')) overallStatus = 'warning'

  // Blood types predicted critical by the NN for this hospital
  const forecastCritical = new Set(
    forecastResponse.forecasts
      .filter((f) => f.hospital_id === hospital.id && f.predicted_critical)
      .map((f) => f.blood_type)
    )


  // Blood types needing alert (critical by stock OR predicted critical by NN)
  const alertBloodTypes = bloodTypes.filter(
    (bt) => bt.status === 'critical' || bt.status === 'warning' || forecastCritical.has(bt.bloodType)
  )

  return {
    id: hospital.id,
    overallStatus,
    bloodTypes,
    alertBloodTypes,
    forecastCritical,
    totalUnits: stock.reduce((sum, s) => sum + s.count, 0),
  }
}


export async function getInventorySummary() {
  const inventory = await getInventoryPageData()
  return inventory.summary
}

export async function getDashboardData() {
  const [stats, activity, forecast, inventory, shortageAlerts] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
    getMiniForecast(),
    getInventorySummary(),
    getShortageAlertData(),
  ])
  return { stats, activity, forecast, inventory, shortageAlerts }
}
