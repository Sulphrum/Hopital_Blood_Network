import { useState } from 'react'
import { User as UserIcon, Building2, Lock, Bell } from 'lucide-react'
import { PageHeader, PageLoader } from '@/components/ui/PageElements'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Toggle, Select } from '@/components/ui/FormElements'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAsyncData } from '@/hooks'
import { getProfile, updateProfile, changePassword, updatePreferences } from '@/services/auth'
import { cn } from '@/utils'

const settingsTabs = [
  { id: 'profile', label: 'Personal Info', icon: UserIcon },
  { id: 'hospital', label: 'Hospital Info', icon: Building2 },
  { id: 'password', label: 'Change Password', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function ProfilePage() {
  const { data: profile, loading, refetch } = useAsyncData(getProfile)
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profileForm, setProfileForm] = useState(null)
  const [hospitalForm, setHospitalForm] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const [prefs, setPrefs] = useState(null)

  if (loading || !profile) return <PageLoader />

  const userProfile = profileForm || { name: profile.name, email: profile.email }
  const hospital = hospitalForm || profile.hospital
  const preferences = prefs || profile.preferences

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await updateProfile({ name: userProfile.name, email: userProfile.email })
      setMessage('Personal profile updated successfully')
      refetch()
    } catch (err) {
      setMessage(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleSaveHospital = async () => {
    setSaving(true)
    try {
      await updateProfile({ hospital })
      setMessage('Hospital information updated successfully')
      refetch()
    } catch (err) {
      setMessage(err.message || 'Failed to update hospital info')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setMessage('Passwords do not match')
      return
    }
    setSaving(true)
    const res = await changePassword(passwordForm.current, passwordForm.new)
    if (res.success) {
      setMessage('Password updated successfully')
      setPasswordForm({ current: '', new: '', confirm: '' })
    } else {
      setMessage(res.message || 'Failed to update password')
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    await updatePreferences(preferences)
    setMessage('Preferences updated successfully')
    setSaving(false)
    refetch()
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Profile & Settings"
        description="Manage your hospital profile, security, and notification preferences"
      />

      {message && (
        <div className="rounded-xl border border-healthy/20 bg-healthy/5 px-4 py-3 text-sm font-medium text-healthy">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="h-fit lg:col-span-1">
          <CardContent className="p-5">
            <div className="mb-6 flex flex-col items-center border-b border-gray-100 pb-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                {initials(profile.name)}
              </div>
              <h3 className="mt-4 font-semibold text-text">{profile.name}</h3>
              <p className="text-sm text-text-muted">{profile.role}</p>
              <p className="mt-1 text-xs text-text-light">{profile.email}</p>
            </div>
            <nav className="space-y-0.5">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200',
                    activeTab === tab.id
                      ? 'bg-primary/[0.08] text-primary'
                      : 'text-text-muted hover:bg-gray-50 hover:text-text'
                  )}
                >
                  <tab.icon className="h-4 w-4" strokeWidth={activeTab === tab.id ? 2.25 : 1.75} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <p className="text-sm text-text-muted">Update your personal account details</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Full Name"
                  value={userProfile.name}
                  onChange={(e) => setProfileForm({ ...userProfile, name: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setProfileForm({ ...userProfile, email: e.target.value })}
                />
                <div className="section-divider flex justify-end pt-6">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'hospital' && (
            <Card>
              <CardHeader>
                <CardTitle>Hospital Information</CardTitle>
                <p className="text-sm text-text-muted">Update your facility details and contact information</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Hospital Name"
                  value={hospital.name}
                  onChange={(e) => setHospitalForm({ ...hospital, name: e.target.value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Email"
                    type="email"
                    value={hospital.email}
                    onChange={(e) => setHospitalForm({ ...hospital, email: e.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={hospital.phone}
                    onChange={(e) => setHospitalForm({ ...hospital, phone: e.target.value })}
                  />
                </div>
                <Textarea
                  label="Address"
                  value={hospital.address}
                  onChange={(e) => setHospitalForm({ ...hospital, address: e.target.value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="License Number" value={hospital.license} disabled />
                  <Input label="Blood Bank Capacity" value={hospital.bloodBankCapacity} disabled />
                </div>
                <div className="section-divider flex justify-end pt-6">
                  <Button onClick={handleSaveHospital} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'password' && (
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <p className="text-sm text-text-muted">Ensure your account stays secure with a strong password</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                />
                <div className="section-divider flex justify-end pt-6">
                  <Button onClick={handleChangePassword} disabled={saving}>
                    {saving ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <p className="text-sm text-text-muted">Control how and when you receive alerts</p>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100">
                <Toggle
                  label="Email Notifications"
                  description="Receive alerts via email"
                  checked={preferences.emailNotifications}
                  onChange={(v) => setPrefs({ ...preferences, emailNotifications: v })}
                />
                <Toggle
                  label="Critical Alerts Only"
                  description="Only notify for critical shortages"
                  checked={preferences.criticalAlertsOnly}
                  onChange={(v) => setPrefs({ ...preferences, criticalAlertsOnly: v })}
                />
                <div className="section-divider flex justify-end pt-6">
                  <Button onClick={handleSavePreferences} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'BB'
}
