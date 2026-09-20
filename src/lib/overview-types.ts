export type TrafficMode = "non_bot" | "all" | "bots";

export type OverviewLink = {
  id: string;
  code: string;
  title: string | null;
  destination_url: string;
  group_id: string | null;
  is_active: boolean;
  clicks: number;
  previous_clicks: number;
  leading_source: string | null;
  latest_click: string | null;
};

export type OverviewSource = {
  source: string;
  provenance: string;
  clicks: number;
  previous_clicks: number;
  leading_link_code: string | null;
};

export type OverviewReport = {
  summary: {
    clicks: number;
    previous_clicks: number;
    total_links: number;
    links_with_clicks: number;
    source_count: number;
    unknown_clicks: number;
    range_start: string;
    range_end: string;
    previous_range_start: string;
    previous_range_end: string;
    is_partial: boolean;
    traffic: TrafficMode;
  };
  links: OverviewLink[];
  sources: OverviewSource[];
  daily: { date: string; clicks: number }[];
};

export type OverviewResponse = {
  report: OverviewReport;
  asOf: string;
  refreshedAt: string;
};
