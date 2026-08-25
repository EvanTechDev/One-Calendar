'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  CircleUserRound,
  ExternalLink,
  Info,
  Image as ImageIcon,
  LogOut,
  Mic,
  Monitor,
  Palette,
  SlidersHorizontal,
  Video,
  Waves,
  X,
} from 'lucide-react'
import { Dialog, DialogContent } from '@zntr/ui/dialog'
import { Button } from '@zntr/ui/button'
import { Switch } from '@zntr/ui/switch'
import { ScrollArea } from '@zntr/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { cn } from '@zntr/utils'
import { loadUserChoices, saveUserChoices } from '@/lib/user-choices'
import { BACKGROUND_EFFECTS, BACKGROUND_LABELS } from '@/lib/backgrounds'
import { THEME_OPTIONS } from '@/lib/theme'
import type { BackgroundEffect } from '@/lib/backgrounds'
import type { ThemeOption } from '@/lib/theme'

export type SettingsSection = 'preferences' | 'account' | 'about'

export const SETTINGS_SECTIONS: {
  id: SettingsSection
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'preferences', label: 'Preferences', icon: <SlidersHorizontal /> },
  { id: 'account', label: 'Account', icon: <CircleUserRound /> },
  { id: 'about', label: 'About', icon: <Info /> },
]

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'
const COMMIT_HASH = process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'unknown'
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? ''

export interface SettingsUser {
  name: string
  email: string
  image?: string | null
}

/**
 * The dashboard's settings, structurally mirroring
 * apps/calendar/components/app/settings/settings-dialog.tsx — same
 * `sm:max-w-3xl` shell, same `sm:w-56` aside with an `h-14` title strip lined
 * up against an `h-14` content header, same `hidden`-toggled sections.
 *
 * Deliberately NOT a relocation of the in-meeting settings dialog. That one is
 * built on a live room: `useMediaDeviceSelect` and `useKrispNoiseFilter` need
 * `RoomContext`, and the background section returns null without a
 * `localVideoTrack`. Rendered here it would show nothing or throw. What this
 * offers instead is persisted *preferences* that the join path applies — see
 * lib/join-preferences.ts, called from components/room/active-room.tsx.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  user,
  calendarOrigin,
  onSignOut,
  signingOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: SettingsUser
  calendarOrigin: string
  onSignOut: () => void
  signingOut?: boolean
}) {
  const [section, setSection] = useState<SettingsSection>('preferences')

  // Reset AFTER the close animation, not the moment `open` flips: resetting
  // synchronously re-renders the dialog on the first tab while it is still
  // fading out, which shows as a flash to "Preferences" on every close. Same
  // 250ms the calendar uses.
  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setSection('preferences'), 250)
    return () => window.clearTimeout(timer)
  }, [open])

  const activeSection = SETTINGS_SECTIONS.find((s) => s.id === section)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100vw-1rem)] p-0 sm:max-w-3xl"
        aria-label="Settings"
      >
        <div className="flex h-[min(86vh,46rem)] flex-col overflow-hidden sm:flex-row">
          <aside className="flex shrink-0 flex-col border-b bg-muted/30 sm:w-56 sm:border-r sm:border-b-0 sm:bg-card/40">
            {/* Same height and type scale as the content header on the right,
                so the two tops line up instead of stepping. */}
            <div className="hidden h-14 shrink-0 items-center border-b px-4 sm:flex">
              <span className="font-heading text-base leading-snug font-semibold">
                Settings
              </span>
            </div>
            <nav
              aria-label="Settings"
              className="flex gap-1 overflow-x-auto p-2 sm:flex-col sm:overflow-y-auto sm:p-2.5"
            >
              {SETTINGS_SECTIONS.map((s) => {
                const active = s.id === section
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span className="[&_svg]:size-4">{s.icon}</span>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground [&_svg]:size-4">
                  {activeSection?.icon}
                </span>
                <h2 className="font-heading truncate text-base leading-snug font-semibold">
                  {activeSection?.label}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="px-5 pt-4 pb-8">
                {/* `data-section` names each panel for the same reason the nav
                    items carry aria-current: all three stay mounted and are
                    told apart only by `hidden`, which is otherwise invisible to
                    anything inspecting the tree. */}
                <div
                  data-section="preferences"
                  hidden={section !== 'preferences'}
                >
                  <PreferencesSettings />
                </div>
                <div data-section="account" hidden={section !== 'account'}>
                  <AccountSettings
                    user={user}
                    calendarOrigin={calendarOrigin}
                    onSignOut={onSignOut}
                    signingOut={signingOut}
                  />
                </div>
                <div data-section="about" hidden={section !== 'about'}>
                  <AboutSettings />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Copied from the calendar's SettingRow so the two dialogs read identically. */
function SettingRow({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3.5 pl-4 pr-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <div className="text-sm leading-snug font-medium">{title}</div>
          {description ? (
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border rounded-xl border bg-card">
      {children}
    </div>
  )
}

const THEME_LABELS: Record<ThemeOption, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

function PreferencesSettings() {
  const { theme, setTheme } = useTheme()
  // Read once on mount rather than at render: localStorage is unavailable
  // during SSR, and reading it in the render body makes the first client render
  // disagree with the server's.
  const [choices, setChoices] = useState<ReturnType<
    typeof loadUserChoices
  > | null>(null)
  useEffect(() => {
    setChoices(loadUserChoices())
  }, [])

  /** Every write goes through here, so nothing can be set without persisting. */
  const update = (patch: Parameters<typeof saveUserChoices>[0]) => {
    saveUserChoices(patch)
    setChoices((current) => (current ? { ...current, ...patch } : current))
  }

  const selectClass = 'w-40 sm:w-48'

  return (
    <div className="space-y-6">
      <SettingsGroup>
        <SettingRow
          icon={<Palette />}
          title="Theme"
          description="How Zentra Meet looks on this device."
        >
          <Select
            value={theme ?? 'system'}
            onValueChange={(value) => setTheme(value)}
          >
            {/* Labelled explicitly: the SettingRow's title is a plain div, not
                a <label>, so without this the select has no accessible name. */}
            <SelectTrigger
              id="theme"
              aria-label="Theme"
              className={selectClass}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {THEME_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsGroup>

      <section className="space-y-2">
        <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          When you join a meeting
        </h3>
        <SettingsGroup>
          <SettingRow
            icon={<Mic />}
            title="Microphone on"
            description="Off means you join muted."
          >
            <Switch
              id="join-audio"
              aria-label="Microphone on"
              checked={choices?.audioEnabled ?? true}
              disabled={!choices}
              onCheckedChange={(checked) => update({ audioEnabled: checked })}
            />
          </SettingRow>
          <SettingRow
            icon={<Video />}
            title="Camera on"
            description="Off means you join with video stopped."
          >
            <Switch
              id="join-video"
              aria-label="Camera on"
              checked={choices?.videoEnabled ?? true}
              disabled={!choices}
              onCheckedChange={(checked) => update({ videoEnabled: checked })}
            />
          </SettingRow>
          <SettingRow
            icon={<Waves />}
            title="Noise cancellation"
            description="Suppress background noise with Krisp. Applied once your microphone is live; unsupported browsers simply join unfiltered."
          >
            <Switch
              id="join-noise-filter"
              aria-label="Noise cancellation"
              checked={choices?.noiseFilterEnabled ?? false}
              disabled={!choices}
              onCheckedChange={(checked) =>
                update({ noiseFilterEnabled: checked })
              }
            />
          </SettingRow>
          <SettingRow
            icon={<ImageIcon />}
            title="Camera background"
            description="Applied once your camera is live. Preview it in a meeting — a preview needs a running camera, which this page has none of."
          >
            <Select
              value={choices?.backgroundEffect ?? 'none'}
              disabled={!choices}
              onValueChange={(value) =>
                update({ backgroundEffect: value as BackgroundEffect })
              }
            >
              <SelectTrigger
                id="join-background"
                aria-label="Camera background"
                className={selectClass}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BACKGROUND_EFFECTS.map((effect) => (
                  <SelectItem key={effect} value={effect}>
                    {BACKGROUND_LABELS[effect]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingsGroup>
        {/* Devices are absent on purpose, and saying so beats an empty select.
            enumerateDevices() returns entries with blank labels until camera or
            microphone permission has been granted, and this page never asks for
            either — so a picker here would list "Camera 3f2a1c" or nothing at
            all. The join screen asks for permission, so that is where the real
            picker lives. */}
        <p className="px-1 text-xs text-muted-foreground">
          Camera and microphone are chosen on the join screen, where your
          browser has granted permission and can name them.
        </p>
      </section>
    </div>
  )
}

function AccountSettings({
  user,
  calendarOrigin,
  onSignOut,
  signingOut,
}: {
  user: SettingsUser
  calendarOrigin: string
  onSignOut: () => void
  signingOut?: boolean
}) {
  return (
    <div className="space-y-6">
      <section className="flex items-start gap-4" aria-label="Your account">
        <img
          src={user.image || '/user.png'}
          alt="avatar"
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-full border object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1 space-y-1 pt-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      </section>

      {/*
        No editable fields here on purpose. Meet's auth route deliberately
        exposes only session-read and sign-out, so every account mutation
        (name, avatar, email, password, 2FA, deletion) is the calendar's to
        perform. A form here would either need that route widened — bypassing
        the calendar's captcha, bot blocking, and audit logging — or fake a save
        that never happens.
      */}
      <SettingsGroup>
        <SettingRow
          icon={<CircleUserRound />}
          title="Manage your account"
          description="Your name, avatar, email, password, and two-factor sign-in are managed in Zentra Calendar."
        >
          <Button variant="secondary" size="sm" asChild>
            <a
              href={`${calendarOrigin}/app`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open calendar
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </SettingRow>
        <SettingRow
          icon={<LogOut />}
          title="Sign out"
          description="Signs you out of Zentra Meet on this device."
        >
          <Button
            variant="destructive"
            size="sm"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </SettingRow>
      </SettingsGroup>
    </div>
  )
}

function AboutSettings() {
  const [deployedAt, setDeployedAt] = useState<string | null>(null)
  // Formatted after mount: an absolute timestamp rendered on the server is
  // formatted in the server's locale and timezone (UTC on Vercel).
  useEffect(() => {
    const parsed = new Date(BUILD_TIME)
    setDeployedAt(
      Number.isNaN(parsed.getTime())
        ? null
        : new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(parsed),
    )
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-medium">Build</h3>
        <dl className="space-y-3 text-sm">
          <Fact label="Version" value={APP_VERSION} mono />
          <Fact label="Commit" value={COMMIT_HASH} mono />
          {/* Only rendered when there is a real value: an "unknown" row here
              would look like a bug rather than an unset build variable. */}
          {deployedAt ? <Fact label="Deployed" value={deployedAt} /> : null}
        </dl>
      </div>

      {/*
        No update-check row, unlike the calendar's BuildInfoCard. That card
        drives a service worker and a /api/build-info endpoint; meet registers no
        service worker and has no such endpoint, so the button would have nothing
        to do.
      */}
      <SettingsGroup>
        <SettingRow
          icon={<Monitor />}
          title="Zentra Meet"
          description="Video meetings for Zentra Calendar. Part of the Zentra suite."
        />
      </SettingsGroup>
    </div>
  )
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : undefined}>{value}</dd>
    </div>
  )
}
