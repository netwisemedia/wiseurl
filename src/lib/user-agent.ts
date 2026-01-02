/**
 * Parse User-Agent string to extract device, OS, and browser information
 */
export function parseUserAgent(ua: string | null): {
    deviceType: string
    osName: string
    browserName: string
    isBot: boolean
} {
    if (!ua) {
        return { deviceType: 'unknown', osName: 'unknown', browserName: 'unknown', isBot: false }
    }

    const uaLower = ua.toLowerCase()

    // Bot detection
    const botPatterns = [
        'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
        'python', 'java/', 'httpclient', 'okhttp', 'axios',
        'googlebot', 'bingbot', 'yandex', 'baiduspider',
        'facebookexternalhit', 'twitterbot', 'linkedinbot',
        'slackbot', 'telegrambot', 'whatsapp', 'discordbot'
    ]
    const isBot = botPatterns.some(pattern => uaLower.includes(pattern))

    // Device type detection
    let deviceType = 'desktop'
    if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
        deviceType = 'mobile'
    } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet'
    }

    // OS detection
    let osName = 'unknown'
    if (/windows nt 10/i.test(ua)) osName = 'Windows 10/11'
    else if (/windows nt 6.3/i.test(ua)) osName = 'Windows 8.1'
    else if (/windows nt 6.2/i.test(ua)) osName = 'Windows 8'
    else if (/windows nt 6.1/i.test(ua)) osName = 'Windows 7'
    else if (/windows/i.test(ua)) osName = 'Windows'
    else if (/macintosh|mac os x/i.test(ua)) osName = 'macOS'
    else if (/android/i.test(ua)) {
        const match = ua.match(/android\s+([\d.]+)/i)
        osName = match ? `Android ${match[1]}` : 'Android'
    }
    else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS'
    else if (/linux/i.test(ua)) osName = 'Linux'
    else if (/ubuntu/i.test(ua)) osName = 'Ubuntu'
    else if (/chrome os/i.test(ua)) osName = 'Chrome OS'

    // Browser detection (order matters - more specific first)
    let browserName = 'unknown'
    if (/edg\//i.test(ua)) browserName = 'Edge'
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browserName = 'Opera'
    else if (/brave/i.test(ua)) browserName = 'Brave'
    else if (/vivaldi/i.test(ua)) browserName = 'Vivaldi'
    else if (/firefox|fxios/i.test(ua)) browserName = 'Firefox'
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browserName = 'Safari'
    else if (/chrome|crios/i.test(ua)) browserName = 'Chrome'
    else if (/msie|trident/i.test(ua)) browserName = 'Internet Explorer'

    return { deviceType, osName, browserName, isBot }
}
