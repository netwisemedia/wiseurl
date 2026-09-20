import { resolveSource, type Attribution, type SourceKind } from './attribution.ts'

export interface ClickInsertError {
  code?: string
  message: string
}

export interface ClickBase {
  linkId: string
  code: string
  clickId: string
  destinationSnapshot: string
  originalReferrer: string | null
  country: string | null
  city: string | null
  deviceType: string
  osName: string
  browserName: string
  isBot: boolean
}

export interface ClickPayload extends Record<string, unknown> {
  link_id: string
  code: string
  original_referrer: string | null
  country: string | null
  city: string | null
  device_type: string
  os_name: string
  browser_name: string
  is_bot: boolean
  click_id: string
  destination_url_snapshot: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  sub_id1: string | null
  sub_id2: string | null
  sub_id3: string | null
  query_params: Record<string, string> | null
  source_label: string
  source_kind: SourceKind
}

export type LegacyClickPayload = Pick<
  ClickPayload,
  | 'link_id'
  | 'code'
  | 'original_referrer'
  | 'country'
  | 'city'
  | 'device_type'
  | 'os_name'
  | 'browser_name'
  | 'is_bot'
>

export interface ClickPersistenceResult {
  recorded: boolean
  mode: 'full' | 'legacy' | 'failed'
  error: ClickInsertError | null
}

type InsertClick = (
  payload: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<{ error: ClickInsertError | null }>

export function buildClickPayload(base: ClickBase, attribution: Attribution): ClickPayload {
  const source = resolveSource(attribution.utm_source, base.originalReferrer)

  return {
    link_id: base.linkId,
    code: base.code,
    original_referrer: base.originalReferrer,
    country: base.country,
    city: base.city,
    device_type: base.deviceType,
    os_name: base.osName,
    browser_name: base.browserName,
    is_bot: base.isBot,
    click_id: base.clickId,
    destination_url_snapshot: base.destinationSnapshot,
    ...attribution,
    source_label: source.label,
    source_kind: source.kind,
  }
}

export function toLegacyClickPayload(payload: ClickPayload): LegacyClickPayload {
  return {
    link_id: payload.link_id,
    code: payload.code,
    original_referrer: payload.original_referrer,
    country: payload.country,
    city: payload.city,
    device_type: payload.device_type,
    os_name: payload.os_name,
    browser_name: payload.browser_name,
    is_bot: payload.is_bot,
  }
}

function isMissingAttributionColumn(error: ClickInsertError): boolean {
  return error.code === '42703' || error.code === 'PGRST204' || (
    /column/i.test(error.message) &&
    /(click_id|utm_|sub_id|query_params|source_label|source_kind)/i.test(error.message)
  )
}

export async function persistClickWithFallback(
  payload: ClickPayload,
  insert: InsertClick,
  timeoutMs = 1_500,
): Promise<ClickPersistenceResult> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  const attempt = async (): Promise<ClickPersistenceResult> => {
    try {
      const first = await insert(payload, controller.signal)
      if (!first.error) return { recorded: true, mode: 'full', error: null }

      if (!isMissingAttributionColumn(first.error)) {
        return { recorded: false, mode: 'failed', error: first.error }
      }

      const legacy = await insert(toLegacyClickPayload(payload), controller.signal)
      return legacy.error
        ? { recorded: false, mode: 'failed', error: legacy.error }
        : { recorded: true, mode: 'legacy', error: null }
    } catch (error) {
      return {
        recorded: false,
        mode: 'failed',
        error: {
          code: controller.signal.aborted ? 'TIMEOUT' : 'EXCEPTION',
          message: error instanceof Error ? error.message : 'Click insert failed',
        },
      }
    }
  }

  const timeout = new Promise<ClickPersistenceResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({
        recorded: false,
        mode: 'failed',
        error: { code: 'TIMEOUT', message: `Click insert exceeded ${timeoutMs}ms` },
      })
    }, timeoutMs)
  })

  const result = await Promise.race([attempt(), timeout])
  if (timer) clearTimeout(timer)
  return result
}
