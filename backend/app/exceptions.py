"""Federation error hierarchy."""


class FederationError(Exception):
    """Base error for all federation operations."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class EntityNotFoundError(FederationError):
    def __init__(self, entity_id: str):
        super().__init__(f"Entity not found: {entity_id}", status_code=404)


class EntityNotActiveError(FederationError):
    def __init__(self, entity_id: str):
        super().__init__(f"Entity is not active: {entity_id}", status_code=409)


class KeyNotFoundError(FederationError):
    def __init__(self, kid: str):
        super().__init__(f"Signing key not found: {kid}", status_code=404)


class StatementNotFoundError(FederationError):
    def __init__(self, issuer: str, subject: str):
        super().__init__(
            f"No current statement from {issuer} about {subject}", status_code=404
        )


class TrustMarkNotFoundError(FederationError):
    def __init__(self, trust_mark_id: str):
        super().__init__(f"Trust mark not found: {trust_mark_id}", status_code=404)


class TrustChainError(FederationError):
    def __init__(self, message: str):
        super().__init__(f"Trust chain resolution failed: {message}", status_code=400)


class JWTError(FederationError):
    def __init__(self, message: str):
        super().__init__(f"JWT error: {message}", status_code=400)


class MetadataPolicyError(FederationError):
    def __init__(self, message: str):
        super().__init__(f"Metadata policy error: {message}", status_code=400)


class KeyEncryptionError(FederationError):
    def __init__(self, message: str):
        super().__init__(f"Key encryption error: {message}", status_code=500)
