import { redirect } from 'next/navigation'
import { getTxn } from '@/lib/atproto-auth-txn'

export default async function DsConsentPage() {
  const txn = await getTxn()
  if (!txn || txn.source !== 'web' || !txn.webOauth) {
    redirect('/atproto/auth?error=missing_web_context')
  }

  return (
    <main style={{ maxWidth: 620, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>授权 Web 客户端</h1>
      <p>handle: {txn.handle}</p>
      <p>did: {txn.did}</p>
      <p>client: {txn.webOauth.clientId}</p>
      <p>scope: {txn.webOauth.scope}</p>

      <form method="post" action="/api/oauth/authorize" style={{ marginTop: 16 }}>
        <input type="hidden" name="did" value={txn.did} />
        <input type="hidden" name="client_id" value={txn.webOauth.clientId} />
        <input type="hidden" name="redirect_uri" value={txn.webOauth.redirectUri} />
        <input type="hidden" name="code_challenge" value={txn.webOauth.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="state" value={txn.webOauth.state} />
        <input type="hidden" name="scope" value={txn.webOauth.scope} />
        <button type="submit" style={{ padding: 10, borderRadius: 8, border: 0, background: '#0052cc', color: '#fff' }}>
          允许并返回 Web
        </button>
      </form>
    </main>
  )
}
