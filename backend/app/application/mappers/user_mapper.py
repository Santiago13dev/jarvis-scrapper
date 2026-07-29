"""
Mapper: User ↔ UserModel.
"""
from __future__ import annotations

from app.domain.entities.user import User
from app.infrastructure.database.models.user import UserModel


class UserMapper:
    @staticmethod
    def to_entity(model: UserModel) -> User:
        return User(
            id=model.id,
            organization_id=model.organization_id,
            email=model.email,
            full_name=model.full_name,
            hashed_password=model.hashed_password,
            is_active=model.is_active,
            is_superadmin=model.is_superadmin,
            created_at=model.created_at,
        )

    @staticmethod
    def to_model(entity: User) -> UserModel:
        return UserModel(
            id=entity.id,
            organization_id=entity.organization_id,
            email=entity.email,
            full_name=entity.full_name,
            hashed_password=entity.hashed_password,
            is_active=entity.is_active,
            is_superadmin=entity.is_superadmin,
            created_at=entity.created_at,
        )
