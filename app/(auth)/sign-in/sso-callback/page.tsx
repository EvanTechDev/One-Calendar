import { redirect } from 'next/navigation'

export default function SSOSignInCallback() {
  redirect('/app')
}
