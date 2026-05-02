import { redirect } from 'next/navigation'

export default function SSOSignUpCallback() {
  redirect('/app')
}
