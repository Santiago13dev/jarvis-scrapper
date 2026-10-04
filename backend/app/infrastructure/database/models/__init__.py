"""
Importa todos los modelos para que Base.metadata los conozca (requerido por
Alembic --autogenerate). Cualquier modelo nuevo debe agregarse aquí.
"""
from app.infrastructure.database.base import Base
from .organization import OrganizationModel
from .workspace import WorkspaceModel
from .user import UserModel, WorkspaceMembershipModel
from .lead import (
    LeadFollowUpModel,
    LeadModel,
    LeadNoteModel,
    LeadScoringConfigModel,
    LeadSearchHistoryModel,
    LeadTaskModel,
    WebAuditModel,
)
from .campaign import CampaignModel, campaign_leads_table
from .conversation import ConversationModel, MessageModel
from .template import MessageTemplateModel, DemoPageTemplateModel

__all__ = [
    "Base",
    "OrganizationModel",
    "WorkspaceModel",
    "UserModel",
    "WorkspaceMembershipModel",
    "LeadModel",
    "LeadNoteModel",
    "LeadTaskModel",
    "LeadFollowUpModel",
    "LeadSearchHistoryModel",
    "WebAuditModel",
    "LeadScoringConfigModel",
    "CampaignModel",
    "campaign_leads_table",
    "ConversationModel",
    "MessageModel",
    "MessageTemplateModel",
    "DemoPageTemplateModel",
]
