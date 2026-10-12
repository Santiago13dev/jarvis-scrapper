import hashlib
import hmac
import json

from app.infrastructure.adapters.messaging.whatsapp_cloud_adapter import parse_inbound, verify_signature


def sign(body: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_signature_is_validated_with_app_secret():
    body = b'{"entry":[]}'
    assert verify_signature(body, sign(body, "app-secret"), "app-secret")
    assert not verify_signature(body, sign(body, "otro"), "app-secret")
    assert not verify_signature(body, None, "app-secret")
    assert not verify_signature(body, sign(body, ""), "")  # sin secreto configurado se rechaza


def test_inbound_text_and_button_messages_are_parsed():
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {"from": "573001234567", "type": "text", "text": {"body": "Hola, ¿cuánto cuesta?"}},
                                {"from": "573009876543", "type": "button", "button": {"text": "No me interesa"}},
                                {"from": "573001112222", "type": "image"},
                            ]
                        }
                    }
                ]
            }
        ]
    }
    assert parse_inbound(json.loads(json.dumps(payload))) == [
        ("573001234567", "Hola, ¿cuánto cuesta?"),
        ("573009876543", "No me interesa"),
    ]


def test_status_callbacks_without_messages_are_ignored():
    assert parse_inbound({"entry": [{"changes": [{"value": {"statuses": [{"id": "wamid"}]}}]}]}) == []
