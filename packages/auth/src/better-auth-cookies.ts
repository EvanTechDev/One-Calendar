/**
 * Cookie helpers, isolated so edge middleware can read them without dragging in
 * the better-auth server.
 *
 * `apps/calendar/proxy.ts` runs in edge middleware and needs exactly one
 * function. Importing it from the `@zntr/auth` barrel would resolve `./server`
 * as well — `createAuth`, the better-auth server and its drizzle adapter — none
 * of which middleware can use. A consumer cannot fix that from the outside: the
 * subpath `@zntr/auth/better-auth-cookies` skips the barrel entirely, so
 * nothing else in this package is pulled into the edge bundle.
 *
 * `better-auth` is a dependency of THIS package, so `better-auth/cookies`
 * resolves here. It does not resolve from `apps/calendar`, which cannot import
 * it directly — hence this file rather than a direct import at the call site.
 */
export { getSessionCookie } from 'better-auth/cookies'
