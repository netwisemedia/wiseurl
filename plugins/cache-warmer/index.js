/**
 * Netlify Build Plugin - Cache Warmer
 * 
 * Warms the link cache after successful deploy
 */

module.exports = {
    onSuccess: async ({ constants }) => {
        const siteUrl = process.env.URL || 'https://wiseurl.net'

        console.log('🔥 Warming link cache...')

        try {
            const response = await fetch(`${siteUrl}/api/cache/warm`)
            const data = await response.json()

            if (data.success) {
                console.log(`✅ Cache warmed: ${data.links_loaded} links loaded in ${data.duration_ms}ms`)
            } else {
                console.log(`⚠️ Cache warm failed: ${data.error}`)
            }
        } catch (err) {
            console.log(`⚠️ Cache warm request failed: ${err.message}`)
            // Don't fail the deploy for cache issues
        }
    }
}
