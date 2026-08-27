'use client'

import { useMemo, useState } from 'react'
import useSWR, { type SWRConfiguration } from 'swr'
import { fetchJson } from '@/lib/fetch-json'
import { removeById } from '@/lib/array-mutations'
import { toast } from 'sonner'
import { Button } from '@zntr/ui/button'
import { Switch } from '@zntr/ui/switch'
import { Label } from '@zntr/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@zntr/ui/dialog'
import { Input } from '@zntr/ui/input'
import { Checkbox } from '@zntr/ui/checkbox'
import { Badge } from '@zntr/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@zntr/ui/select'
import { Spinner } from '@zntr/ui/spinner'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@zntr/ui/empty'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@zntr/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@zntr/ui/alert-dialog'

import {
  Key,
  Globe,
  ClipboardCopy,
  Trash2,
  Plus,
  Check,
  X,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  ScrollText,
  Plug,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'
import { cn } from '@zntr/utils'

/**
 * Scopes grouped by the resource they govern, so the picker reads as
 * "what can this agent touch" instead of a flat 12-item checkbox wall.
 * `read` is always listed before `write` inside a group.
 */
const SCOPE_GROUPS = [
  {
    resource: 'events',
    label: 'Events',
    description: 'Calendar events and recurrence',
    scopes: ['events:read', 'events:write'],
  },
  {
    resource: 'categories',
    label: 'Categories',
    description: 'Calendar categories',
    scopes: ['categories:read', 'categories:write'],
  },
  {
    resource: 'countdowns',
    label: 'Countdowns',
    description: 'Countdown widgets',
    scopes: ['countdowns:read', 'countdowns:write'],
  },
  {
    resource: 'bookmarks',
    label: 'Bookmarks',
    description: 'Bookmarked events',
    scopes: ['bookmarks:read', 'bookmarks:write'],
  },
  {
    resource: 'settings',
    label: 'Settings',
    description: 'Preferences and timezone',
    scopes: ['settings:read', 'settings:write'],
  },
  {
    resource: 'profile',
    label: 'Profile',
    description: 'Name, email and avatar',
    scopes: ['profile:read'],
  },
] as const

const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes as readonly string[])

const READ_ONLY_SCOPES = ALL_SCOPES.filter((s) => s.endsWith(':read'))

const MCP_KEYS = {
  settings: '/api/mcp/settings',
  apiKeys: '/api/mcp/api-keys',
  authorizedApps: '/api/mcp/authorized-apps',
  auditLogs: (page: number, filters: AuditFilters) => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (filters.entryType !== 'all') params.set('entryType', filters.entryType)
    if (filters.mutationsOnly) params.set('mutationsOnly', 'true')
    if (filters.failuresOnly) params.set('failuresOnly', 'true')
    if (filters.toolName !== 'all') params.set('toolName', filters.toolName)
    return `/api/mcp/audit-logs?${params.toString()}`
  },
} as const

function useMcpQuery<T>(key: string, config?: SWRConfiguration<T>) {
  return useSWR<T>(key, (k) => fetchJson<T>(k as string), config)
}

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface AuthorizedApp {
  id: string
  clientId: string
  clientName: string
  scopes: string[]
  resources: string[]
  createdAt: string
}

type AuditEntryType = 'request' | 'tool_call'

interface AuditLog {
  id: string
  authType: string
  action: string
  entryType: AuditEntryType
  toolName: string | null
  resourceType: string | null
  resourceId: string | null
  isMutation: boolean
  changes: {
    fields?: string[]
    apply_to?: string
    emailCount?: number
    exdateCount?: number
    rruleChanged?: boolean
  } | null
  durationMs: number | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

interface AuditFilters {
  entryType: AuditEntryType | 'all'
  mutationsOnly: boolean
  failuresOnly: boolean
  toolName: string
}

const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  entryType: 'all',
  mutationsOnly: false,
  failuresOnly: false,
  toolName: 'all',
}

function endpointUrl(): string {
  return typeof window !== 'undefined'
    ? `${window.location.origin}/api/mcp`
    : '/api/mcp'
}

async function copyToClipboard(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(message)
  } catch {
    toast.error('Failed to copy')
  }
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Section shell: a titled block with an optional right-aligned action. Replaces
 * the previous stack of full Cards, which gave every group the same visual
 * weight and made the page read as an undifferentiated list of boxes.
 */
function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-medium leading-6">{title}</h3>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Compact scope summary: "Events, Settings +2" rather than 12 raw badges. */
function ScopeSummary({ scopes }: { scopes: string[] }) {
  const groups = useMemo(() => {
    const names: string[] = []
    for (const group of SCOPE_GROUPS) {
      const owned = group.scopes.filter((s) => scopes.includes(s))
      if (owned.length === 0) continue
      const writable = owned.some((s) => s.endsWith(':write'))
      names.push(writable ? `${group.label} (write)` : group.label)
    }
    return names
  }, [scopes])

  if (groups.length === 0) {
    return <span className="text-xs text-muted-foreground">No access</span>
  }

  const shown = groups.slice(0, 3)
  const extra = groups.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((name) => (
        <Badge key={name} variant="secondary" className="font-normal">
          {name}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge variant="outline" className="font-normal">
          +{extra}
        </Badge>
      ) : null}
    </div>
  )
}

/**
 * Grouped scope picker with read/write columns and bulk presets, so granting
 * "read everything" is one click instead of six.
 */
function ScopePicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (scope: string) => {
    onChange(
      value.includes(scope)
        ? value.filter((s) => s !== scope)
        : [...value, scope],
    )
  }

  const allSelected = ALL_SCOPES.every((s) => value.includes(s))

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Permissions</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([...READ_ONLY_SCOPES])}
          >
            Read only
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange(allSelected ? [] : [...ALL_SCOPES])}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </Button>
        </div>
      </div>

      <div className="divide-y rounded-md border">
        {SCOPE_GROUPS.map((group) => {
          const readScope = group.scopes.find((s) => s.endsWith(':read'))
          const writeScope = group.scopes.find((s) => s.endsWith(':write'))
          return (
            <div
              key={group.resource}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{group.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {readScope ? (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={value.includes(readScope)}
                      onCheckedChange={() => toggle(readScope)}
                      aria-label={`${group.label} read`}
                    />
                    Read
                  </label>
                ) : null}
                {writeScope ? (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={value.includes(writeScope)}
                      onCheckedChange={() => toggle(writeScope)}
                      aria-label={`${group.label} write`}
                    />
                    Write
                  </label>
                ) : (
                  <span className="w-[3.25rem]" aria-hidden />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {value.length} of {ALL_SCOPES.length} permissions granted
      </p>
    </div>
  )
}

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted/50" />
      ))}
    </div>
  )
}

export default function MCPSettings() {
  const [language] = useLanguage()
  const t = translations[language]

  // `rounded-lg border p-4` matches the import/export and build-info panels, so
  // switching settings tabs no longer changes the visual container.
  return (
    <div className="w-full space-y-4">
      <div className="w-full space-y-6 rounded-lg border p-4">
        <div>
          <h2 className="text-base font-semibold">{t.settingsMcp}</h2>
          <p className="text-sm text-muted-foreground">{t.settingsMcpDesc}</p>
        </div>
        <MCPConnection />
      </div>

      <div className="w-full rounded-lg border p-4">
        <MCPApiKeys />
      </div>

      <div className="w-full rounded-lg border p-4">
        <MCPOAuthApps />
      </div>

      <div className="w-full rounded-lg border p-4">
        <MCPAuditLogs />
      </div>
    </div>
  )
}

/**
 * Connection block: the master switch and the endpoint live together because
 * they are one decision ("is MCP on, and where do agents point"). Previously
 * these were three separate Cards including a static "Quick Start" list.
 */
function MCPConnection() {
  const { data, isLoading, mutate } = useMcpQuery<{
    settings?: { enabled?: boolean }
  }>(MCP_KEYS.settings)
  const enabled = data?.settings?.enabled ?? true
  const url = endpointUrl()

  const toggleMcp = async (value: boolean) => {
    const prev = data?.settings
    mutate({ settings: { enabled: value } }, { revalidate: false })
    try {
      await fetchJson(MCP_KEYS.settings, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: value }),
      })
    } catch {
      if (prev !== undefined) {
        mutate({ settings: prev }, { revalidate: false })
      } else {
        mutate()
      }
      toast.error('Failed to update MCP settings')
    }
  }

  return (
    <Section
      icon={Plug}
      title="Connection"
      description="Let AI agents read and manage this calendar over MCP."
      action={
        isLoading ? (
          <Spinner className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs',
                enabled ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={toggleMcp}
              aria-label="Enable MCP"
            />
          </div>
        )
      }
    >
      <div
        className={cn(
          'rounded-md border p-3 transition-opacity',
          !enabled && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">
            Server endpoint
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-xs"
            onClick={() => copyToClipboard(url, 'Endpoint copied')}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
        <code className="mt-1 block break-all font-mono text-sm">{url}</code>
        <p className="mt-2 text-xs text-muted-foreground">
          Authenticate with <span className="font-medium">Bearer</span> using an
          API key below, or authorize an app over OAuth.
        </p>
      </div>
    </Section>
  )
}

function MCPApiKeys() {
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['events:read'])
  const [isCreating, setIsCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [revealCreatedKey, setRevealCreatedKey] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [editingScopes, setEditingScopes] = useState<string[]>([])
  const [isSavingScopes, setIsSavingScopes] = useState(false)
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null)
  const [isDeletingKey, setIsDeletingKey] = useState(false)

  const { data, isLoading, mutate } = useMcpQuery<{ keys: ApiKey[] }>(
    MCP_KEYS.apiKeys,
  )
  const keys = data?.keys ?? []

  const resetCreateForm = () => {
    setNewKeyName('')
    setNewKeyScopes(['events:read'])
  }

  const createKey = async () => {
    if (!newKeyName.trim() || newKeyScopes.length === 0) return
    setIsCreating(true)
    try {
      const res = await fetchJson<{ key: string }>(MCP_KEYS.apiKeys, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      })
      setCreatedKey(res.key)
      setRevealCreatedKey(false)
      setShowCreate(false)
      resetCreateForm()
      mutate()
    } catch {
      toast.error('Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const deleteKey = async () => {
    if (!deletingKey) return
    setIsDeletingKey(true)
    const prev = data?.keys ?? []
    mutate({ keys: removeById(prev, deletingKey.id) }, { revalidate: false })
    try {
      await fetchJson(MCP_KEYS.apiKeys, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingKey.id }),
      })
      toast.success('API key deleted')
    } catch {
      mutate({ keys: prev }, { revalidate: false })
      toast.error('Failed to delete API key')
    }
    setDeletingKey(null)
    setIsDeletingKey(false)
  }

  const saveScopes = async () => {
    if (!editingKey) return
    setIsSavingScopes(true)
    try {
      await fetchJson(MCP_KEYS.apiKeys, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingKey.id, scopes: editingScopes }),
      })
      toast.success('Permissions updated')
      setEditingKey(null)
      mutate()
    } catch {
      toast.error('Failed to update permissions')
    } finally {
      setIsSavingScopes(false)
    }
  }

  return (
    <Section
      icon={Key}
      title="API keys"
      description="Long-lived credentials for agents you configure yourself."
      action={
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New key
        </Button>
      }
    >
      {isLoading ? (
        <SectionSkeleton />
      ) : keys.length === 0 ? (
        <Empty className="border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Key />
            </EmptyMedia>
            <EmptyTitle>No API keys</EmptyTitle>
            <EmptyDescription>
              Create a key to connect an agent such as Claude or ChatGPT.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Create your first key
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="divide-y rounded-md border">
          {keys.map((key) => {
            const lastUsed = formatRelative(key.lastUsedAt)
            return (
              <li
                key={key.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {key.name}
                    </span>
                    {!key.isActive ? (
                      <Badge variant="outline" className="font-normal">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <code className="font-mono">{key.keyPrefix}…</code>
                    <span aria-hidden>·</span>
                    <span>{lastUsed ? `Used ${lastUsed}` : 'Never used'}</span>
                  </div>
                  <ScopeSummary scopes={key.scopes} />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={`Manage ${key.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingKey(key)
                        setEditingScopes(key.scopes)
                      }}
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Edit permissions
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeletingKey(key)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete key
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      {/* Create */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>
              Name the agent and choose what it may access. You can change
              permissions later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mcp-key-name">Name</Label>
              <Input
                id="mcp-key-name"
                placeholder="My Claude agent"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                autoFocus
              />
            </div>
            <ScopePicker value={newKeyScopes} onChange={setNewKeyScopes} />
            <Button
              className="w-full"
              onClick={createKey}
              disabled={
                isCreating || !newKeyName.trim() || newKeyScopes.length === 0
              }
            >
              {isCreating ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Created — one-time reveal */}
      <Dialog
        open={!!createdKey}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedKey(null)
            setRevealCreatedKey(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key created</DialogTitle>
            <DialogDescription>
              Copy it now — this is the only time it is shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
              <code className="flex-1 break-all font-mono text-xs">
                {revealCreatedKey
                  ? createdKey
                  : `${createdKey?.slice(0, 12) ?? ''}${'•'.repeat(16)}`}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={revealCreatedKey ? 'Hide key' : 'Reveal key'}
                onClick={() => setRevealCreatedKey((v) => !v)}
              >
                {revealCreatedKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Copy key"
                onClick={() =>
                  createdKey && copyToClipboard(createdKey, 'API key copied')
                }
              >
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setCreatedKey(null)
                setRevealCreatedKey(false)
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit permissions */}
      <Dialog
        open={!!editingKey}
        onOpenChange={(open) => {
          if (!open) setEditingKey(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissions</DialogTitle>
            <DialogDescription>{editingKey?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ScopePicker value={editingScopes} onChange={setEditingScopes} />
            <Button
              className="w-full"
              onClick={saveScopes}
              disabled={isSavingScopes}
            >
              {isSavingScopes ? 'Saving…' : 'Save permissions'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog
        open={!!deletingKey}
        onOpenChange={(open) => {
          if (!open) setDeletingKey(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingKey?.name}” stops working immediately and any agent
              using it loses access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                void deleteKey()
              }}
              disabled={isDeletingKey}
            >
              {isDeletingKey ? 'Deleting…' : 'Delete key'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

function MCPOAuthApps() {
  const [revoking, setRevoking] = useState<AuthorizedApp | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const { data, isLoading, mutate } = useMcpQuery<{ apps: AuthorizedApp[] }>(
    MCP_KEYS.authorizedApps,
  )
  const apps = data?.apps ?? []

  const revokeApp = async () => {
    if (!revoking) return
    setIsRevoking(true)
    const prev = data?.apps ?? []
    mutate({ apps: removeById(prev, revoking.id) }, { revalidate: false })
    try {
      await fetchJson(MCP_KEYS.authorizedApps, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: revoking.id }),
      })
      toast.success('Access revoked')
    } catch {
      mutate({ apps: prev }, { revalidate: false })
      toast.error('Failed to revoke access')
    }
    setRevoking(null)
    setIsRevoking(false)
  }

  return (
    <Section
      icon={Globe}
      title="Connected apps"
      description="Apps you authorized over OAuth."
    >
      {isLoading ? (
        <SectionSkeleton rows={1} />
      ) : apps.length === 0 ? (
        <Empty className="border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Globe />
            </EmptyMedia>
            <EmptyTitle>No connected apps</EmptyTitle>
            <EmptyDescription>
              Apps appear here after you approve an OAuth request.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-md border">
          {apps.map((app) => (
            <li
              key={app.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 space-y-1">
                <span className="truncate text-sm font-medium">
                  {app.clientName}
                </span>
                <p className="text-xs text-muted-foreground">
                  Authorized {new Date(app.createdAt).toLocaleDateString()}
                </p>
                <ScopeSummary scopes={app.scopes} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setRevoking(app)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!revoking}
        onOpenChange={(open) => {
          if (!open) setRevoking(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription>
              “{revoking?.clientName}” loses access to your calendar
              immediately. You can authorize it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                void revokeApp()
              }}
              disabled={isRevoking}
            >
              {isRevoking ? 'Revoking…' : 'Revoke access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}

function AuditChangeSummary({ log }: { log: AuditLog }) {
  const changes = log.changes
  if (!changes) return null
  const bits: string[] = []
  if (changes.fields?.length) bits.push(changes.fields.join(', '))
  if (changes.apply_to) bits.push(`scope: ${changes.apply_to}`)
  if (typeof changes.emailCount === 'number') {
    bits.push(`${changes.emailCount} participant(s)`)
  }
  if (typeof changes.exdateCount === 'number') {
    bits.push(`${changes.exdateCount} exclusion(s)`)
  }
  if (changes.rruleChanged) bits.push('repeat rule')
  if (bits.length === 0) return null
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      Changed: <span className="text-foreground">{bits.join(' · ')}</span>
    </p>
  )
}

function MCPAuditLogs() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)

  // Any filter change invalidates the current offset.
  const updateFilters = (patch: Partial<AuditFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const { data, isLoading } = useMcpQuery<{
    logs: AuditLog[]
    toolNames?: string[]
    pagination?: { totalPages: number }
  }>(MCP_KEYS.auditLogs(page, filters), { keepPreviousData: true })
  const logs = data?.logs ?? []
  const toolNames = data?.toolNames ?? []
  const totalPages = data?.pagination?.totalPages ?? 1
  const filtersActive =
    filters.entryType !== 'all' ||
    filters.mutationsOnly ||
    filters.failuresOnly ||
    filters.toolName !== 'all'

  return (
    <Section
      icon={ScrollText}
      title="Activity"
      description="Tool calls and data changes made through MCP."
      action={
        totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span className="px-1 text-xs text-muted-foreground">
              {page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.entryType}
          onValueChange={(value) =>
            updateFilters({ entryType: value as AuditFilters['entryType'] })
          }
        >
          <SelectTrigger size="sm" className="w-[9.5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entries</SelectItem>
            <SelectItem value="tool_call">Tool calls</SelectItem>
            <SelectItem value="request">Requests</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.toolName}
          onValueChange={(value) => updateFilters({ toolName: value })}
          disabled={toolNames.length === 0}
        >
          <SelectTrigger size="sm" className="w-[11rem]">
            <SelectValue placeholder="All tools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tools</SelectItem>
            {toolNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.mutationsOnly ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          aria-pressed={filters.mutationsOnly}
          onClick={() =>
            updateFilters({ mutationsOnly: !filters.mutationsOnly })
          }
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Data changes
        </Button>

        <Button
          variant={filters.failuresOnly ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          aria-pressed={filters.failuresOnly}
          onClick={() => updateFilters({ failuresOnly: !filters.failuresOnly })}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Failures
        </Button>

        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setFilters(DEFAULT_AUDIT_FILTERS)
              setPage(1)
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <SectionSkeleton rows={3} />
      ) : logs.length === 0 ? (
        <Empty className="border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>
              {filtersActive ? 'No matching activity' : 'No activity yet'}
            </EmptyTitle>
            <EmptyDescription>
              {filtersActive
                ? 'Try clearing the filters.'
                : 'Operations show up here once an agent connects.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y rounded-md border">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-2.5 px-3 py-2">
              <span
                className={cn(
                  'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                  log.success
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
                )}
                aria-label={log.success ? 'Succeeded' : 'Failed'}
              >
                {log.success ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <X className="h-2.5 w-2.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs">
                    {log.toolName ?? log.action}
                  </span>
                  {log.isMutation ? (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 py-0 text-[10px] font-normal"
                    >
                      write
                    </Badge>
                  ) : null}
                  {log.resourceType ? (
                    <span className="text-xs text-muted-foreground">
                      {log.resourceType}
                      {log.resourceId ? `:${log.resourceId.slice(0, 8)}` : ''}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatRelative(log.createdAt)}
                  </span>
                </div>
                <AuditChangeSummary log={log} />
                {log.errorMessage ? (
                  <p className="mt-0.5 truncate text-xs text-destructive">
                    {log.errorMessage}
                  </p>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  via {log.authType}
                  {typeof log.durationMs === 'number'
                    ? ` · ${log.durationMs}ms`
                    : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
