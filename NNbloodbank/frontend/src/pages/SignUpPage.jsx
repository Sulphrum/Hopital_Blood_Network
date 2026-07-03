import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Droplets, Mail, Lock, User, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { LoginHeroPanel } from '@/components/auth/LoginHeroPanel'
import { Button } from '@/components/ui/Button'
import { apiGet } from '@/services/api'
import { login } from '@/services/auth'
import { useAuth } from '@/hooks'

export default function SignUpPage() {
  const navigate = useNavigate()
  const { login: setAuth } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hospitals, setHospitals] = useState([])
  const [hospitalId, setHospitalId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/hospitals')
      .then((items) => {
        setHospitals(items)
        if (items.length > 0) {
          setHospitalId(String(items[0].id))
        }
      })
      .catch(() => {
        setError('Could not load hospitals. Check that the backend is running.')
      })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await login({ email, password, hospitalId, name })
      if (result.success) {
        setAuth({ hospitalId: hospitalId || result.user?.hospital?.id, email, name })
        navigate('/dashboard')
      } else {
        setError(result.message || 'Registration failed')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
              <Droplets className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">JeevanSetu</h1>
              <p className="text-sm text-text-muted">AI-Powered Hospital Blood Network</p>
            </div>
          </div>

          <h2 className="text-display text-text">Create Account</h2>
          <p className="mt-2 text-sm text-text-muted">Join the connected hospital blood network</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-critical">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-text">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text">Hospital</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center">
                  <Building2 className="h-4 w-4 text-text-light" />
                </div>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-11 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} - {hospital.city}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="hospital@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-text">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-light" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Create a password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-light hover:text-text"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>

      <LoginHeroPanel />
    </div>
  )
}
