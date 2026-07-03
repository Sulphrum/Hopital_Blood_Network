import { useId } from 'react'
import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'

const CENTER = { x: 100, y: 100 }
const DROP_SCALE = 0.52
const DROP_TRANSFORM = 'translate(100, 100) scale(1, -1) scale(0.52) translate(-100, -100)'

const HOSPITALS = [
  { id: 1, x: 100, y: 28 },
  { id: 2, x: 168, y: 68 },
  { id: 3, x: 145, y: 152 },
  { id: 4, x: 55, y: 152 },
  { id: 5, x: 32, y: 68 },
]

const BLOOD_DROP_PATH =
  'M100 66 C85 66 76 78 76 91 C76 108 100 134 100 134 C100 134 124 108 124 91 C124 78 115 66 100 66 Z'

const DROP_RAW_POINTS = [
  [100, 66], [85, 66], [76, 78], [76, 91], [76, 108],
  [100, 134], [124, 108], [124, 91], [124, 78], [115, 66],
]

function transformDropPoint(x, y) {
  return {
    x: CENTER.x + DROP_SCALE * (x - CENTER.x),
    y: CENTER.y - DROP_SCALE * (y - CENTER.y),
  }
}

const DROP_OUTLINE = DROP_RAW_POINTS.map(([x, y]) => transformDropPoint(x, y))

function raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2) {
  const sx = x2 - x1
  const sy = y2 - y1
  const denom = dx * sy - dy * sx
  if (Math.abs(denom) < 1e-9) return null
  const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom
  const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom
  if (t > 0.001 && u >= 0 && u <= 1) return t
  return null
}

function getDropEdgePoint(tx, ty) {
  const dx = tx - CENTER.x
  const dy = ty - CENTER.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { ...CENTER }

  const ux = dx / len
  const uy = dy / len
  let minT = Infinity

  for (let i = 0; i < DROP_OUTLINE.length; i += 1) {
    const a = DROP_OUTLINE[i]
    const b = DROP_OUTLINE[(i + 1) % DROP_OUTLINE.length]
    const t = raySegmentIntersect(CENTER.x, CENTER.y, ux, uy, a.x, a.y, b.x, b.y)
    if (t !== null && t < minT) minT = t
  }

  if (minT === Infinity) return { ...CENTER }
  return { x: CENTER.x + ux * minT, y: CENTER.y + uy * minT }
}

const MESH_LINES = [
  ...HOSPITALS.map((h) => [getDropEdgePoint(h.x, h.y), h]),
  ...HOSPITALS.map((h, i) => [h, HOSPITALS[(i + 1) % HOSPITALS.length]]),
  [HOSPITALS[0], HOSPITALS[2]],
  [HOSPITALS[1], HOSPITALS[3]],
  [HOSPITALS[2], HOSPITALS[4]],
  [HOSPITALS[3], HOSPITALS[0]],
  [HOSPITALS[4], HOSPITALS[1]],
  [HOSPITALS[0], HOSPITALS[3]],
  [HOSPITALS[1], HOSPITALS[4]],
  [HOSPITALS[2], HOSPITALS[0]],
]

function linePulseConfig(index, pointA, pointB) {
  const seed = (index * 19 + 7) % 97
  const reverse = seed % 2 === 0
  const from = reverse ? pointB : pointA
  const to = reverse ? pointA : pointB
  return {
    from,
    to,
    duration: 8 + (seed % 6) * 0.75,
    delay: (seed * 0.11) % 7,
    repeatDelay: 0.4 + (seed % 5) * 0.35,
    dashSize: 5 + (seed % 3),
    gapSize: 88 + (seed % 12),
    opacity: 0.45 + (seed % 4) * 0.08,
  }
}

function NetworkLinePulse({ index, pointA, pointB, uid }) {
  const pulse = linePulseConfig(index, pointA, pointB)

  return (
    <g>
      <line
        x1={pointA.x}
        y1={pointA.y}
        x2={pointB.x}
        y2={pointB.y}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />
      <motion.line
        x1={pulse.from.x}
        y1={pulse.from.y}
        x2={pulse.to.x}
        y2={pulse.to.y}
        stroke={`rgba(255,255,255,${pulse.opacity})`}
        strokeWidth="0.6"
        strokeLinecap="round"
        filter={`url(#${uid}-lineGlow)`}
        strokeDasharray={`${pulse.dashSize} ${pulse.gapSize}`}
        initial={{ strokeDashoffset: pulse.gapSize + pulse.dashSize }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration: pulse.duration,
          delay: pulse.delay,
          repeat: Infinity,
          ease: 'linear',
          repeatDelay: pulse.repeatDelay,
        }}
      />
    </g>
  )
}

const HEARTBEAT_PATH =
  'M 0 24 H 36 H 44 L 50 24 L 56 8 L 62 40 L 68 24 H 76 L 80 18 L 84 24 H 92 L 96 24 L 100 24 L 104 24 L 108 24 L 112 0 L 116 48 L 120 24 H 128 H 136 L 140 16 L 144 24 H 152 H 160 H 200'

function HospitalNode({ x, y, delay }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 160, damping: 14 }}
    >
      <circle cx={x} cy={y} r="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
      <foreignObject x={x - 5} y={y - 5} width="10" height="10">
        <div className="flex h-full w-full items-center justify-center">
          <Building2 className="h-3 w-3 text-white" strokeWidth={2.2} />
        </div>
      </foreignObject>
    </motion.g>
  )
}

function BloodDropCenter({ uid }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 16 }}
    >
      <motion.circle
        cx={CENTER.x}
        cy={CENTER.y}
        r="38"
        fill={`url(#${uid}-bloodGlowOuter)`}
        filter={`url(#${uid}-bloodBlur)`}
        animate={{ r: [38, 44, 38], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx={CENTER.x}
        cy={CENTER.y}
        r="24"
        fill={`url(#${uid}-bloodGlowInner)`}
        filter={`url(#${uid}-bloodBlur)`}
        animate={{ r: [24, 28, 24], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {[18, 26, 34].map((r, i) => (
        <motion.circle
          key={r}
          cx={CENTER.x}
          cy={CENTER.y}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.5"
          animate={{ r: [r, r + 8, r], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.8 + i * 0.4, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <g transform={DROP_TRANSFORM}>
        <path
          d={BLOOD_DROP_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d={BLOOD_DROP_PATH}
          fill="white"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="0.7"
          strokeLinejoin="round"
          filter={`url(#${uid}-dropGlow)`}
        />
      </g>
    </motion.g>
  )
}

function NetworkGraphic() {
  const uid = useId().replace(/:/g, '')

  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      <motion.div
        className="absolute left-1/2 top-[46%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EF5350]/50 blur-[60px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/2 top-[46%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 blur-[40px]"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg viewBox="0 0 200 180" className="relative h-auto w-full" aria-hidden="true">
        <defs>
          <radialGradient id={`${uid}-bloodGlowOuter`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EF5350" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#C62828" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#C62828" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-bloodGlowInner`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#EF5350" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C62828" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-bloodBlur`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id={`${uid}-dropGlow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${uid}-lineGlow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {MESH_LINES.map(([a, b], i) => (
          <NetworkLinePulse key={`line-${i}`} index={i} pointA={a} pointB={b} uid={uid} />
        ))}

        {HOSPITALS.map((hospital, i) => (
          <HospitalNode key={hospital.id} x={hospital.x} y={hospital.y} delay={0.3 + i * 0.08} />
        ))}

        <BloodDropCenter uid={uid} />
      </svg>
    </div>
  )
}

function HeartbeatLine({ uid }) {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-[440px] overflow-hidden">
      <svg viewBox="0 -8 200 56" className="h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-heartbeatGrad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF5350" stopOpacity="0" />
            <stop offset="35%" stopColor="#EF5350" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="65%" stopColor="#EF5350" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EF5350" stopOpacity="0" />
          </linearGradient>
          <filter id={`${uid}-heartbeatGlow`}>
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={HEARTBEAT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <motion.path
          d={HEARTBEAT_PATH}
          fill="none"
          stroke="#EF5350"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
          animate={{ opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.path
          d={HEARTBEAT_PATH}
          fill="none"
          stroke={`url(#${uid}-heartbeatGrad)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-heartbeatGlow)`}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="50 150"
          animate={{ strokeDashoffset: [200, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />

        <motion.path
          d={HEARTBEAT_PATH}
          fill="none"
          stroke="white"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${uid}-heartbeatGlow)`}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="6 194"
          animate={{ strokeDashoffset: [200, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
    </div>
  )
}

export function LoginHeroPanel() {
  const uid = useId().replace(/:/g, '')

  return (
    <div className="relative hidden lg:flex lg:flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#C62828] via-[#9B1C1C] to-[#3D0808] p-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(239,83,80,0.4)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_90%,rgba(0,0,0,0.45)_0%,transparent_50%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 flex w-full max-w-lg flex-col"
      >
        <NetworkGraphic />
        <HeartbeatLine uid={uid} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 text-left"
        >
          <h2 className="text-[1.65rem] font-bold leading-snug tracking-tight text-white">
            Saving Lives Through Smart Management
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Connect with hospitals across the network. Predict shortages before they happen.
            Optimize transfers with AI-powered insights.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
