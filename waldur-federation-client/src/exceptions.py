"""Exception hierarchy for the Waldur Federation client."""

from __future__ import annotations


class FederationClientError(Exception):
    """Base exception for all federation client errors."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ConnectionError(FederationClientError):
    """Network connectivity or timeout error."""

    def __init__(self, message: str = "Failed to connect to federation server"):
        super().__init__(message)


class AuthenticationError(FederationClientError):
    """Authentication or authorization failure (401/403)."""

    def __init__(self, message: str = "Authentication failed", status_code: int = 401):
        super().__init__(message, status_code=status_code)


class NotFoundError(FederationClientError):
    """Resource not found (404)."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ValidationError(FederationClientError):
    """Request validation error (422)."""

    def __init__(self, message: str = "Validation error", details: list | None = None):
        self.details = details
        super().__init__(message, status_code=422)


class ServerError(FederationClientError):
    """Server-side error (5xx)."""

    def __init__(self, message: str = "Internal server error", status_code: int = 500):
        super().__init__(message, status_code=status_code)
