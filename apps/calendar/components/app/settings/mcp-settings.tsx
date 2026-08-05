'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { fetchJson } from '@/lib/fetch-json'
import { Button } from '@zntr/ui/button'
import { Switch } from '@zntr/ui/switch'
import { Label } from '@zntr/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@zntr/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from '@zntr/ui/card'
import { Input } from '@zntr/ui/input'
import { Checkbox } from '@zntr/ui/checkbox'
import { Badge } from '@zntr/ui/badge'
import { Spinner } from '@zntr/ui/spinner'

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
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { translations, useLanguage } from '@zntr/i18n/calendar'

const ALL_SCOPE_OPTIONS = [
  { value: 'events:read', label: 'events:read' },
  { value: 'events:write', label: 'events:write' },
  { value: 'categories:read', label: 'categories:read' },
  { value: 'categories:write', label: 'categories:write' },
  { value: 'countdowns:read', label: 'countdowns:read' },
  { value: 'countdowns:write', label: 'countdowns:write' },
  { value: 'settings:read', label: 'settings:read' },
  { value: 'settings:write', label: 'settings:write' },
  { value: 'profile:read', label: 'profile:read' },
]

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
  createdAt: string
  expiresAt: string
  isRevoked: boolean
}

interface AuditLog {
  id: string
  authType: string
  action: string
  resourceType: string | null
  resourceId: string | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export default function MCPSettings() {
  const [language] = useLanguage()
  const t = translations[language]

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-base font-semibold">{t.settingsMcp}</h2>
        <p className="text-sm text-muted-foreground">{t.settingsMcpDesc}</p>
      </div>

      <MCPOverview />

      <MCPApiKeys />

      <MCPOAuthApps />

      <MCPAuditLogs />
    </div>
  )
}

function MCPOverview() {
  const { data, isLoading, mutate } = useSWR<{
    settings?: { enabled?: boolean }
  }>(
    '/api/mcp/settings',
    () => fetchJson<{ settings?: { enabled?: boolean } }>('/api/mcp/settings'),
    { staleTime: 300_000 },
  )
  const enabled = data?.settings?.enabled ?? true

  const toggleMcp = async (value: boolean) => {
    mutate({ settings: { enabled: value } }, { revalidate: false })
    try {
      await fetchJson('/api/mcp/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: value }),
      })
    } catch {
      mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Enable MCP</CardTitle>
              <CardDescription>
                Allow AI agents to connect to your calendar via MCP protocol
              </CardDescription>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleMcp} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP Endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/api/mcp`
                : '/api/mcp'}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/api/mcp`
                navigator.clipboard.writeText(url)
              }}
            >
              <ClipboardCopy className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Configure your AI agent to connect to this endpoint using Bearer
            authentication with an API key or OAuth token.
          </CardDescription>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Create an API key in the API Keys section</li>
            <li>Copy the endpoint URL above</li>
            <li>
              Configure your AI agent (Claude, ChatGPT, etc.) with the endpoint
              and API key
            </li>
            <li>The agent can now query and manage your calendar</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function MCPApiKeys() {
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['events:read'])
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [editingScopes, setEditingScopes] = useState<{
    id: string
    scopes: string[]
  } | null>(null)
  const [showFullKey, setShowFullKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null)
  const [isDeletingKey, setIsDeletingKey] = useState(false)

  const { data, isLoading, mutate } = useSWR<{ keys: ApiKey[] }>(
    '/api/mcp/api-keys',
    () => fetchJson<{ keys: ApiKey[] }>('/api/mcp/api-keys'),
    { staleTime: 300_000 },
  )
  const keys = data?.keys ?? []

  const createKey = async () => {
    if (!newKeyName.trim()) return
    const res = await fetchJson<{ key: string }>('/api/mcp/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
    })
    setCreatedKey(res.key)
    setShowCreate(false)
    setNewKeyName('')
    mutate()
  }

  const deleteKey = async () => {
    if (!deletingKey) return
    setIsDeletingKey(true)
    const prev = data?.keys ?? []
    mutate({ keys: prev.filter((k) => k.id !== deletingKey.id) }, { revalidate: false })
    try {
      await fetchJson('/api/mcp/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingKey.id }),
      })
    } catch {
      mutate({ keys: prev }, { revalidate: false })
    }
    setDeletingKey(null)
    setIsDeletingKey(false)
  }

  const saveScopes = async () => {
    if (!editingScopes) return
    await fetchJson('/api/mcp/api-keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingScopes.id,
        scopes: editingScopes.scopes,
      }),
    })
    setEditingScopes(null)
    mutate()
  }

  const toggleScope = (scope: string) => {
    if (!editingScopes) return
    const scopes = editingScopes.scopes.includes(scope)
      ? editingScopes.scopes.filter((s) => s !== scope)
      : [...editingScopes.scopes, scope]
    setEditingScopes({ ...editingScopes, scopes })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Create and manage API keys for AI agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Create and manage API keys for AI agents.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Key
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No API keys created yet.
          </p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{key.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditingScopes({ id: key.id, scopes: key.scopes })
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Scopes — {key.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          {ALL_SCOPE_OPTIONS.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={
                                  editingScopes?.scopes.includes(opt.value) ??
                                  false
                                }
                                onCheckedChange={() => toggleScope(opt.value)}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                        <Button className="w-full" onClick={saveScopes}>
                          Save Scopes
                        </Button>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${key.name}`}
                      onClick={() => setDeletingKey(key)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{key.keyPrefix}...</span>
                  {key.lastUsedAt && (
                    <span>
                      · Last used:{' '}
                      {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={!!createdKey}
        onOpenChange={(o) => !o && setCreatedKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Save this key now — it will not be shown again!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {showFullKey === createdKey
                  ? createdKey
                  : createdKey?.slice(0, 12) + '...'}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setShowFullKey(showFullKey === createdKey ? null : createdKey)
                }
              >
                {showFullKey === createdKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  createdKey && navigator.clipboard.writeText(createdKey)
                }
              >
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => setCreatedKey(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., My Claude Agent"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALL_SCOPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={newKeyScopes.includes(opt.value)}
                      onCheckedChange={() => {
                        setNewKeyScopes((prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((s) => s !== opt.value)
                            : [...prev, opt.value],
                        )
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={createKey}>
              Create Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              “{deletingKey?.name}” will stop working immediately. Any AI agent
              using this key will no longer be able to access your calendar.
              This action cannot be undone.
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
    </Card>
  )
}

function MCPOAuthApps() {
  const { data, isLoading, mutate } = useSWR<{ apps: AuthorizedApp[] }>(
    '/api/mcp/authorized-apps',
    () => fetchJson<{ apps: AuthorizedApp[] }>('/api/mcp/authorized-apps'),
    { staleTime: 300_000 },
  )
  const apps = data?.apps ?? []

  const revokeApp = async (id: string) => {
    const prev = data?.apps ?? []
    mutate({ apps: prev.filter((a) => a.id !== id) }, { revalidate: false })
    try {
      await fetchJson('/api/mcp/authorized-apps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      mutate({ apps: prev }, { revalidate: false })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authorized Applications</CardTitle>
          <CardDescription>
            OAuth applications authorized to access your calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authorized Applications</CardTitle>
        <CardDescription>
          OAuth applications authorized to access your calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No OAuth applications authorized yet.
          </p>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div key={app.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {app.clientName}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeApp(app.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {app.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary">
                      {scope}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Authorized {new Date(app.createdAt).toLocaleDateString()}
                  {app.expiresAt &&
                    ` · Expires ${new Date(app.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MCPAuditLogs() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useSWR<{
    logs: AuditLog[]
    pagination?: { totalPages: number }
  }>(
    `/api/mcp/audit-logs?page=${page}&limit=20`,
    () =>
      fetchJson<{ logs: AuditLog[]; pagination?: { totalPages: number } }>(
        `/api/mcp/audit-logs?page=${page}&limit=20`,
      ),
    { staleTime: 300_000, keepPreviousData: true },
  )
  const logs = data?.logs ?? []
  const totalPages = data?.pagination?.totalPages ?? 1

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            MCP operations performed against your calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>
          MCP operations performed against your calendar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No MCP operations logged yet.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border p-3 flex items-start gap-3"
                >
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.action}</span>
                      <Badge variant="secondary">{log.authType}</Badge>
                      {log.resourceType && (
                        <span className="text-xs text-muted-foreground">
                          {log.resourceType}
                          {log.resourceId && `:${log.resourceId.slice(0, 8)}`}
                        </span>
                      )}
                    </div>
                    {log.errorMessage && (
                      <p className="text-xs text-red-500 mt-1 truncate">
                        {log.errorMessage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground self-center">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
