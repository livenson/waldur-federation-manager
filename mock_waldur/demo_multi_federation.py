#!/usr/bin/env python3
"""Multi-federation demo: 2 Trust Anchors + 4 Mock Waldur instances.

Architecture:
  Federation A (Trust Anchor :9000):
    - waldur-csc   (:9501) — CSC's Waldur
    - waldur-geant (:9502) — GEANT's Waldur
    - waldur-surf  (:9504) — SURF's Waldur (also in Federation B)

  Federation B (Trust Anchor :9001):
    - waldur-desy  (:9503) — DESY's Waldur
    - waldur-surf  (:9504) — SURF's Waldur (also in Federation A)

Scenarios demonstrated:
  1. Single-federation push: CSC -> GEANT within Federation A
  2. Dual-federation entity: SURF trusts both Federation A and B
  3. Cross-federation trust: DESY (Fed B) pushes to GEANT (Fed A) via SURF bridge

Prerequisites:
  1. Trust Anchor A: cd backend && uv run uvicorn app.main:app --port 9000
  2. Trust Anchor B: (separate instance — see instructions)
  3. Mock instances: ./mock_waldur/run_instances.sh start

Usage:
  python -m mock_waldur.demo_multi_federation
"""

import asyncio
import json
import sys
import time

import httpx

# Trust Anchors
TA_A = "http://localhost:9000"  # Federation A
TA_B = "http://localhost:9001"  # Federation B

# Mock Waldur instances
WALDUR_CSC = "http://localhost:9501"
WALDUR_GEANT = "http://localhost:9502"
WALDUR_DESY = "http://localhost:9503"
WALDUR_SURF = "http://localhost:9504"


def banner(msg: str) -> None:
    print(f"\n{'='*70}")
    print(f"  {msg}")
    print(f"{'='*70}\n")


async def check_service(http: httpx.AsyncClient, url: str, name: str) -> bool:
    try:
        resp = await http.get(f"{url}/health")
        resp.raise_for_status()
        data = resp.json()
        instance = data.get("instance", data.get("service", ""))
        print(f"  {name:20s} {url:30s} OK  ({instance})")
        return True
    except httpx.HTTPError:
        print(f"  {name:20s} {url:30s} NOT RUNNING")
        return False


async def ensure_entity(
    http: httpx.AsyncClient,
    ta_url: str,
    entity_id: str,
    name: str,
    organization: str,
    country: str,
) -> dict:
    """Create and activate an entity in a Trust Anchor, or return existing."""
    # Check existing
    resp = await http.get(f"{ta_url}/api/entities")
    for e in resp.json().get("entities", []):
        if e["entity_id"] == entity_id:
            if e["status"] != "active":
                act = await http.post(f"{ta_url}/api/entities/{e['id']}/activate")
                if act.status_code == 200:
                    return act.json()
            return e

    # Create
    resp = await http.post(
        f"{ta_url}/api/entities",
        json={
            "entity_id": entity_id,
            "name": name,
            "organization": organization,
            "country": country,
            "entity_types": ["federation_entity"],
        },
    )
    if resp.status_code == 409:
        # Race condition — fetch again
        resp2 = await http.get(f"{ta_url}/api/entities")
        for e in resp2.json().get("entities", []):
            if e["entity_id"] == entity_id:
                return e
    resp.raise_for_status()
    entity = resp.json()

    # Activate
    act = await http.post(f"{ta_url}/api/entities/{entity['id']}/activate")
    act.raise_for_status()
    return act.json()


async def create_statement_with_policy(
    http: httpx.AsyncClient,
    ta_url: str,
    entity_id: str,
    policy: dict,
) -> dict:
    """Create a subordinate statement with metadata_policy."""
    resp = await http.post(
        f"{ta_url}/api/statements",
        json={"subject_entity_id": entity_id, "metadata_policy": policy},
    )
    resp.raise_for_status()
    return resp.json()


async def sign_jwt_for_entity(entity_id: str, ta_db_path: str = "./backend") -> str:
    """Sign a federation JWT using the entity's key from the Trust Anchor DB.

    In production, each entity signs with its own key. For the demo,
    we access the TA's database directly.
    """
    sys.path.insert(0, ta_db_path)
    from app.database import async_session as ta_session_factory
    from app.keys.manager import get_active_key, get_private_key_pem
    from sqlalchemy import select as sa_select
    from app.core.models.entity import Entity
    from authlib.jose import JsonWebKey, jwt as jose_jwt

    async with ta_session_factory() as session:
        result = await session.execute(
            sa_select(Entity).where(Entity.entity_id == entity_id)
        )
        db_entity = result.scalars().first()
        if not db_entity:
            raise RuntimeError(f"Entity {entity_id} not found in TA database")

        key_obj = await get_active_key(session, db_entity.id)
        if not key_obj:
            raise RuntimeError(f"No active key for {entity_id}")

        pem = get_private_key_pem(key_obj)
        key = JsonWebKey.import_key(
            pem, {"kty": "EC" if "ES" in key_obj.algorithm else "RSA"}
        )

        now = int(time.time())
        token = jose_jwt.encode(
            {"alg": key_obj.algorithm, "kid": key_obj.kid, "typ": "JWT"},
            {"iss": entity_id, "sub": "identity-bridge-push", "iat": now, "exp": now + 600},
            key,
        ).decode()

    return token


async def ensure_mapping(
    http: httpx.AsyncClient,
    waldur_url: str,
    entity_id: str,
    isd_source: str,
    ta_url: str,
) -> dict:
    """Create federation entity mapping in a mock Waldur instance."""
    resp = await http.post(
        f"{waldur_url}/api/federation-entities/",
        json={"entity_id": entity_id, "isd_source": isd_source, "trust_anchor_url": ta_url},
    )
    if resp.status_code == 409:
        list_resp = await http.get(f"{waldur_url}/api/federation-entities/")
        for m in list_resp.json():
            if m["entity_id"] == entity_id:
                return m
    else:
        resp.raise_for_status()
    mapping = resp.json()

    # Refresh to cache JWKS and policy
    await http.post(f"{waldur_url}/api/federation-entities/{mapping['id']}/refresh")
    return mapping


async def push_identity(
    http: httpx.AsyncClient,
    waldur_url: str,
    jwt_token: str,
    user_data: dict,
) -> dict:
    resp = await http.post(
        f"{waldur_url}/api/identity-bridge/",
        json=user_data,
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    return {"status": resp.status_code, "body": resp.json()}


async def main() -> None:
    async with httpx.AsyncClient(timeout=30.0) as http:
        # ------------------------------------------------------------------
        # Check services
        # ------------------------------------------------------------------
        banner("Checking services")
        services = [
            (TA_A, "Trust Anchor A"),
            (WALDUR_CSC, "waldur-csc"),
            (WALDUR_GEANT, "waldur-geant"),
        ]
        # Optional services for full demo
        optional = [
            (TA_B, "Trust Anchor B"),
            (WALDUR_DESY, "waldur-desy"),
            (WALDUR_SURF, "waldur-surf"),
        ]

        required_ok = True
        for url, name in services:
            if not await check_service(http, url, name):
                required_ok = False

        optional_ok = {}
        for url, name in optional:
            optional_ok[name] = await check_service(http, url, name)

        if not required_ok:
            print("\n  Required services not running. Start them first:")
            print("    cd backend && uv run uvicorn app.main:app --port 9000")
            print("    ./mock_waldur/run_instances.sh start")
            sys.exit(1)

        # ==================================================================
        # SCENARIO 1: Single Federation — CSC pushes to GEANT
        # ==================================================================
        banner("Scenario 1: Single Federation — CSC pushes to GEANT (Federation A)")

        # Register CSC entity in Trust Anchor A
        csc_entity = await ensure_entity(
            http, TA_A, "https://csc.example.com", "CSC", "CSC", "FI"
        )
        print(f"  CSC entity: {csc_entity['entity_id']} ({csc_entity['status']})")

        # Attach policy
        policy_a = {
            "identity_bridge": {
                "email": {"essential": True},
                "first_name": {"essential": True},
                "affiliations": {
                    "subset_of": [
                        "member@csc.fi",
                        "employee@csc.fi",
                        "member@geant.org",
                        "employee@geant.org",
                    ]
                },
            }
        }
        await create_statement_with_policy(http, TA_A, csc_entity["entity_id"], policy_a)
        print(f"  Statement with policy created")

        # Register CSC mapping in GEANT's Waldur
        await ensure_mapping(
            http, WALDUR_GEANT, csc_entity["entity_id"], "isd:csc", TA_A
        )
        print(f"  Mapping created in waldur-geant: {csc_entity['entity_id']} -> isd:csc")

        # Sign JWT as CSC and push
        csc_jwt = await sign_jwt_for_entity(csc_entity["entity_id"])
        result = await push_identity(http, WALDUR_GEANT, csc_jwt, {
            "username": "alice@myaccessid.org",
            "first_name": "Alice",
            "last_name": "Virtanen",
            "email": "alice@csc.fi",
            "organization": "CSC",
            "affiliations": ["member@csc.fi"],
        })
        print(f"  Push result: {result['status']}")
        print(f"  {json.dumps(result['body'], indent=2)}")

        # Show user
        if result["status"] == 200:
            user_id = result["body"]["id"]
            status = await http.get(f"{WALDUR_GEANT}/api/users/{user_id}/identity-status")
            print(f"\n  User identity on waldur-geant:")
            print(f"  {json.dumps(status.json(), indent=2)}")

        # ==================================================================
        # SCENARIO 2: Policy violation
        # ==================================================================
        banner("Scenario 1b: Policy violation — invalid affiliation")

        bad_result = await push_identity(http, WALDUR_GEANT, csc_jwt, {
            "username": "bob@myaccessid.org",
            "first_name": "Bob",
            "last_name": "Mäkelä",
            "email": "bob@csc.fi",
            "organization": "CSC",
            "affiliations": ["admin@unknown.org"],  # Not allowed!
        })
        print(f"  Push result: {bad_result['status']} (expected 422)")
        print(f"  {json.dumps(bad_result['body'], indent=2)}")

        # ==================================================================
        # SCENARIO 3: Dual-federation (if services available)
        # ==================================================================
        if optional_ok.get("Trust Anchor B") and optional_ok.get("waldur-surf"):
            banner("Scenario 2: Dual Federation — SURF trusts both A and B")

            # Register SURF entity in both Trust Anchors
            surf_entity_a = await ensure_entity(
                http, TA_A, "https://surf.example.com", "SURF", "SURF", "NL"
            )
            surf_entity_b = await ensure_entity(
                http, TA_B, "https://surf.example.com", "SURF", "SURF", "NL"
            )
            print(f"  SURF in Fed A: {surf_entity_a['status']}")
            print(f"  SURF in Fed B: {surf_entity_b['status']}")

            # DESY entity in Federation B
            desy_entity = await ensure_entity(
                http, TA_B, "https://desy.example.com", "DESY", "DESY", "DE"
            )
            print(f"  DESY in Fed B: {desy_entity['status']}")

            # Create policy in Federation B
            policy_b = {
                "identity_bridge": {
                    "email": {"essential": True},
                    "organization": {"essential": True},
                }
            }
            await create_statement_with_policy(http, TA_B, desy_entity["entity_id"], policy_b)

            # Map DESY in SURF's Waldur (via Federation B's Trust Anchor)
            await ensure_mapping(
                http, WALDUR_SURF, desy_entity["entity_id"], "isd:desy", TA_B
            )
            print(f"  Mapping in waldur-surf: DESY -> isd:desy (via Fed B)")

            # Map CSC in SURF's Waldur (via Federation A's Trust Anchor)
            await ensure_mapping(
                http, WALDUR_SURF, csc_entity["entity_id"], "isd:csc", TA_A
            )
            print(f"  Mapping in waldur-surf: CSC -> isd:csc (via Fed A)")

            # Push from CSC (Fed A) to SURF
            result_a = await push_identity(http, WALDUR_SURF, csc_jwt, {
                "username": "carol@myaccessid.org",
                "first_name": "Carol",
                "last_name": "de Vries",
                "email": "carol@csc.fi",
                "organization": "CSC",
            })
            print(f"\n  CSC -> SURF push: {result_a['status']}")

            # Push from DESY (Fed B) to SURF — same user, different ISD
            desy_jwt = await sign_jwt_for_entity(desy_entity["entity_id"])
            result_b = await push_identity(http, WALDUR_SURF, desy_jwt, {
                "username": "carol@myaccessid.org",
                "first_name": "",  # Preserve CSC's value
                "last_name": "",
                "email": "carol@desy.de",
                "organization": "DESY",
                "country": "DE",
            })
            print(f"  DESY -> SURF push: {result_b['status']}")

            # Show multi-ISD result on SURF
            if result_a["status"] == 200:
                user_id = result_a["body"]["id"]
                status = await http.get(f"{WALDUR_SURF}/api/users/{user_id}/identity-status")
                print(f"\n  Carol's identity on waldur-surf (multi-federation):")
                print(f"  {json.dumps(status.json(), indent=2)}")
        else:
            banner("Scenario 2: Skipped (Trust Anchor B or waldur-surf not running)")
            print("  To run the full multi-federation demo:")
            print("  1. Start a second Trust Anchor on :9001")
            print("  2. Run: ./mock_waldur/run_instances.sh start")

        # ==================================================================
        # Summary
        # ==================================================================
        banner("Demo Complete")
        print("  Scenarios demonstrated:")
        print("  1. Single-federation Identity Bridge push (CSC -> GEANT)")
        print("  2. Metadata policy enforcement (required fields, subset_of)")
        if optional_ok.get("Trust Anchor B") and optional_ok.get("waldur-surf"):
            print("  3. Dual-federation entity (SURF in Fed A + Fed B)")
            print("  4. Cross-federation multi-ISD (CSC/Fed A + DESY/Fed B -> SURF)")
        print()
        print("  API docs:")
        print(f"    Trust Anchor A: {TA_A}/api/docs")
        for url, name in [(WALDUR_CSC, "waldur-csc"), (WALDUR_GEANT, "waldur-geant")]:
            print(f"    {name:15s}: {url}/api/docs")
        if optional_ok.get("waldur-surf"):
            print(f"    {'waldur-surf':15s}: {WALDUR_SURF}/api/docs")


if __name__ == "__main__":
    asyncio.run(main())
