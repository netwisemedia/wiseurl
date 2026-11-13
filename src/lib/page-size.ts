export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 50
export const PAGE_SIZE_PARAM = 'rows'

export function parsePageSize(value: string | null | undefined): number {
  const parsed = Number(value)
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}
