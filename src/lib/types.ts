export interface Link {
    id: string
    code: string
    destination_url: string
    title: string | null
    tags: string[] | null
    is_active: boolean
    created_at: string
    updated_at: string
    user_id: string | null
    group_id: string | null
}

export interface Group {
    id: string
    name: string
    color: string
    user_id: string
    created_at: string
}

export interface Click {
    id: string
    link_id: string
    code: string
    original_referrer: string | null
    country: string | null
    city: string | null
    device_type: string | null
    os_name: string | null
    browser_name: string | null
    is_bot: boolean
    clicked_at: string
    click_id: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    utm_content: string | null
    utm_term: string | null
    sub_id1: string | null
    sub_id2: string | null
    sub_id3: string | null
    query_params: Record<string, string> | null
    source_label: string | null
    source_kind: 'explicit' | 'referrer' | 'unknown' | null
    destination_url_snapshot: string | null
}

export interface ErrorLog {
    id: string
    code: string
    original_referrer: string | null
    country: string | null
    city: string | null
    device_type: string | null
    os_name: string | null
    browser_name: string | null
    is_bot: boolean
    created_at: string
}

// Analytics aggregation types
export interface ClickStats {
    total: number
    today: number
    yesterday: number
    thisWeek: number
    thisMonth: number
}

export interface DeviceStats {
    device_type: string
    count: number
}

export interface CountryStats {
    country: string
    count: number
}

export interface ReferrerStats {
    referrer: string
    count: number
}

export interface DailyStats {
    date: string
    count: number
}

export interface Database {
    public: {
        Tables: {
            links: {
                Row: Link
                Insert: Omit<Link, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Link, 'id'>>
            }
            clicks: {
                Row: Click
                Insert: Omit<Click, 'id' | 'clicked_at'>
                Update: Partial<Omit<Click, 'id'>>
            }
        }
    }
}
