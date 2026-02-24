# Waldur Federation Client — Integration Guide

## Overview

This package provides the interface contracts for integrating a Waldur instance
with an OpenID Federation 1.0 Trust Anchor managed by the Waldur Federation service.

## Components

### 1. Entity Configuration Builder

Your Waldur instance must publish its entity configuration at:
```
GET /.well-known/openid-federation
```

This JWT is self-signed and contains:
- `iss` / `sub`: Your instance's entity_id (URL)
- `jwks`: Your public keys
- `authority_hints`: URLs of your trust anchors
- `metadata`: OpenID Federation metadata

### 2. Trust Chain Resolver

When receiving requests from other federation entities, resolve their trust chain:

```python
resolver = YourTrustChainResolver(trust_anchor_url="https://federation.example.com")
result = await resolver.resolve(
    subject_entity_id="https://other-waldur.example.com",
    trust_anchor_entity_id="https://federation.example.com",
)
if result.is_valid:
    # Entity is trusted — process request
    resolved_metadata = result.metadata
```

### 3. Federation Auth Middleware

Add to your Django/FastAPI middleware stack to authenticate federation requests:

```python
middleware = YourFederationAuthMiddleware(
    trust_anchor_url="https://federation.example.com",
)
claims = await middleware.authenticate(request.headers["Authorization"])
```

### 4. Permission Class

Use `HasValidTrustChain` to protect API endpoints:

```python
class FederatedResourceView(APIView):
    permission_classes = [HasValidTrustChain]
```

### 5. Identity Bridge

Map between federation entity_ids and Waldur users/organizations:

```python
bridge = YourIdentityBridge()
waldur_identity = await bridge.get_waldur_identity("https://other-waldur.example.com")
entity_id = await bridge.get_entity_id(waldur_user_uuid)
```

## Registration Flow

1. Register your Waldur instance with the Trust Anchor:
   ```
   POST /api/entities/
   {
     "entity_id": "https://your-waldur.example.com",
     "name": "Your Organization",
     "entity_types": ["openid_relying_party"],
     "contacts": ["admin@your-org.example.com"]
   }
   ```

2. The Trust Anchor admin activates your entity:
   ```
   POST /api/entities/{id}/activate
   ```

3. Verify your registration:
   ```
   GET /federation/fetch?sub=https://your-waldur.example.com
   ```
   This returns the subordinate statement JWT issued by the Trust Anchor.

4. Your instance can now be discovered via:
   ```
   GET /federation/list
   ```

## Trust Chain Verification

To verify another entity in the federation:

```
GET /federation/resolve?sub=https://other-waldur.example.com
```

This returns a signed JWT containing the resolved trust chain and metadata.
