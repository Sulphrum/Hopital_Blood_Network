import { delay } from '@/utils'
import { apiGet, apiPost } from '@/services/api'

export function getSelectedHospitalId() {
  return localStorage.getItem('jeevansetu_hospital_id')
}

function fallbackHospital(hospital) {
  if (!hospital) return null
  const defaultInfo = {
    id: hospital.id,
    name: hospital.name,
    location: hospital.city,
    city: hospital.city,
    state: 'India',
    email: `bloodbank-${hospital.id}@jeevansetu.demo`,
    phone: 'Network blood bank',
    address: `${hospital.city}, India`,
    license: `JS-BB-${hospital.id}`,
    coordinates: [hospital.lat, hospital.lng],
    type: 'Connected Hospital',
    beds: 300,
    bloodBankCapacity: 500,
  }

  const saved = localStorage.getItem(`jeevansetu_hospital_info_${hospital.id}`)
  if (saved) {
    try {
      return { ...defaultInfo, ...JSON.parse(saved) }
    } catch (e) {}
  }
  return defaultInfo
}

async function selectedHospital() {
  const hospitals = await apiGet('/hospitals')
  const selectedId = getSelectedHospitalId()
  const hospital =
    hospitals.find((item) => String(item.id) === String(selectedId)) ||
    hospitals[0]
  return fallbackHospital(hospital)
}

export async function getProfile() {
  const hospital = await selectedHospital()
  return {
    name: localStorage.getItem('jeevansetu_user_name') || 'Blood Bank Manager',
    role: 'Blood Bank Manager',
    email: localStorage.getItem('jeevansetu_email') || `manager@hospital-${hospital?.id || 1}.demo`,
    avatar: null,
    hospital,
    preferences: {
      emailNotifications: true,
      smsAlerts: true,
      criticalAlertsOnly: false,
      darkMode: false,
      language: 'en',
      timezone: 'Asia/Kolkata',
    },
  }
}

export async function updateProfile(data) {
  try {
    const payload = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.email !== undefined) payload.email = data.email

    if (Object.keys(payload).length > 0) {
      const response = await apiPut('/auth/profile', payload)
      if (response.success) {
        localStorage.setItem('jeevansetu_email', response.user.email)
        localStorage.setItem('jeevansetu_user_name', response.user.name)
        if (response.token) {
          localStorage.setItem('jeevansetu_token', response.token)
        }
      }
    }

    if (data.hospital !== undefined && data.hospital !== null) {
      localStorage.setItem(`jeevansetu_hospital_info_${data.hospital.id}`, JSON.stringify(data.hospital))
    }

    return getProfile()
  } catch (error) {
    throw error
  }
}

export async function updateHospitalInfo(data) {
  const hospital = await selectedHospital()
  const updated = { ...hospital, ...data }
  localStorage.setItem(`jeevansetu_hospital_info_${hospital.id}`, JSON.stringify(updated))
  return updated
}

export async function changePassword(currentPassword, newPassword) {
  try {
    const response = await apiPost('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response
  } catch (error) {
    return { success: false, message: error.message || 'Failed to update password' }
  }
}

export async function updatePreferences(preferences) {
  await delay(500)
  const profile = await getProfile()
  return {
    ...profile,
    preferences: { ...profile.preferences, ...preferences },
  }
}

export async function login(credentials) {
  try {
    const isSignup = Boolean(credentials.name)
    const endpoint = isSignup ? '/auth/signup' : '/auth/login'

    const payload = {
      email: credentials.email,
      password: credentials.password,
      hospital_id: Number(credentials.hospitalId || 1),
    }
    if (isSignup) {
      payload.name = credentials.name
    }

    const response = await apiPost(endpoint, payload)
    if (response.success) {
      localStorage.setItem('jeevansetu_hospital_id', String(response.user.hospital_id))
      localStorage.setItem('jeevansetu_email', response.user.email)
      localStorage.setItem('jeevansetu_user_name', response.user.name)
      localStorage.setItem('jeevansetu_token', response.token)

      return {
        success: true,
        user: await getProfile(),
        token: response.token,
      }
    } else {
      return { success: false, message: response.message || 'Authentication failed' }
    }
  } catch (error) {
    return { success: false, message: error.message || 'Connection or verification error' }
  }
}
