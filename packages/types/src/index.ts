export interface OAuthClientMetadata {
  client_id: string
  redirect_uris: string[]
  scope?: string
  grant_types?: string[]
  response_types?: string[]
  token_endpoint_auth_method?: 'none'
  [key: string]: unknown
}

export interface DsGrantRecord {
  did: string
  clientId: string
  scopes: string[]
  createdAt: string
}

export interface DsTokenClaims {
  sub: string
  client_id: string
  iss: string
  scope?: string
  type: 'access' | 'refresh'
}
