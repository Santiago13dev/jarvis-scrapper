/**
 * Tipos TypeScript que reflejan los schemas Pydantic del backend
 * (infrastructure/api/v1/*/schemas.py). Mantener sincronizados manualmente
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
  category: string | null;
  rating: number | null;
  reviews_count: number | null;
  lead_score: number | null;
  lead_score_summary: string | null;
  status: LeadStatus;
  owner_user_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
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
