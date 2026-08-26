import { ConsentForm } from '@/components/auth/consent-form'

/**
 * The consent prompt.
 *
 * Our own apps are registered with `skip_consent`, so this page is not part of
 * any current flow — but it must exist and work, because the provider redirects
 * here for any client without that flag. A missing consent page would present as
 * a dead redirect at the exact moment a third-party client is first added.
 *
 * The scopes shown come from the provider, which reads them from the
 * authorization request it already validated. The page never reads the query
 * string for them: a page that displayed attacker-supplied scope names would let
 * a request claim to be asking for less than it is.
 */
export default function ConsentPage() {
  return <ConsentForm />
}
