"""
Value Object: LeadScore.

Encapsula la regla de negocio "el score va de 0 a 100" en el propio dominio, en vez de
confiar en que quien lo asigna (la IA) respete el rango.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LeadScore:
    value: int
    summary: str
    detected_gaps: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not 0 <= self.value <= 100:
            raise ValueError(f"LeadScore debe estar entre 0 y 100, recibido: {self.value}")

    @property
    def is_high_priority(self) -> bool:
        return self.value >= 70

    @property
    def is_low_priority(self) -> bool:
        return self.value < 30
