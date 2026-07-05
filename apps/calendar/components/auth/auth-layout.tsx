'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, MailIcon, ShuffleIcon } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@zntr/ui/button'
import { Separator } from '@zntr/ui/separator'
import { useRouter } from 'next/navigation'

type Palette = {
  name: string
  colors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
}

const PALETTES: Palette[] = [
  {
    name: 'Slate',
    colors: [
      [0.04, 0.04, 0.07],
      [0.13, 0.13, 0.17],
      [0.22, 0.22, 0.3],
      [0.06, 0.06, 0.1],
    ],
  },
  {
    name: 'Aurora',
    colors: [
      [0.05, 0.08, 0.16],
      [0.1, 0.32, 0.48],
      [0.42, 0.2, 0.58],
      [0.06, 0.1, 0.18],
    ],
  },
  {
    name: 'Sunset',
    colors: [
      [0.1, 0.05, 0.1],
      [0.62, 0.22, 0.28],
      [0.5, 0.38, 0.2],
      [0.18, 0.05, 0.12],
    ],
  },
  {
    name: 'Forest',
    colors: [
      [0.04, 0.09, 0.07],
      [0.08, 0.32, 0.26],
      [0.1, 0.2, 0.32],
      [0.05, 0.11, 0.1],
    ],
  },
  {
    name: 'Plum',
    colors: [
      [0.1, 0.05, 0.14],
      [0.5, 0.16, 0.5],
      [0.26, 0.1, 0.42],
      [0.08, 0.04, 0.12],
    ],
  },
  {
    name: 'Cyber',
    colors: [
      [0.04, 0.06, 0.12],
      [0.06, 0.42, 0.52],
      [0.55, 0.1, 0.38],
      [0.05, 0.05, 0.12],
    ],
  },
  {
    name: 'Ember',
    colors: [
      [0.1, 0.04, 0.04],
      [0.62, 0.26, 0.1],
      [0.45, 0.1, 0.1],
      [0.1, 0.05, 0.05],
    ],
  },
  {
    name: 'Ice',
    colors: [
      [0.05, 0.07, 0.12],
      [0.2, 0.32, 0.55],
      [0.32, 0.42, 0.58],
      [0.07, 0.09, 0.16],
    ],
  },
]

function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: [
          'radial-gradient(60% 50% at 10% 10%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 65%)',
          'radial-gradient(50% 50% at 90% 100%, color-mix(in srgb, var(--foreground) 6%, transparent), transparent 65%)',
        ].join(', '),
      }}
    />
  )
}

function ShuffleButton({
  onClick,
  paletteName,
}: {
  onClick: () => void
  paletteName: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-white/75 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      <ShuffleIcon className="size-3.5 transition-transform group-hover:rotate-12" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
        {paletteName}
      </span>
    </button>
  )
}

const VERT_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAG_SRC = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.y = 1.0 - uv.y;
  float t = u_time * 0.00015;

  vec2 p0 = vec2(0.30 + sin(t * 0.70) * 0.25, 0.25 + cos(t * 0.60) * 0.20);
  vec2 p1 = vec2(0.75 + cos(t * 0.50) * 0.20, 0.70 + sin(t * 0.80) * 0.20);
  vec2 p2 = vec2(0.50 + sin(t * 0.40 + 1.0) * 0.30, 0.50 + cos(t * 0.70) * 0.25);
  vec2 p3 = vec2(0.20 + cos(t * 0.55) * 0.20, 0.85 + sin(t * 0.45) * 0.15);

  float r = 0.55;
  float d0 = pow(1.0 - smoothstep(0.0, r, distance(uv, p0)), 1.4);
  float d1 = pow(1.0 - smoothstep(0.0, r, distance(uv, p1)), 1.4);
  float d2 = pow(1.0 - smoothstep(0.0, r, distance(uv, p2)), 1.4);
  float d3 = pow(1.0 - smoothstep(0.0, r, distance(uv, p3)), 1.4);

  float total = d0 + d1 + d2 + d3 + 0.0001;
  vec3 col = (u_c0 * d0 + u_c1 * d1 + u_c2 * d2 + u_c3 * d3) / total;

  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.025;

  gl_FragColor = vec4(col, 1.0);
}`

function MeshShader({ palette }: { palette: Palette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(palette.colors)
  const currentRef = useRef(
    palette.colors.map((c) => [...c]) as Palette['colors'],
  )

  useEffect(() => {
    targetRef.current = palette.colors
  }, [palette])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
    })

    if (!gl) return

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null

      gl.shaderSource(shader, src)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }

      return shader
    }

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)

    if (!vs || !fs) return

    const program = gl.createProgram()
    if (!program) return

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return

    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const positionLocation = gl.getAttribLocation(program, 'a_position')

    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const uResolution = gl.getUniformLocation(program, 'u_resolution')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uColor0 = gl.getUniformLocation(program, 'u_c0')
    const uColor1 = gl.getUniformLocation(program, 'u_c1')
    const uColor2 = gl.getUniformLocation(program, 'u_c2')
    const uColor3 = gl.getUniformLocation(program, 'u_c3')

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const time = now - start
      const k = 0.06

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          currentRef.current[i][j] +=
            (targetRef.current[i][j] - currentRef.current[i][j]) * k
        }
      }

      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uTime, time)

      const colors = currentRef.current

      gl.uniform3f(uColor0, colors[0][0], colors[0][1], colors[0][2])
      gl.uniform3f(uColor1, colors[1][0], colors[1][1], colors[1][2])
      gl.uniform3f(uColor2, colors[2][0], colors[2][1], colors[2][2])
      gl.uniform3f(uColor3, colors[3][0], colors[3][1], colors[3][2])

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()

      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 block h-full w-full"
    />
  )
}

function LeftPanel() {
  const [paletteIndex, setPaletteIndex] = useState(1)
  const palette = PALETTES[paletteIndex]
  const router = useRouter()

  const shuffle = () => {
    setPaletteIndex((current) => {
      let next = current

      while (next === current) {
        next = Math.floor(Math.random() * PALETTES.length)
      }

      return next
    })
  }

  return (
    <div className="relative hidden overflow-hidden bg-[#0a0a0c] lg:block">
      <MeshShader palette={palette} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="flex items-start justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              router.back()
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/75 transition hover:text-white"
          >
            <ChevronLeftIcon className="size-3.5" />
            Back
          </button>
        </div>

        <div className="max-w-md">
          <h2
            className="font-heading text-3xl font-semibold leading-tight md:text-4xl"
            style={{ textShadow: '0 1px 24px rgba(0,0,0,0.55)' }}
          >
            <span className="text-white">Zentra.</span>
            <br />
            <span className="text-white/55">
              The Open Source workspace
            </span>{' '}
            <span className="text-white">you want.</span>{' '}
          </h2>

          <p
            className="mt-5 max-w-sm text-sm leading-relaxed text-white/65"
            style={{ textShadow: '0 1px 16px rgba(0,0,0,0.55)' }}
          >
            Zentra is a free and open source workspace that helps you.
          </p>
        </div>
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/icon.svg"
        alt="One Calendar"
        width={16}
        height={16}
        className="size-8"
      />
    </div>
  )
}

function OrbitMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className="size-10"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <rect width="64" height="64" rx="14" fill="url(#orbit-bg)" />
      <g transform="translate(32 32) rotate(-25)">
        <path
          d="M -23 0 A 23 8 0 0 1 23 0"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <circle cx="32" cy="32" r="20" fill="url(#orbit-glow)" />
      <circle cx="32" cy="32" r="13" fill="url(#orbit-sphere)" />
      <g transform="translate(32 32) rotate(-25)">
        <path
          d="M 23 0 A 23 8 0 0 1 -23 0"
          stroke="#ffffff"
          strokeOpacity="0.8"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <defs>
        <radialGradient id="orbit-bg" cx="50%" cy="15%" r="95%">
          <stop offset="0%" stopColor="#1d1d2c" />
          <stop offset="100%" stopColor="#0a0a0f" />
        </radialGradient>
        <radialGradient id="orbit-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="orbit-sphere" x1="20%" y1="20%" x2="80%" y2="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#b9b9d2" />
          <stop offset="100%" stopColor="#5a5a78" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Heading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mt-12 flex flex-col gap-1.5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.5v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.6.8.5 4.5-1.5 7.8-5.8 7.8-10.8C23.4 5.6 18.3.5 12 .5Z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 5c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.5 15 .5 12 .5 7.3.5 3.3 3.2 1.4 7.1l3.8 3c.9-2.8 3.5-4.6 6.8-4.6Z"
      />
      <path
        fill="#34A853"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.6Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1l-3.8-3C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.6Z"
      />
      <path
        fill="#4285F4"
        d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.3 0-6-2-6.9-4.6l-3.8 3C3.3 20.8 7.3 23.5 12 23.5Z"
      />
    </svg>
  )
}

function OAuthButton({
  icon,
  label,
  badge,
}: {
  icon: ReactNode
  label: string
  badge?: string
}) {
  return (
    <div className="relative">
      {badge ? (
        <span className="absolute -top-2 right-2 z-10 whitespace-nowrap rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
          {badge}
        </span>
      ) : null}

      <Button variant="outline" size="lg" className="w-full">
        <span className="size-4 shrink-0 [&_svg]:size-4">{icon}</span>
        <span className="truncate whitespace-nowrap">{label}</span>
      </Button>
    </div>
  )
}

function OAuthRow() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-2.5">
      <OAuthButton icon={<GitHubIcon />} label="GitHub" />
      <OAuthButton icon={<GoogleIcon />} label="Google" badge="Last used" />
    </div>
  )
}

function MagicLinkButton() {
  return (
    <Button variant="outline" size="lg" className="mt-2.5 w-full">
      <MailIcon className="size-4" />
      Sign in with Magic Link
    </Button>
  )
}

function OrSeparator() {
  return (
    <div className="my-6 flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-[11px] text-muted-foreground">Or</span>
      <Separator className="flex-1" />
    </div>
  )
}

type AuthLayoutProps = {
  title: string
  description: string
  showOAuth?: boolean
  showMagicLink?: boolean
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({
  title,
  description,
  showOAuth = false,
  showMagicLink = false,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-svh bg-background text-foreground">
      <PageBackdrop />
      <div className="relative mx-auto flex min-h-svh max-w-[1440px] items-stretch p-4 md:p-10 lg:p-16">
        <div className="relative grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/10 lg:grid-cols-[1fr_minmax(440px,560px)]">
          <LeftPanel />
          <div className="relative flex min-h-[680px] flex-col overflow-y-auto bg-card text-foreground">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10 lg:py-14">
              <BrandMark />
              <Heading title={title} description={description} />
              <div className="mt-6">{children}</div>
              {footer ? <div className="mt-5">{footer}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
