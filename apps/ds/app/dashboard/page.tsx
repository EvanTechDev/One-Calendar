interface DashboardPageProps {
  searchParams: Promise<{ handle?: string; did?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { handle, did } = await searchParams
  return (
    <main style={{ maxWidth: 620, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>DS Dashboard</h1>
      <p>登录成功</p>
      <p>handle: {handle ?? '-'}</p>
      <p>did: {did ?? '-'}</p>
    </main>
  )
}
