#!/usr/bin/env python3
"""End-to-end demo: Trust Anchor + Mock Waldur Identity Bridge integration.

Prerequisites:
  1. Trust Anchor running: cd backend && uv run uvicorn app.main:app --port 9000
  2. Mock Waldur running: cd mock_waldur && uvicorn app:app --port 9500

Usage:
  python -m mock_waldur.demo
"""

import asyncio
import json
import sys
import time

import httpx

# Trust Anchor management API
TA_URL = "http://localhost:9000"
# Mock Waldur instance
MOCK_URL = "http://localhost:9500"


def banner(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}\n")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as http:
        # ------------------------------------------------------------------
        # Step 1: Check services are running
        # ------------------------------------------------------------------
        banner("Step 1: Checking services")
        try:
            ta_health = await http.get(f"{TA_URL}/health")
            ta_health.raise_for_status()
            print(f"  Trust Anchor: {ta_health.json()}")
        except httpx.HTTPError as exc:
            print(f"  ERROR: Trust Anchor not reachable at {TA_URL}: {exc}")
            print("  Start it with: cd backend && uv run uvicorn app.main:app --port 9000")
            sys.exit(1)

        try:
            mock_health = await http.get(f"{MOCK_URL}/health")
            mock_health.raise_for_status()
            print(f"  Mock Waldur:  {mock_health.json()}")
        except httpx.HTTPError as exc:
            print(f"  ERROR: Mock Waldur not reachable at {MOCK_URL}: {exc}")
            print("  Start it with: uvicorn mock_waldur.app:app --port 8000")
            sys.exit(1)

        # ------------------------------------------------------------------
        # Step 2: Register entity "Puhuri" in the Trust Anchor
        # ------------------------------------------------------------------
        banner("Step 2: Register entity in Trust Anchor")
        entity_data = {
            "entity_id": "https://puhuri.example.com",
            "name": "Puhuri",
            "organization": "CSC",
            "country": "FI",
            "entity_types": ["federation_entity"],
        }

        # Check if entity already exists
        existing = await http.get(f"{TA_URL}/api/entities", params={"status": "active"})
        existing_entities = existing.json().get("entities", [])
        puhuri = None
        for e in existing_entities:
            if e["entity_id"] == entity_data["entity_id"]:
                puhuri = e
                break

        if not puhuri:
            # Try to create
            resp = await http.post(f"{TA_URL}/api/entities", json=entity_data)
            if resp.status_code == 409:
                # Already exists, find it
                all_entities = await http.get(f"{TA_URL}/api/entities")
                for e in all_entities.json().get("entities", []):
                    if e["entity_id"] == entity_data["entity_id"]:
                        puhuri = e
                        break
            else:
                resp.raise_for_status()
                puhuri = resp.json()
                print(f"  Created entity: {puhuri['entity_id']} (id={puhuri['id']})")

                # Activate
                act_resp = await http.post(f"{TA_URL}/api/entities/{puhuri['id']}/activate")
                act_resp.raise_for_status()
                puhuri = act_resp.json()
                print(f"  Activated entity: status={puhuri['status']}")
        else:
            print(f"  Entity already exists: {puhuri['entity_id']} (status={puhuri['status']})")

        entity_uuid = puhuri["id"]
        entity_jwks = puhuri.get("jwks", {})
        print(f"  Entity JWKS keys: {len(entity_jwks.get('keys', []))}")

        # ------------------------------------------------------------------
        # Step 3: Create a metadata policy and attach to subordinate statement
        # ------------------------------------------------------------------
        banner("Step 3: Create metadata policy in Trust Anchor")
        policy_data = {
            "identity_bridge": {
                "email": {"essential": True},
                "first_name": {"essential": True},
                "last_name": {"essential": True},
                "affiliations": {
                    "subset_of": [
                        "member@cern.ch",
                        "employee@cern.ch",
                        "visitor@cern.ch",
                        "member@desy.de",
                        "employee@desy.de",
                    ]
                },
            }
        }

        # Create a subordinate statement with the policy
        stmt_data = {
            "subject_entity_id": puhuri["entity_id"],
            "metadata_policy": policy_data,
        }
        stmt_resp = await http.post(f"{TA_URL}/api/statements", json=stmt_data)
        stmt_resp.raise_for_status()
        statement = stmt_resp.json()
        print(f"  Created statement with metadata_policy")
        print(f"  Statement ID: {statement['id']}")
        print(f"  Policy: {json.dumps(policy_data, indent=2)}")

        # ------------------------------------------------------------------
        # Step 4: Generate a federation JWT signed with entity's key
        # ------------------------------------------------------------------
        banner("Step 4: Generate federation JWT")

        # We need to get the entity's private key to sign a JWT.
        # In a real scenario, the entity signs its own JWTs.
        # For the demo, we use the Trust Anchor's fetch endpoint to get the
        # entity config, and then craft a JWT using the entity's JWKS.
        #
        # Since we can't directly access the private key via the API,
        # we'll build the JWT by directly calling the backend's key manager.
        # This simulates what the pushing ISD would do with its own key.

        print("  Generating JWT using entity's signing key...")
        print("  (In production, each ISD signs JWTs with its own private key)")

        # Use the backend's internal API to build a JWT
        # We import here because this is a demo script
        sys.path.insert(0, "./backend")

        from app.config import get_settings as get_ta_settings
        from app.database import async_session as ta_session_factory
        from app.keys.manager import get_active_key, get_private_key_pem
        from sqlalchemy import select as sa_select
        from app.core.models.entity import Entity

        ta_settings = get_ta_settings()

        async with ta_session_factory() as ta_session:
            result = await ta_session.execute(
                sa_select(Entity).where(Entity.entity_id == puhuri["entity_id"])
            )
            db_entity = result.scalars().first()
            if not db_entity:
                print("  ERROR: Entity not found in DB")
                sys.exit(1)

            signing_key = await get_active_key(ta_session, db_entity.id)
            if not signing_key:
                print("  ERROR: No active signing key for entity")
                sys.exit(1)

            # Build a JWT
            from authlib.jose import JsonWebKey, jwt as jose_jwt

            pem = get_private_key_pem(signing_key)
            key = JsonWebKey.import_key(
                pem, {"kty": "EC" if "ES" in signing_key.algorithm else "RSA"}
            )

            now = int(time.time())
            jwt_payload = {
                "iss": puhuri["entity_id"],
                "sub": "identity-bridge-push",
                "iat": now,
                "exp": now + 300,  # 5 minutes
            }
            jwt_header = {
                "alg": signing_key.algorithm,
                "kid": signing_key.kid,
                "typ": "JWT",
            }
            federation_jwt = jose_jwt.encode(jwt_header, jwt_payload, key).decode()
            print(f"  JWT created (alg={signing_key.algorithm}, kid={signing_key.kid})")
            print(f"  Token: {federation_jwt[:80]}...")

        # ------------------------------------------------------------------
        # Step 5: Create federation entity mapping in Mock Waldur
        # ------------------------------------------------------------------
        banner("Step 5: Create federation entity mapping in Mock Waldur")
        mapping_data = {
            "entity_id": puhuri["entity_id"],
            "isd_source": "isd:puhuri",
            "trust_anchor_url": TA_URL,
        }
        map_resp = await http.post(f"{MOCK_URL}/api/federation-entities/", json=mapping_data)
        if map_resp.status_code == 409:
            print("  Mapping already exists, continuing...")
            list_resp = await http.get(f"{MOCK_URL}/api/federation-entities/")
            mappings = list_resp.json()
            for m in mappings:
                if m["entity_id"] == puhuri["entity_id"]:
                    mapping = m
                    break
        else:
            map_resp.raise_for_status()
            mapping = map_resp.json()
            print(f"  Created mapping: {mapping['entity_id']} -> {mapping['isd_source']}")

        # Force refresh to get JWKS and policy
        refresh_resp = await http.post(
            f"{MOCK_URL}/api/federation-entities/{mapping['id']}/refresh"
        )
        if refresh_resp.status_code == 200:
            print("  Refreshed JWKS and policy from Trust Anchor")
        else:
            print(f"  Refresh warning: {refresh_resp.status_code} {refresh_resp.text}")

        # ------------------------------------------------------------------
        # Step 6: Push user attributes via Identity Bridge
        # ------------------------------------------------------------------
        banner("Step 6: Push user attributes (valid)")
        push_data = {
            "username": "alice@myaccessid.org",
            "first_name": "Alice",
            "last_name": "Smith",
            "email": "alice@cern.ch",
            "organization": "CERN",
            "affiliations": ["member@cern.ch"],
        }

        push_resp = await http.post(
            f"{MOCK_URL}/api/identity-bridge/",
            json=push_data,
            headers={"Authorization": f"Bearer {federation_jwt}"},
        )
        print(f"  Status: {push_resp.status_code}")
        print(f"  Response: {json.dumps(push_resp.json(), indent=2)}")

        # ------------------------------------------------------------------
        # Step 7: View created user with attribute sources
        # ------------------------------------------------------------------
        banner("Step 7: View user identity status")
        if push_resp.status_code == 200:
            user_id = push_resp.json()["id"]
            status_resp = await http.get(f"{MOCK_URL}/api/users/{user_id}/identity-status")
            print(f"  Identity status:")
            print(f"  {json.dumps(status_resp.json(), indent=2)}")

        # ------------------------------------------------------------------
        # Step 8: Demonstrate policy violation
        # ------------------------------------------------------------------
        banner("Step 8: Demonstrate policy violation (missing required email)")
        bad_push = {
            "username": "bob@myaccessid.org",
            "first_name": "Bob",
            "last_name": "Jones",
            "email": "",  # Required by policy!
            "organization": "DESY",
        }

        bad_resp = await http.post(
            f"{MOCK_URL}/api/identity-bridge/",
            json=bad_push,
            headers={"Authorization": f"Bearer {federation_jwt}"},
        )
        print(f"  Status: {bad_resp.status_code}")
        print(f"  Response: {json.dumps(bad_resp.json(), indent=2)}")

        # ------------------------------------------------------------------
        # Step 9: Demonstrate invalid affiliation
        # ------------------------------------------------------------------
        banner("Step 9: Demonstrate policy violation (disallowed affiliation)")
        bad_affiliation_push = {
            "username": "carol@myaccessid.org",
            "first_name": "Carol",
            "last_name": "White",
            "email": "carol@kit.edu",
            "organization": "KIT",
            "affiliations": ["member@kit.edu"],  # Not in subset_of!
        }

        bad_aff_resp = await http.post(
            f"{MOCK_URL}/api/identity-bridge/",
            json=bad_affiliation_push,
            headers={"Authorization": f"Bearer {federation_jwt}"},
        )
        print(f"  Status: {bad_aff_resp.status_code}")
        print(f"  Response: {json.dumps(bad_aff_resp.json(), indent=2)}")

        # ------------------------------------------------------------------
        # Step 10: Demonstrate multi-ISD (second entity)
        # ------------------------------------------------------------------
        banner("Step 10: Multi-ISD — second entity pushes to same user")

        # Create second entity
        entity2_data = {
            "entity_id": "https://geant.example.com",
            "name": "GEANT",
            "organization": "GEANT",
            "country": "NL",
            "entity_types": ["federation_entity"],
        }

        resp2 = await http.post(f"{TA_URL}/api/entities", json=entity2_data)
        if resp2.status_code == 409:
            all_e = await http.get(f"{TA_URL}/api/entities")
            for e in all_e.json().get("entities", []):
                if e["entity_id"] == entity2_data["entity_id"]:
                    geant = e
                    break
        else:
            resp2.raise_for_status()
            geant = resp2.json()
            act2 = await http.post(f"{TA_URL}/api/entities/{geant['id']}/activate")
            act2.raise_for_status()
            geant = act2.json()

        print(f"  Second entity: {geant['entity_id']} (status={geant['status']})")

        # Create mapping for second entity
        map2_data = {
            "entity_id": geant["entity_id"],
            "isd_source": "isd:geant",
            "trust_anchor_url": TA_URL,
        }
        map2_resp = await http.post(f"{MOCK_URL}/api/federation-entities/", json=map2_data)
        if map2_resp.status_code == 409:
            print("  Second mapping already exists")
        else:
            map2_resp.raise_for_status()
            print(f"  Created second mapping: {geant['entity_id']} -> isd:geant")

        # Generate JWT for second entity
        async with ta_session_factory() as ta_session:
            result = await ta_session.execute(
                sa_select(Entity).where(Entity.entity_id == geant["entity_id"])
            )
            db_entity2 = result.scalars().first()
            signing_key2 = await get_active_key(ta_session, db_entity2.id)

            pem2 = get_private_key_pem(signing_key2)
            key2 = JsonWebKey.import_key(
                pem2, {"kty": "EC" if "ES" in signing_key2.algorithm else "RSA"}
            )

            jwt_payload2 = {
                "iss": geant["entity_id"],
                "sub": "identity-bridge-push",
                "iat": now,
                "exp": now + 300,
            }
            jwt_header2 = {
                "alg": signing_key2.algorithm,
                "kid": signing_key2.kid,
                "typ": "JWT",
            }
            federation_jwt2 = jose_jwt.encode(jwt_header2, jwt_payload2, key2).decode()

        # Refresh mapping so JWKS is cached
        list_resp2 = await http.get(f"{MOCK_URL}/api/federation-entities/")
        for m in list_resp2.json():
            if m["entity_id"] == geant["entity_id"]:
                await http.post(f"{MOCK_URL}/api/federation-entities/{m['id']}/refresh")
                break

        # Push from second ISD to the same user
        push2_data = {
            "username": "alice@myaccessid.org",  # Same user!
            "first_name": "",  # Empty — should preserve Puhuri's value
            "last_name": "",
            "email": "alice@geant.org",  # Different email from second ISD
            "organization": "GEANT",
            "country": "NL",
        }

        push2_resp = await http.post(
            f"{MOCK_URL}/api/identity-bridge/",
            json=push2_data,
            headers={"Authorization": f"Bearer {federation_jwt2}"},
        )
        print(f"  Push from GEANT: {push2_resp.status_code}")
        print(f"  Response: {json.dumps(push2_resp.json(), indent=2)}")

        # Check user now has both ISDs
        if push_resp.status_code == 200:
            user_id = push_resp.json()["id"]
            final_status = await http.get(f"{MOCK_URL}/api/users/{user_id}/identity-status")
            print(f"\n  Final identity status (multi-ISD):")
            print(f"  {json.dumps(final_status.json(), indent=2)}")

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        banner("Demo Complete")
        print("  Demonstrated:")
        print("  1. Federation JWT authentication (entity JWKS verification)")
        print("  2. Entity mapping (entity_id -> ISD source)")
        print("  3. Metadata policy enforcement (required fields, subset_of)")
        print("  4. Source-aware attribute tracking (attribute_sources)")
        print("  5. Multi-ISD support (preserve-other-sources)")
        print("  6. Policy violation rejection (missing required, disallowed values)")
        print()
        print(f"  Trust Anchor API docs: {TA_URL}/api/docs")
        print(f"  Mock Waldur API docs:  {MOCK_URL}/api/docs")


if __name__ == "__main__":
    asyncio.run(main())
