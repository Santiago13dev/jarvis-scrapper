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
  /** Ficha en directorio (Restaurant Guru, Tripadvisor…) que Maps mostraba como «sitio web». */
  listing_url: string | null;
  category: string | null;
  rating: number | null;
  reviews_count: number | null;
  lead_score: number | null;
  lead_score_summary: string | null;
  score_level: "high" | "medium" | "low" | null;
  score_reasons: ScoreReason[];
  status: LeadStatus;
  owner_user_id: string | null;
  last_contacted_at: string | null;
  contact_attempts: number;
  latitude: number | null;
  longitude: number | null;
  do_not_contact: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ScoreReason {
  description: string;
  points: number;
}

export interface ImportJob {
  id: string;
  keyword: string;
  location: string;
  max_results: number;
  extract_emails: boolean;
  status: "queued" | "running" | "done" | "failed";
  stage: "searching" | "importing" | "auditing" | null;
  found: number;
  imported: number;
  skipped: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface OutreachItem {
  lead_id: string;
  name: string;
  category: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  lead_score: number | null;
  score_level: "high" | "medium" | "low" | null;
  whatsapp: string;
  instagram: string | null;
  website: string | null;
  status: LeadStatus;
  contact_attempts: number;
  last_contacted_at: string | null;
  message: string;
  whatsapp_url: string;
}

export interface EnrichResult {
  processed: number;
  with_whatsapp: number;
  without_website: number;
  audits_queued: number;
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

export interface WorkspaceSettings {
  id: string;
  name: string;
  business_category: string | null;
  knowledge_base: string;
  whatsapp_provider: "assisted" | "cloud_api" | "openwa";
  ai_enabled: boolean;
}
