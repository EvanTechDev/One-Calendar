'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@zntr/ui/tabs'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Bot,
  Eye,
  EyeOff,
} from 'lucide-react'

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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Bot className="h-5 w-5" />
        MCP (Model Context Protocol)
      </div>
      <p className="text-sm text-muted-foreground">
        Let AI agents access and manage your calendar data securely.
      </p>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="oauth">Authorized Apps</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <MCPOverview />
        </TabsContent>
        <TabsContent value="api-keys">
          <MCPApiKeys />
        </TabsContent>
        <TabsContent value="oauth">
          <MCPOAuthApps />
        </TabsContent>
        <TabsContent value="audit-logs">
          <MCPAuditLogs />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MCPOverview() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/mcp/settings')
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.settings?.enabled ?? true)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleMcp = async (value: boolean) => {
    setEnabled(value)
    await fetch('/api/mcp/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: value }),
    })
  }

  if (loading) {
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
            <li>Create an API key in the API Keys tab</li>
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
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
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

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/mcp/api-keys')
    const data = await res.json()
    setKeys(data.keys ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    const res = await fetch('/api/mcp/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
    })
    const data = await res.json()
    setCreatedKey(data.key)
    setShowCreate(false)
    setNewKeyName('')
    loadKeys()
  }

  const deleteKey = async () => {
    if (!deletingKey) return
    setIsDeletingKey(true)
    await fetch('/api/mcp/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletingKey.id }),
    })
    setDeletingKey(null)
    setIsDeletingKey(false)
    loadKeys()
  }

  const saveScopes = async () => {
    if (!editingScopes) return
    await fetch('/api/mcp/api-keys', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingScopes.id,
        scopes: editingScopes.scopes,
      }),
    })
    setEditingScopes(null)
    loadKeys()
  }

  const toggleScope = (scope: string) => {
    if (!editingScopes) return
    const scopes = editingScopes.scopes.includes(scope)
      ? editingScopes.scopes.filter((s) => s !== scope)
      : [...editingScopes.scopes, scope]
    setEditingScopes({ ...editingScopes, scopes })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

      <div className="flex justify-between items-center">
        <h3 className="font-medium">API Keys</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Key
        </Button>
      </div>

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
                    · Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
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
    </div>
  )
}

function MCPOAuthApps() {
  const [apps, setApps] = useState<AuthorizedApp[]>([])
  const [loading, setLoading] = useState(true)

  const loadApps = useCallback(async () => {
    const res = await fetch('/api/mcp/authorized-apps')
    const data = await res.json()
    setApps(data.apps ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  const revokeApp = async (id: string) => {
    await fetch('/api/mcp/authorized-apps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadApps()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Authorized Applications</h3>

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
                  <span className="font-medium text-sm">{app.clientName}</span>
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
    </div>
  )
}

function MCPAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadLogs = useCallback(async (p: number) => {
    const res = await fetch(`/api/mcp/audit-logs?page=${p}&limit=20`)
    const data = await res.json()
    setLogs(data.logs ?? [])
    setTotalPages(data.pagination?.totalPages ?? 1)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLogs(page)
  }, [page, loadLogs])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Audit Logs</h3>

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
            <div className="flex justify-center gap-2">
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
    </div>
  )
}
