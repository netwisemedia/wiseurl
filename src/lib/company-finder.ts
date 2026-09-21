export interface CompanyLinkSearchItem {
  id: string
  code: string
  title: string | null
  destination_url: string
  is_active: boolean
}

export function normalizeCompanySearch(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

export function findCompanyLinks<T extends CompanyLinkSearchItem>(links: readonly T[], query: string): T[] {
  const normalizedQuery = normalizeCompanySearch(query)
  if (!normalizedQuery) return []

  return links.filter(link => [link.code, link.title || '', link.destination_url]
    .some(value => normalizeCompanySearch(value).includes(normalizedQuery)))
}
