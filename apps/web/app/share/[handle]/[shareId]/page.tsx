interface SharePageProps {
  params: { handle: string; shareId: string }
  searchParams: { password?: string }
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { handle, shareId } = params
  const { password } = searchParams

  const query = new URLSearchParams({ handle, id: shareId })
  if (password) query.set('password', password)

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${base}/api/share/public?${query.toString()}`, {
    cache: 'no-store',
  })

  const payload = await res.json()

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Shared event</h1>
      <pre className="overflow-auto rounded bg-muted p-4 text-sm">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  )
}
