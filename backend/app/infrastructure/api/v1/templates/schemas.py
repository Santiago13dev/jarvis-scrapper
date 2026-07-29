from __future__ import annotations

from pydantic import BaseModel


class MessageTemplateResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    content: str
    variables: list[str]


class CreateMessageTemplateBody(BaseModel):
    name: str
    content: str
    variables: list[str] = []


class DemoPageTemplateResponse(BaseModel):
    id: str
    business_category: str
    name: str
    html_template_path: str
    preview_image_url: str | None
