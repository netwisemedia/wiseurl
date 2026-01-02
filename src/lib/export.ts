import { Link, Click } from './types'

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header]
                // Escape quotes and wrap in quotes if contains comma or newline
                const stringValue = String(value ?? '')
                if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
                    return `"${stringValue.replace(/"/g, '""')}"`
                }
                return stringValue
            }).join(',')
        )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function exportLinksCSV(links: Link[]): void {
    const data = links.map(link => ({
        code: link.code,
        destination_url: link.destination_url,
        title: link.title || '',
        is_active: link.is_active ? 'Yes' : 'No',
        created_at: new Date(link.created_at).toISOString(),
    }))
    exportToCSV(data, `wiseurl-links-${new Date().toISOString().split('T')[0]}`)
}

export function exportClicksCSV(clicks: Click[]): void {
    const data = clicks.map(click => ({
        code: click.code,
        clicked_at: new Date(click.clicked_at).toISOString(),
        country: click.country || '',
        city: click.city || '',
        device_type: click.device_type || '',
        os_name: click.os_name || '',
        browser_name: click.browser_name || '',
        original_referrer: click.original_referrer || '',
        is_bot: click.is_bot ? 'Yes' : 'No',
    }))
    exportToCSV(data, `wiseurl-clicks-${new Date().toISOString().split('T')[0]}`)
}
