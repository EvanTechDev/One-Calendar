import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>One Calendar App</h1>
      <p>AT Protocol DID signed requests + zero-trust DS migration.</p>
      <Link href="/settings">Open Settings</Link>
    </main>
  );
}
