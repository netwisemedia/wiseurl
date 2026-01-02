import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseUserAgent } from '@/lib/user-agent'

export const runtime = 'edge'

interface Params {
  params: Promise<{ code: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params
  const supabase = await createClient()

  // Get link from database
  const { data: link, error } = await supabase
    .from('links')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (error || !link) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Link Not Found - WiseURL</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          }
          .container { text-align: center; padding: 2rem; }
          h1 { font-size: 5rem; font-weight: 800; opacity: 0.3; }
          h2 { font-size: 1.25rem; margin: 1rem 0; }
          p { opacity: 0.7; margin-bottom: 2rem; font-size: 0.875rem; }
          a {
            display: inline-block;
            background: #6366f1;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            text-decoration: none;
          }
          a:hover { background: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>404</h1>
          <h2>Link Not Found</h2>
          <p>This link doesn't exist or has been deactivated.</p>
          <a href="/">Go Home</a>
        </div>
      </body>
      </html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Extract tracking data
  const userAgent = request.headers.get('user-agent') || ''
  const originalReferrer = request.headers.get('referer') || null
  const { deviceType, osName, browserName, isBot } = parseUserAgent(userAgent)

  // Get geo data from edge headers (NO IP STORED)
  // Support for Vercel, Netlify, and Cloudflare
  const country = request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-nf-geo-country-code') ||
    request.headers.get('x-country') ||
    request.headers.get('cf-ipcountry') || null

  const city = request.headers.get('x-vercel-ip-city') ||
    request.headers.get('x-nf-geo-city') ||
    request.headers.get('x-city') ||
    request.headers.get('cf-ipcity') || null

  // Log click (no rate limiting - all clicks count for coupon testing use case)
  try {
    const { error } = await supabase
      .from('clicks')
      .insert({
        link_id: link.id,
        code: code,
        original_referrer: originalReferrer,
        country: country,
        city: city,
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        is_bot: isBot,
      })

    if (error) {
      console.error('❌ Click tracking error:', error.message)
    } else {
      console.log('✅ Click tracked:', code, country)
    }
  } catch (err) {
    console.error('❌ Click tracking exception:', err)
  }

  // HTTP 302 redirect - destination will see wiseurl as referrer
  return NextResponse.redirect(link.destination_url, { status: 302 })
}
