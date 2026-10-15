/**
 * Tipos TypeScript que reflejan los schemas Pydantic del backend
 * (schemas.py dentro de infrastructure/api/v1). Mantener sincronizados manualmente
 * hasta que se genere un cliente desde el OpenAPI (/api/openapi.json).
 */

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "qualified"
  | "demo_sent"
  | "won"
  | "lost";

export interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  country: string | null;
  category: string | null;
  rating: number | null;
  reviews_count: number | null;
  lead_score: number | null;
  lead_score_summary: string | null;
  score_level: string | null;
  score_reasons: { description: string; points: number }[];
  score_niche: string | null;
  status: LeadStatus;
  owner_user_id: string | null;
  do_not_contact: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  workspace_id: string;
  lead_id: string;
  status: "pending" | "due" | "completed" | "cancelled";
  next_follow_up_at: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "finished";

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  message_template_id: string;
  lead_ids: string[];
  status: CampaignStatus;
  scheduled_at: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  workspace_id: string;
  name: string;
  content: string;
  variables: string[];
}

export interface Conversation {
  id: string;
  workspace_id: string;
  lead_id: string;
  phone: string;
  is_transferred_to_human: boolean;
  messages: {
    id: string;
    direction: "inbound" | "outbound";
    sender: "lead" | "ai_agent" | "human_agent";
    text: string;
    sent_at: string;
  }[];
}

export interface DashboardSummary {
  total_leads: number;
  total_campaigns_active: number;
  total_conversations_open: number;
  total_conversations_transferred_to_human: number;
  average_lead_score: number;
  messages_sent_last_30_days: number;
  conversion_rate: number;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  business_category: string | null;
  is_active: boolean;
}

export interface Country {
  code: string;
  name: string;
  language: string;
  show_prices: boolean;
  cities: string[];
}

export interface AutopilotRule {
  id: string;
  name: string;
  country: string;
  keywords: string[];
  locations: string[];
  depth: number;
  frequency_hours: number;
  min_score: number;
  is_active: boolean;
  is_running: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_result: { new_leads: number; drafted: number; searches: number; errors: string[]; finished_at: string } | null;
  total_leads_found: number;
  created_at: string;
}

export type OutreachStatus = "pending_approval" | "approved" | "sent" | "failed" | "rejected";

export interface OutreachDraft {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_category: string | null;
  lead_country: string | null;
  lead_score: number | null;
  service: string | null;
  kind: "first_touch" | "follow_up";
  to_phone: string;
  message: string;
  status: OutreachStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface OutreachActionResult {
  affected: number;
  first_scheduled_for: string | null;
  last_scheduled_for: string | null;
}

export interface DashboardOverview {
  total_leads: number;
  high_opportunity: number;
  new_last_7_days: number;
  with_whatsapp: number;
  pending_approvals: number;
  scheduled_messages: number;
  sent_today: number;
  daily_send_limit: number;
  sent_last_30_days: number;
  replied: number;
  won: number;
  pipeline: Record<string, number>;
  by_service: Record<string, number>;
  by_country: Record<string, number>;
  leads_per_day: { date: string; count: number }[];
  top_opportunities: { id: string; name: string; category: string | null; country: string | null; score: number; service: string | null; has_whatsapp: boolean }[];
  autopilot: { active_rules: number; running_rules: number; next_run_at: string | null };
  activity: { kind: "found" | "drafted" | "sent" | "replied"; at: string; count: number; detail: string | null; country: string | null }[];
  last_14_days: { leads: number; drafted: number; sent: number; replies: number };
}
