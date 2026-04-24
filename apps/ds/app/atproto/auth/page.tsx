interface AtprotoAuthPageProps {
  searchParams: Promise<{
    handle?: string
    source?: string
    client_id?: string
    redirect_uri?: string
    code_challenge?: string
    state?: string
    scope?: string
    error?: string
  }>
}

export default async function AtprotoAuthPage({ searchParams }: AtprotoAuthPageProps) {
  const params = await searchParams

  return (
    <main style={{ maxWidth: 620, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>ATProto 登录</h1>
      <p>输入 handle，DS 将解析你的 PDS 并走 ATProto OAuth。</p>

      <form method="post" action="/atproto/auth/start" style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <input
          name="handle"
          required
          defaultValue={params.handle ?? ''}
          placeholder="alice.bsky.social"
          style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
        />
        <input type="hidden" name="source" value={params.source === 'web' ? 'web' : 'local'} />
        <input type="hidden" name="client_id" value={params.client_id ?? ''} />
        <input type="hidden" name="redirect_uri" value={params.redirect_uri ?? ''} />
        <input type="hidden" name="code_challenge" value={params.code_challenge ?? ''} />
        <input type="hidden" name="state" value={params.state ?? ''} />
        <input type="hidden" name="scope" value={params.scope ?? ''} />
        <button type="submit" style={{ padding: 10, borderRadius: 8, border: 0, background: '#0052cc', color: '#fff' }}>
          继续到 PDS 授权
        </button>
      </form>

      {params.error ? (
        <p style={{ marginTop: 12, color: '#c1121f' }}>错误：{params.error}</p>
      ) : null}
    </main>
  )
}
