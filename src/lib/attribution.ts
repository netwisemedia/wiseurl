export interface Attribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  sub_id1: string | null
  sub_id2: string | null
  sub_id3: string | null
  query_params: Record<string, string> | null
}

export type SourceKind = 'explicit' | 'referrer' | 'unknown'

export interface ResolvedSource {
  label: string
  kind: SourceKind
}

const UTM_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
])

const SUB_ID_KEYS = new Set([
  'sub_id1',
  'sub_id2',
  'sub_id3',
  's1',
  's2',
  's3',
  'subid',
])

const ATTRIBUTION_KEYS = new Set([...UTM_KEYS, ...SUB_ID_KEYS])

function parameterValue(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)
  return value ? value.slice(0, 255) : null
}

export function extractAttribution(params: URLSearchParams): Attribution {
  const extras: Record<string, string> = {}

  params.forEach((value, key) => {
    if (!ATTRIBUTION_KEYS.has(key.toLowerCase()) && Object.keys(extras).length < 50) {
      extras[key.slice(0, 255)] = value.slice(0, 2_000)
    }
  })

  return {
    utm_source: parameterValue(params, 'utm_source'),
    utm_medium: parameterValue(params, 'utm_medium'),
    utm_campaign: parameterValue(params, 'utm_campaign'),
    utm_content: parameterValue(params, 'utm_content'),
    utm_term: parameterValue(params, 'utm_term'),
    sub_id1: parameterValue(params, 'sub_id1') || parameterValue(params, 's1') || parameterValue(params, 'subid'),
    sub_id2: parameterValue(params, 'sub_id2') || parameterValue(params, 's2'),
    sub_id3: parameterValue(params, 'sub_id3') || parameterValue(params, 's3'),
    query_params: Object.keys(extras).length > 0 ? extras : null,
  }
}

export function validateHttpUrl(value: string): URL {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error('Destination must be an absolute HTTP or HTTPS URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Destination must use HTTP or HTTPS')
  }

  if (url.username || url.password) {
    throw new Error('Destination URLs cannot contain credentials')
  }

  return url
}

export function applyMacros(destination: string, macros: Record<string, string>): string {
  return destination.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = macros[key]
    return value === undefined ? match : encodeURIComponent(value)
  })
}

export function buildDestination(
  destination: string,
  incoming: URLSearchParams,
  macros: Record<string, string> = {},
): string {
  const output = validateHttpUrl(applyMacros(destination, macros))

  incoming.forEach((value, key) => {
    if (UTM_KEYS.has(key.toLowerCase())) return
    if (!output.searchParams.has(key)) output.searchParams.append(key, value)
  })

  return output.toString()
}

export function normalizeReferrerHostname(referrer: string | null): string | null {
  if (!referrer) return null

  try {
    const url = new URL(referrer)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null

    const hostname = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
    return hostname || null
  } catch {
    return null
  }
}

export function resolveSource(utmSource: string | null, referrer: string | null): ResolvedSource {
  const explicit = utmSource?.trim()
  if (explicit) return { label: explicit, kind: 'explicit' }

  const hostname = normalizeReferrerHostname(referrer)
  if (hostname) return { label: hostname, kind: 'referrer' }

  return { label: 'Unknown source', kind: 'unknown' }
}
