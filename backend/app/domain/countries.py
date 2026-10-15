"""
Países soportados para prospección: idioma de búsqueda, prefijo telefónico, si se muestran
precios y cómo reconocer un celular (WhatsApp) a partir del número local de Google Maps.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable


@dataclass(frozen=True)
class Country:
    code: str
    name: str
    dial_code: str
    language: str  # idioma de búsqueda en Google Maps y de los mensajes
    latitude: float  # centro por defecto si no se puede geocodificar la ubicación
    longitude: float
    show_prices: bool
    national_digits: int
    is_mobile: Callable[[str], bool]
    timezone: str  # para enviar mensajes solo en horario laboral local
    cities: tuple[str, ...] = field(default_factory=tuple)

    def to_international(self, phone: str | None) -> str | None:
        """Convierte un teléfono local o internacional a E.164 (+573001234567)."""
        if not phone:
            return None
        raw = phone.strip()
        digits = re.sub(r"\D", "", raw)
        if not digits:
            return None
        if raw.startswith("+"):
            return f"+{digits}"
        if raw.startswith("00"):
            return f"+{digits[2:]}"
        if digits.startswith(self.dial_code) and len(digits) == len(self.dial_code) + self.national_digits:
            return f"+{digits}"
        if self.code == "US" and len(digits) == 11 and digits.startswith("1"):
            return f"+{digits}"
        return f"+{self.dial_code}{digits}"

    def whatsapp_number(self, phone: str | None) -> str | None:
        """Número en formato WhatsApp (solo dígitos con indicativo) o None si no parece celular."""
        international = self.to_international(phone)
        if international is None:
            return None
        digits = international[1:]
        if not digits.startswith(self.dial_code):
            return digits  # número de otro país escrito con +: se respeta
        national = digits[len(self.dial_code):]
        if len(national) != self.national_digits or not self.is_mobile(national):
            return None
        return digits


COUNTRIES: dict[str, Country] = {
    "CO": Country(
        code="CO", name="Colombia", dial_code="57", language="es", latitude=4.6534, longitude=-74.0836,
        show_prices=True, national_digits=10, is_mobile=lambda n: n.startswith("3"), timezone="America/Bogota",
        cities=("Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Santa Marta"),
    ),
    "ES": Country(
        code="ES", name="España", dial_code="34", language="es", latitude=40.4168, longitude=-3.7038,
        show_prices=False, national_digits=9, is_mobile=lambda n: n[0] in "67", timezone="Europe/Madrid",
        cities=("Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Bilbao", "Zaragoza", "Alicante"),
    ),
    "US": Country(
        code="US", name="Estados Unidos", dial_code="1", language="en", latitude=25.7617, longitude=-80.1918,
        # En EE. UU. no hay prefijo que distinga celulares: cualquier número de 10 dígitos puede tener WhatsApp
        show_prices=False, national_digits=10, is_mobile=lambda n: n[0] not in "01", timezone="America/New_York",
        cities=("Miami", "Orlando", "New York", "Houston", "Los Angeles", "Dallas", "Chicago", "Atlanta"),
    ),
}

DEFAULT_COUNTRY = "CO"


def get_country(code: str | None) -> Country:
    return COUNTRIES.get((code or DEFAULT_COUNTRY).upper(), COUNTRIES[DEFAULT_COUNTRY])
