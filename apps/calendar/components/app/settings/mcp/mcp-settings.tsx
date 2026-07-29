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


import {
  Key,
  Globe,
  ClipboardCopy,
  Trash2,
  Plus,
  Loader2,
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

type Tab = 'overview' | 'api-keys' | 'oauth' | 'audit-logs'

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
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export default function MCPSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Bot className="h-5 w-5" />
        MCP (Model Context Protocol)
      </div>
      <p className="text-sm text-muted-foreground">
        Let AI agents access and manage your calendar data securely.
      </p>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {(['overview', 'api-keys', 'oauth', 'audit-logs'] as Tab[]).map(
          (tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'api-keys' && 'API Keys'}
              {tab === 'oauth' && 'Authorized Apps'}
              {tab === 'audit-logs' && 'Audit Logs'}
            </Button>
          ),
        )}
      </div>

      {activeTab === 'overview' && <MCPOverview />}
      {activeTab === 'api-keys' && <MCPApiKeys />}
      {activeTab === 'oauth' && <MCPOAuthApps />}
      {activeTab === 'audit-logs' && <MCPAuditLogs />}
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-base font-medium">Enable MCP</Label>
            <p className="text-sm text-muted-foreground">
              Allow AI agents to connect to your calendar via MCP protocol
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleMcp} />
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">MCP Endpoint</h3>
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
        <p className="text-xs text-muted-foreground">
          Configure your AI agent to connect to this endpoint using Bearer
          authentication with an API key or OAuth token.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Quick Start</h3>
        <ol className="text-sm space-y-2 list-decimal list-inside">
          <li>Create an API key in the API Keys tab</li>
          <li>Copy the endpoint URL above</li>
          <li>
            Configure your AI agent (Claude, ChatGPT, etc.) with the endpoint
            and API key
          </li>
          <li>The agent can now query and manage your calendar</li>
        </ol>
      </div>
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

  const revokeKey = async (id: string) => {
    await fetch('/api/mcp/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            <div>
              <Label>Key Name</Label>
              <input
                className="w-full rounded border bg-background px-3 py-2 text-sm"
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
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(opt.value)}
                      onChange={() => {
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
                  {!key.isActive && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      Revoked
                    </span>
                  )}
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
                            <input
                              type="checkbox"
                              checked={
                                editingScopes?.scopes.includes(opt.value) ??
                                false
                              }
                              onChange={() => toggleScope(opt.value)}
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
                  {key.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
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
                  <span
                    key={scope}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  <span
                    key={scope}
                    className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                  >
                    {scope}
                  </span>
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {log.authType}
                    </span>
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
