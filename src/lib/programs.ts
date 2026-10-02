import type { Program, ProgramAccess } from './types'

type SearchableLink = {
  code: string
  title: string | null
  destination_url: string
  is_active: boolean
}

export type AccessFilter = ProgramAccess | 'unknown' | 'all'

export function programForCode<T extends Pick<Program, 'code'>>(programs: T[], code: string): T | undefined {
  return programs.find(program => program.code === code)
}

export function filterProgramLinks<T extends SearchableLink>(
  links: T[],
  programs: Array<Pick<Program, 'code' | 'network' | 'access'>>,
  search: string,
  access: AccessFilter,
): T[] {
  const query = search.trim().toLowerCase()
  const programsByCode = new Map(programs.map(program => [program.code, program]))

  return links.filter(link => {
    const program = programsByCode.get(link.code)
    const status = program?.access ?? 'unknown'
    return (access === 'all' || status === access) && (
      !query || [link.code, link.title, link.destination_url, program?.network]
        .some(value => value?.toLowerCase().includes(query))
    )
  }).sort((first, second) => first.code.localeCompare(second.code))
}

export function parseCookieDays(input: string): number | null {
  if (input.trim() === '') return null
  if (!/^\d+$/.test(input.trim())) throw new Error('Cookie days must be a nonnegative whole number')
  const value = Number(input.trim())
  if (!Number.isSafeInteger(value) || value > 2147483647) throw new Error('Cookie days is too large')
  return value
}
