/**
 * Mock data for development without a backend.
 * All data models match the types in api/types.ts.
 *
 * Topology — cross-federation trust via a common Trust Anchor:
 *
 *                     EuroHPC JU Trust Anchor
 *                     /                      \
 *          EUDAT CDI Federation        EOSC EU Federation
 *         /    |      |    \          /      |         \
 *      LUMI  CSCS   BSC   DESY    CINECA  CEA/TGCC  JSC Jülich
 *
 * Trust between LUMI (EUDAT member) and CINECA (EOSC member) is
 * established because both resolve up to the same Trust Anchor.
 */

import type {
  Entity,
  SubordinateStatement,
  MetadataPolicy,
  TrustMarkDefinition,
  TrustMark,
  DashboardStats,
  ExpiringItems,
  WaldurInstance,
  TopologyResponse,
  ScenarioMeta,
  ScenarioRunResponse,
} from './types';

// Helper to simulate API delay
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const mockEntities: Entity[] = [
  // ── Trust Anchor ────────────────────────────────────────────────────────
  {
    id: 'ent-eurohpc',
    entity_id: 'https://federation.eurohpc-ju.europa.eu',
    name: 'EuroHPC JU',
    organization: 'European High Performance Computing Joint Undertaking',
    country: 'EU',
    entity_types: ['federation_entity'],
    metadata: {
      homepage: 'https://eurohpc-ju.europa.eu',
      description:
        'EuroHPC Joint Undertaking — top-level Trust Anchor for European HPC and research federations.',
      federation_fetch_endpoint:
        'https://federation.eurohpc-ju.europa.eu/federation/fetch',
      federation_list_endpoint:
        'https://federation.eurohpc-ju.europa.eu/federation/list',
      federation_resolve_endpoint:
        'https://federation.eurohpc-ju.europa.eu/federation/resolve',
      federation_entity: {
        contacts: ['trust-admin@eurohpc-ju.europa.eu'],
        organization_name: 'European High Performance Computing Joint Undertaking',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'eurohpc-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'Ag3ixJ2P8SoVH-7kMGfFpGr6C_yTg-ARbPNvsBazzfo',
          y: 'ZL6mGRMHS0vW8K7BUQX6Fl3MNhMpg4_dONsKP-JBYUg',
        },
      ],
    },
    status: 'active',
    authority_hints: [],
    contacts: ['trust-admin@eurohpc-ju.europa.eu'],
    statement_expires_seconds: 2592000, // 30 days
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2025-02-01T08:00:00Z',
  },

  // ── Intermediate Authority — EUDAT ──────────────────────────────────────
  {
    id: 'ent-ta',
    entity_id: 'https://federation.eudat.eu',
    name: 'EUDAT CDI Federation',
    organization: 'EUDAT CDI',
    country: 'EU',
    entity_types: ['federation_entity'],
    metadata: {
      homepage: 'https://www.eudat.eu',
      description:
        'EUDAT Collaborative Data Infrastructure — intermediate authority for the European research data federation.',
      federation_fetch_endpoint:
        'https://federation.eudat.eu/federation/fetch',
      federation_list_endpoint:
        'https://federation.eudat.eu/federation/list',
      federation_resolve_endpoint:
        'https://federation.eudat.eu/federation/resolve',
      federation_entity: {
        contacts: ['federation-admin@eudat.eu'],
        organization_name: 'EUDAT CDI',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'eudat-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'weNJy2HscCSM6AEDTDg04biOvhFhyyWvOHQfeF_PxMQ',
          y: 'e8lnCO-AlStT-DBER57_vilrLYyKS1T_Ct95KJ7GD2g',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eurohpc-ju.europa.eu'],
    contacts: ['federation-admin@eudat.eu'],
    statement_expires_seconds: 604800, // 7 days
    created_at: '2024-12-01T00:00:00Z',
    updated_at: '2025-02-18T08:00:00Z',
  },

  // ── Intermediate Authority — EOSC ───────────────────────────────────────
  {
    id: 'ent-eosc',
    entity_id: 'https://federation.eosc.eu',
    name: 'EOSC EU Federation',
    organization: 'European Open Science Cloud',
    country: 'EU',
    entity_types: ['federation_entity'],
    metadata: {
      homepage: 'https://eosc.eu',
      description:
        'EOSC European Open Science Cloud — intermediate authority for open science service providers across Europe.',
      federation_fetch_endpoint:
        'https://federation.eosc.eu/federation/fetch',
      federation_list_endpoint:
        'https://federation.eosc.eu/federation/list',
      federation_resolve_endpoint:
        'https://federation.eosc.eu/federation/resolve',
      federation_entity: {
        contacts: ['federation@eosc.eu', 'security@eosc.eu'],
        organization_name: 'European Open Science Cloud',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'eosc-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'Q9Rv3biLRFk-sCrP-8HP1DGLucxf1ZiVR9TWOj9Xk7s',
          y: 'y8sSHMkZjNzBx2bLG7dM5kUoVj36HfMN8bpaMqfLn58',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eurohpc-ju.europa.eu'],
    contacts: ['federation@eosc.eu', 'security@eosc.eu'],
    statement_expires_seconds: 604800,
    created_at: '2024-11-15T00:00:00Z',
    updated_at: '2025-02-17T14:00:00Z',
  },

  // ── EUDAT member entities ───────────────────────────────────────────────

  {
    id: 'ent-001',
    entity_id: 'https://federation.lumi.csc.fi',
    name: 'LUMI Supercomputer',
    organization: 'CSC - IT Center for Science',
    country: 'FI',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.lumi-supercomputer.eu',
      description:
        'LUMI is one of the EuroHPC pre-exascale supercomputers, hosted in Kajaani, Finland.',
      gpu_nodes: 2978,
      peak_performance_pflops: 550,
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email', 'eduperson'],
        id_token_signing_alg_values_supported: ['ES256'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
      federation_entity: {
        contacts: ['lumi-admin@csc.fi', 'federation-ops@csc.fi'],
        organization_name: 'CSC - IT Center for Science',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'lumi-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU',
          y: 'x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eudat.eu'],
    contacts: ['lumi-admin@csc.fi', 'federation-ops@csc.fi'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-02-18T12:30:00Z',
  },
  {
    id: 'ent-002',
    entity_id: 'https://federation.cscs.ch',
    name: 'CSCS Swiss National Supercomputing Centre',
    organization: 'CSCS / ETH Zurich',
    country: 'CH',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.cscs.ch',
      description:
        'CSCS operates the Swiss national supercomputing infrastructure in Lugano, Switzerland.',
      flagship_system: 'Alps',
      peak_performance_pflops: 600,
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email'],
        id_token_signing_alg_values_supported: ['ES256', 'RS256'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
      federation_entity: {
        contacts: ['help@cscs.ch'],
        organization_name: 'CSCS / ETH Zurich',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'cscs-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'iGaLqP6y-SJCCBq8Yg2ArGBdf1oBPKsJ2gVJBL3viNA',
          y: 'GHncWOJfrmB8-ft7UF5dfkDRkfB03lB9H2jYgUhIKNY',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eudat.eu'],
    contacts: ['help@cscs.ch'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-12T10:00:00Z',
    updated_at: '2025-02-17T09:15:00Z',
  },
  {
    id: 'ent-003',
    entity_id: 'https://federation.bsc.es',
    name: 'Barcelona Supercomputing Center',
    organization: 'BSC-CNS',
    country: 'ES',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.bsc.es',
      description:
        'BSC-CNS hosts MareNostrum and leads HPC research in Spain and across Europe.',
      flagship_system: 'MareNostrum 5',
      peak_performance_pflops: 314,
      openid_provider: {
        scopes_supported: ['openid', 'profile'],
        id_token_signing_alg_values_supported: ['ES256'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
      federation_entity: {
        contacts: ['support@bsc.es', 'federation@bsc.es'],
        organization_name: 'BSC-CNS',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'bsc-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'WbbaSStuffecKQV5U2LsG0zMAVp36nIx2VmIPg_X09Y',
          y: 'bqXvyFpKf7PdN5JuHsR1YZjRRVFiqUpTAeeNLGma3Oc',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eudat.eu'],
    contacts: ['support@bsc.es', 'federation@bsc.es'],
    statement_expires_seconds: 172800,
    created_at: '2025-01-15T11:00:00Z',
    updated_at: '2025-02-19T14:45:00Z',
  },
  {
    id: 'ent-004',
    entity_id: 'https://federation.desy.de',
    name: 'DESY IT Infrastructure',
    organization: 'Deutsches Elektronen-Synchrotron DESY',
    country: 'DE',
    entity_types: ['openid_provider'],
    metadata: {
      homepage: 'https://www.desy.de',
      description:
        'DESY operates large-scale research infrastructure for photon science and particle physics in Hamburg and Zeuthen.',
      research_areas: [
        'photon_science',
        'particle_physics',
        'astroparticle_physics',
      ],
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email'],
        id_token_signing_alg_values_supported: ['ES256', 'RS384'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'desy-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'kSq-FZdHxU_v6-WUokJtXp2Rp7bLGtTbGdT4BjXkWeI',
          y: 'T5euLbq_PXf2PmPBXpH5VNzGkFaZrYjHsTxKrCBQl7I',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eudat.eu'],
    contacts: ['it-helpdesk@desy.de'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-20T09:30:00Z',
    updated_at: '2025-02-15T16:00:00Z',
  },

  // ── EOSC member entities ────────────────────────────────────────────────

  {
    id: 'ent-cineca',
    entity_id: 'https://federation.cineca.it',
    name: 'CINECA',
    organization: 'CINECA Interuniversity Consortium',
    country: 'IT',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.cineca.it',
      description:
        'CINECA is the largest Italian computing centre, hosting the Leonardo EuroHPC pre-exascale system.',
      flagship_system: 'Leonardo',
      peak_performance_pflops: 250,
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email'],
        id_token_signing_alg_values_supported: ['ES256'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      },
      federation_entity: {
        contacts: ['hpc-support@cineca.it', 'federation@cineca.it'],
        organization_name: 'CINECA Interuniversity Consortium',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'cineca-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'FpV_4IiJH2dLrmZ7b6rYDeXuhk2JKGmkLyBz0f5TeDQ',
          y: 'YSr4_EaGnVaO4P_jEWuQFMCC8e7GuUNVCXnw-HKGHCU',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eosc.eu'],
    contacts: ['hpc-support@cineca.it', 'federation@cineca.it'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-08T09:00:00Z',
    updated_at: '2025-02-19T10:00:00Z',
  },
  {
    id: 'ent-cea',
    entity_id: 'https://federation.tgcc.cea.fr',
    name: 'CEA/TGCC',
    organization: 'Commissariat à l\'énergie atomique - TGCC',
    country: 'FR',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www-hpc.cea.fr/en/TGCC.html',
      description:
        'TGCC (Très Grand Centre de Calcul) is the French national computing centre operated by CEA, hosting Joliot-Curie.',
      flagship_system: 'Joliot-Curie',
      peak_performance_pflops: 22,
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email'],
        id_token_signing_alg_values_supported: ['ES256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      },
      federation_entity: {
        contacts: ['support-tgcc@cea.fr'],
        organization_name: 'CEA - TGCC',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'cea-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'VjCi_3qQPvg1-tfPqP8dX8_bDrjDBFMFx_H0bqdI5BY',
          y: '5wJa_2d_BwFMTkdN3MFAa_G4Ceyb4T0J5V3JHQL-Bwk',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eosc.eu'],
    contacts: ['support-tgcc@cea.fr'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-14T11:00:00Z',
    updated_at: '2025-02-18T09:30:00Z',
  },
  {
    id: 'ent-jsc',
    entity_id: 'https://federation.fz-juelich.de',
    name: 'JSC Jülich Supercomputing Centre',
    organization: 'Forschungszentrum Jülich',
    country: 'DE',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.fz-juelich.de/jsc',
      description:
        'JSC is one of the three national supercomputing centres in Germany, hosting JUWELS and JUPITER.',
      flagship_system: 'JUPITER',
      peak_performance_pflops: 1000,
      openid_provider: {
        scopes_supported: ['openid', 'profile', 'email', 'eduperson'],
        id_token_signing_alg_values_supported: ['ES256', 'ES384'],
        token_endpoint_auth_methods_supported: ['private_key_jwt', 'self_signed_tls_client_auth'],
      },
      federation_entity: {
        contacts: ['sc@fz-juelich.de', 'federation@fz-juelich.de'],
        organization_name: 'Forschungszentrum Jülich',
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'jsc-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'UmmHnOAi0kM-oLDsrr80vKQ_R4_R_3e3gRkxoJXVHN4',
          y: 'KimfG3p4-v0vFPGDvSZXJvxQWJDGLNBd6LPh-MxSKz8',
        },
      ],
    },
    status: 'active',
    authority_hints: ['https://federation.eosc.eu'],
    contacts: ['sc@fz-juelich.de', 'federation@fz-juelich.de'],
    statement_expires_seconds: 172800,
    created_at: '2025-01-11T08:00:00Z',
    updated_at: '2025-02-20T07:00:00Z',
  },

  // ── Draft & revoked entities ────────────────────────────────────────────

  {
    id: 'ent-005',
    entity_id: 'https://federation.mpcdf.mpg.de',
    name: 'Max Planck Computing and Data Facility',
    organization: 'Max Planck Society',
    country: 'DE',
    entity_types: ['openid_provider', 'federation_entity'],
    metadata: {
      homepage: 'https://www.mpcdf.mpg.de',
      description:
        'MPCDF provides computing, data management, and IT services for the Max Planck Society institutes.',
      flagship_system: 'Raven / Cobra',
      research_focus: 'fundamental_research',
      federation_entity: {
        contacts: ['helpdesk@mpcdf.mpg.de'],
      },
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'mpcdf-sig-2025',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: '4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM',
          y: 'BIGzmjU0t_DqHGFSEZgUmg8HSQVuUdY4HZ0Cqm6TEAM',
        },
      ],
    },
    status: 'draft',
    authority_hints: [],
    contacts: ['helpdesk@mpcdf.mpg.de'],
    statement_expires_seconds: null,
    created_at: '2025-02-01T13:00:00Z',
    updated_at: '2025-02-10T10:20:00Z',
  },
  {
    id: 'ent-006',
    entity_id: 'https://federation.surfsara.nl',
    name: 'SURF Research Infrastructure',
    organization: 'SURF',
    country: 'NL',
    entity_types: ['openid_provider'],
    metadata: {
      homepage: 'https://www.surf.nl',
      description:
        'SURF provides ICT infrastructure and services to Dutch education and research institutions. Formerly SURFsara.',
      flagship_system: 'Snellius',
    },
    jwks: {
      keys: [
        {
          kty: 'EC',
          kid: 'surf-sig-2024',
          alg: 'ES256',
          use: 'sig',
          crv: 'P-256',
          x: 'SVqB4JcUD6lsfvqMr-OKUNUphdNn64Eay60978ZlL74',
          y: 'lf0u0pMj4lGAzZix5u4Cm5CMQIgMNpkwy163wtKYVKI',
        },
      ],
    },
    status: 'revoked',
    authority_hints: ['https://federation.eudat.eu'],
    contacts: ['helpdesk@surf.nl'],
    statement_expires_seconds: 86400,
    created_at: '2025-01-05T07:00:00Z',
    updated_at: '2025-02-20T11:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Subordinate Statements
// ---------------------------------------------------------------------------

const now = new Date();
const oneDayMs = 86400 * 1000;

function isoDate(offset: number): string {
  return new Date(now.getTime() + offset).toISOString();
}

export const mockStatements: SubordinateStatement[] = [
  // ── Trust Anchor → Intermediate Authorities ─────────────────────────────

  {
    id: 'stmt-ta-eudat',
    issuer_entity_id: 'https://federation.eurohpc-ju.europa.eu',
    subject_entity_id: 'https://federation.eudat.eu',
    metadata_override: { organization_name: 'EUDAT CDI' },
    metadata_policy: {
      federation_entity: {
        contacts: { essential: true },
        organization_name: { essential: true },
      },
    },
    constraints: { max_path_length: 2 },
    trust_marks: [],
    issued_at: isoDate(-5 * oneDayMs),
    expires_at: isoDate(25 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1cm9ocGMtc2lnLTIwMjUifQ.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVyb2hwYy1qdS5ldXJvcGEuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUifQ.mock_sig_eurohpc_eudat',
    is_current: true,
  },
  {
    id: 'stmt-ta-eosc',
    issuer_entity_id: 'https://federation.eurohpc-ju.europa.eu',
    subject_entity_id: 'https://federation.eosc.eu',
    metadata_override: { organization_name: 'European Open Science Cloud' },
    metadata_policy: {
      federation_entity: {
        contacts: { essential: true },
        organization_name: { essential: true },
      },
    },
    constraints: { max_path_length: 2 },
    trust_marks: [],
    issued_at: isoDate(-4 * oneDayMs),
    expires_at: isoDate(26 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1cm9ocGMtc2lnLTIwMjUifQ.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVyb2hwYy1qdS5ldXJvcGEuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uZW9zYy5ldSJ9.mock_sig_eurohpc_eosc',
    is_current: true,
  },

  // ── EUDAT → leaf entities ───────────────────────────────────────────────

  {
    id: 'stmt-001',
    issuer_entity_id: 'https://federation.eudat.eu',
    subject_entity_id: 'https://federation.lumi.csc.fi',
    metadata_override: { organization_name: 'CSC - IT Center for Science' },
    metadata_policy: {
      openid_provider: {
        contacts: { add: ['federation-ops@csc.fi'] },
      },
    },
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-2 * oneDayMs),
    expires_at: isoDate(5 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1ZGF0LXNpZy0yMDI1In0.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24ubHVtaS5jc2MuZmkifQ.mock_signature_lumi',
    is_current: true,
  },
  {
    id: 'stmt-002',
    issuer_entity_id: 'https://federation.eudat.eu',
    subject_entity_id: 'https://federation.cscs.ch',
    metadata_override: { organization_name: 'CSCS / ETH Zurich' },
    metadata_policy: {},
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-3 * oneDayMs),
    expires_at: isoDate(4 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1ZGF0LXNpZy0yMDI1In0.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uY3Njcy5jaCJ9.mock_signature_cscs',
    is_current: true,
  },
  {
    id: 'stmt-003',
    issuer_entity_id: 'https://federation.eudat.eu',
    subject_entity_id: 'https://federation.bsc.es',
    metadata_override: {},
    metadata_policy: {
      openid_provider: {
        contacts: { add: ['federation@bsc.es'] },
      },
    },
    constraints: {},
    trust_marks: [],
    issued_at: isoDate(-1 * oneDayMs),
    expires_at: isoDate(13 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1ZGF0LXNpZy0yMDI1In0.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uYnNjLmVzIn0.mock_signature_bsc',
    is_current: true,
  },
  {
    id: 'stmt-004',
    issuer_entity_id: 'https://federation.eudat.eu',
    subject_entity_id: 'https://federation.desy.de',
    metadata_override: { organization_name: 'DESY' },
    metadata_policy: {},
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-5 * oneDayMs),
    expires_at: isoDate(2 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1ZGF0LXNpZy0yMDI1In0.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uZGVzeS5kZSJ9.mock_signature_desy',
    is_current: true,
  },
  {
    id: 'stmt-005',
    issuer_entity_id: 'https://federation.eudat.eu',
    subject_entity_id: 'https://federation.surfsara.nl',
    metadata_override: {},
    metadata_policy: {},
    constraints: {},
    trust_marks: [],
    issued_at: isoDate(-30 * oneDayMs),
    expires_at: isoDate(-2 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImV1ZGF0LXNpZy0yMDI1In0.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZXVkYXQuZXUiLCJzdWIiOiJodHRwczovL2ZlZGVyYXRpb24uc3VyZnNhcmEubmwifQ.mock_signature_surf',
    is_current: false,
  },

  // ── EOSC → leaf entities ────────────────────────────────────────────────

  {
    id: 'stmt-eosc-cineca',
    issuer_entity_id: 'https://federation.eosc.eu',
    subject_entity_id: 'https://federation.cineca.it',
    metadata_override: { organization_name: 'CINECA Interuniversity Consortium' },
    metadata_policy: {
      openid_provider: {
        contacts: { essential: true },
      },
    },
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-3 * oneDayMs),
    expires_at: isoDate(11 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImVvc2Mtc2lnLTIwMjUifQ.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZW9zYy5ldSIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5jaW5lY2EuaXQifQ.mock_sig_eosc_cineca',
    is_current: true,
  },
  {
    id: 'stmt-eosc-cea',
    issuer_entity_id: 'https://federation.eosc.eu',
    subject_entity_id: 'https://federation.tgcc.cea.fr',
    metadata_override: { organization_name: 'CEA - TGCC' },
    metadata_policy: {},
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-2 * oneDayMs),
    expires_at: isoDate(12 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImVvc2Mtc2lnLTIwMjUifQ.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZW9zYy5ldSIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi50Z2NjLmNlYS5mciJ9.mock_sig_eosc_cea',
    is_current: true,
  },
  {
    id: 'stmt-eosc-jsc',
    issuer_entity_id: 'https://federation.eosc.eu',
    subject_entity_id: 'https://federation.fz-juelich.de',
    metadata_override: { organization_name: 'Forschungszentrum Jülich' },
    metadata_policy: {
      openid_provider: {
        contacts: { add: ['federation@fz-juelich.de'] },
      },
    },
    constraints: { max_path_length: 0 },
    trust_marks: [],
    issued_at: isoDate(-1 * oneDayMs),
    expires_at: isoDate(6 * oneDayMs),
    jwt: 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImVvc2Mtc2lnLTIwMjUifQ.eyJpc3MiOiJodHRwczovL2ZlZGVyYXRpb24uZW9zYy5ldSIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5mei1qdWVsaWNoLmRlIn0.mock_sig_eosc_jsc',
    is_current: true,
  },
];

// ---------------------------------------------------------------------------
// Metadata Policies
// ---------------------------------------------------------------------------

export const mockPolicies: MetadataPolicy[] = [
  {
    id: 'pol-001',
    name: 'EuroHPC OpenID Provider Baseline',
    description:
      'Baseline metadata policy for all OpenID Providers joining the EuroHPC federation. Enforces required scopes and signing algorithms.',
    entity_type: 'openid_provider',
    policy: {
      id_token_signing_alg_values_supported: {
        subset_of: ['ES256', 'ES384', 'RS256'],
        default: ['ES256'],
      },
      scopes_supported: {
        superset_of: ['openid', 'profile', 'email'],
      },
      token_endpoint_auth_methods_supported: {
        subset_of: ['private_key_jwt', 'self_signed_tls_client_auth'],
      },
    },
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-02-01T14:00:00Z',
  },
  {
    id: 'pol-002',
    name: 'Federation Entity Contacts',
    description:
      'Policy requiring all federation entities to publish at least one administrative contact.',
    entity_type: 'federation_entity',
    policy: {
      contacts: {
        essential: true,
      },
      organization_name: {
        essential: true,
      },
    },
    created_at: '2025-01-12T09:30:00Z',
    updated_at: '2025-01-12T09:30:00Z',
  },
  {
    id: 'pol-003',
    name: 'GEANT Relying Party Policy',
    description:
      'Metadata policy for relying parties within the GEANT academic federation trust chain.',
    entity_type: 'openid_relying_party',
    policy: {
      grant_types_supported: {
        subset_of: ['authorization_code', 'refresh_token'],
      },
      response_types_supported: {
        subset_of: ['code'],
      },
      token_endpoint_auth_method: {
        one_of: ['private_key_jwt'],
      },
    },
    created_at: '2025-01-20T10:00:00Z',
    updated_at: '2025-02-05T11:45:00Z',
  },
];

// ---------------------------------------------------------------------------
// Trust Mark Definitions
// ---------------------------------------------------------------------------

export const mockTrustMarkDefinitions: TrustMarkDefinition[] = [
  {
    id: 'tmdef-001',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    name: 'EuroHPC JU Member',
    description:
      'Issued to entities that are verified members of the EuroHPC Joint Undertaking. Recognised across all EuroHPC federations.',
    ref: 'https://eurohpc-ju.europa.eu/about/members',
    logo_uri: 'https://federation.eurohpc-ju.europa.eu/logos/eurohpc-member.svg',
    allowed_issuer_ids: ['https://federation.eurohpc-ju.europa.eu'],
    created_at: '2024-06-15T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'tmdef-002',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/geant-verified',
    name: 'GEANT Verified Infrastructure',
    description:
      'Indicates that the entity has been verified as part of the GEANT academic network infrastructure.',
    ref: 'https://geant.org/services/trust-and-identity',
    logo_uri: 'https://federation.eurohpc-ju.europa.eu/logos/geant-verified.svg',
    allowed_issuer_ids: [
      'https://federation.eurohpc-ju.europa.eu',
      'https://trust.geant.org',
    ],
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: 'tmdef-003',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/prace-partner',
    name: 'PRACE Partner Site',
    description:
      'Issued to hosting sites that participate in the PRACE (Partnership for Advanced Computing in Europe) programme.',
    ref: 'https://prace-ri.eu/hpc-access/hosting-sites/',
    logo_uri: null,
    allowed_issuer_ids: ['https://federation.eurohpc-ju.europa.eu'],
    created_at: '2025-01-20T12:00:00Z',
    updated_at: '2025-02-10T08:00:00Z',
  },
  {
    id: 'tmdef-004',
    trust_mark_id: 'https://federation.eosc.eu/trust-marks/eosc-onboarded',
    name: 'EOSC Onboarded Provider',
    description:
      'Marks entities that have completed the EOSC onboarding process and are listed in the EOSC Marketplace catalogue.',
    ref: 'https://marketplace.eosc-portal.eu',
    logo_uri: null,
    allowed_issuer_ids: ['https://federation.eosc.eu'],
    created_at: '2025-01-05T10:00:00Z',
    updated_at: '2025-02-01T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Trust Marks (issued)
// ---------------------------------------------------------------------------

export const mockTrustMarks: TrustMark[] = [
  // ── EuroHPC Member — spans both federations ─────────────────────────────
  {
    id: 'tm-001',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.lumi.csc.fi',
    issued_at: '2025-01-15T10:00:00Z',
    expires_at: '2026-01-15T10:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5sdW1pLmNzYy5maSJ9.mock_tm_lumi_eurohpc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-002',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.cscs.ch',
    issued_at: '2025-01-15T10:00:00Z',
    expires_at: '2026-01-15T10:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5jc2NzLmNoIn0.mock_tm_cscs_eurohpc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-003',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.bsc.es',
    issued_at: '2025-01-20T08:00:00Z',
    expires_at: '2026-01-20T08:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ic2MuZXMifQ.mock_tm_bsc_eurohpc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-008',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.cineca.it',
    issued_at: '2025-01-12T10:00:00Z',
    expires_at: '2026-01-12T10:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5jaW5lY2EuaXQifQ.mock_tm_cineca_eurohpc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-009',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.fz-juelich.de',
    issued_at: '2025-01-14T08:00:00Z',
    expires_at: '2026-01-14T08:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5mei1qdWVsaWNoLmRlIn0.mock_tm_jsc_eurohpc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },

  // ── GEANT Verified ──────────────────────────────────────────────────────
  {
    id: 'tm-004',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/geant-verified',
    subject_entity_id: 'https://federation.lumi.csc.fi',
    issued_at: '2025-01-18T12:00:00Z',
    expires_at: '2026-01-18T12:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9nZWFudC12ZXJpZmllZCIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5sdW1pLmNzYy5maSJ9.mock_tm_lumi_geant',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-005',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/geant-verified',
    subject_entity_id: 'https://federation.desy.de',
    issued_at: '2025-01-22T09:00:00Z',
    expires_at: '2026-01-22T09:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9nZWFudC12ZXJpZmllZCIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5kZXN5LmRlIn0.mock_tm_desy_geant',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-010',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/geant-verified',
    subject_entity_id: 'https://federation.cineca.it',
    issued_at: '2025-01-20T09:00:00Z',
    expires_at: '2026-01-20T09:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9nZWFudC12ZXJpZmllZCIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5jaW5lY2EuaXQifQ.mock_tm_cineca_geant',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },

  // ── PRACE Partner ───────────────────────────────────────────────────────
  {
    id: 'tm-006',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/prace-partner',
    subject_entity_id: 'https://federation.bsc.es',
    issued_at: '2025-01-25T14:00:00Z',
    expires_at: null,
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9wcmFjZS1wYXJ0bmVyIiwic3ViIjoiaHR0cHM6Ly9mZWRlcmF0aW9uLmJzYy5lcyJ9.mock_tm_bsc_prace',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-011',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/prace-partner',
    subject_entity_id: 'https://federation.fz-juelich.de',
    issued_at: '2025-01-26T10:00:00Z',
    expires_at: null,
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9wcmFjZS1wYXJ0bmVyIiwic3ViIjoiaHR0cHM6Ly9mZWRlcmF0aW9uLmZ6LWp1ZWxpY2guZGUifQ.mock_tm_jsc_prace',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },

  // ── EOSC Onboarded ──────────────────────────────────────────────────────
  {
    id: 'tm-012',
    trust_mark_id: 'https://federation.eosc.eu/trust-marks/eosc-onboarded',
    subject_entity_id: 'https://federation.cineca.it',
    issued_at: '2025-01-10T10:00:00Z',
    expires_at: '2026-01-10T10:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5lb3NjLmV1L3RydXN0LW1hcmtzL2Vvc2Mtb25ib2FyZGVkIiwic3ViIjoiaHR0cHM6Ly9mZWRlcmF0aW9uLmNpbmVjYS5pdCJ9.mock_tm_cineca_eosc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-013',
    trust_mark_id: 'https://federation.eosc.eu/trust-marks/eosc-onboarded',
    subject_entity_id: 'https://federation.tgcc.cea.fr',
    issued_at: '2025-01-16T11:00:00Z',
    expires_at: '2026-01-16T11:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5lb3NjLmV1L3RydXN0LW1hcmtzL2Vvc2Mtb25ib2FyZGVkIiwic3ViIjoiaHR0cHM6Ly9mZWRlcmF0aW9uLnRnY2MuY2VhLmZyIn0.mock_tm_cea_eosc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },
  {
    id: 'tm-014',
    trust_mark_id: 'https://federation.eosc.eu/trust-marks/eosc-onboarded',
    subject_entity_id: 'https://federation.fz-juelich.de',
    issued_at: '2025-01-13T09:00:00Z',
    expires_at: '2026-01-13T09:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5lb3NjLmV1L3RydXN0LW1hcmtzL2Vvc2Mtb25ib2FyZGVkIiwic3ViIjoiaHR0cHM6Ly9mZWRlcmF0aW9uLmZ6LWp1ZWxpY2guZGUifQ.mock_tm_jsc_eosc',
    status: 'active',
    revoked_at: null,
    revocation_reason: null,
  },

  // ── Revoked ─────────────────────────────────────────────────────────────
  {
    id: 'tm-007',
    trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/eurohpc-member',
    subject_entity_id: 'https://federation.surfsara.nl',
    issued_at: '2025-01-10T08:00:00Z',
    expires_at: '2026-01-10T08:00:00Z',
    jwt: 'eyJhbGciOiJFUzI1NiJ9.eyJpZCI6Imh0dHBzOi8vZmVkZXJhdGlvbi5ldXJvaHBjLWp1LmV1cm9wYS5ldS90cnVzdC1tYXJrcy9ldXJvaHBjLW1lbWJlciIsInN1YiI6Imh0dHBzOi8vZmVkZXJhdGlvbi5zdXJmc2FyYS5ubCJ9.mock_tm_surf_eurohpc',
    status: 'revoked',
    revoked_at: '2025-02-20T11:00:00Z',
    revocation_reason: 'Entity membership revoked following organisational restructuring.',
  },
];

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

export const mockDashboardStats: DashboardStats = {
  entities: {
    total: 11,
    by_status: {
      active: 9,
      draft: 1,
      revoked: 1,
      suspended: 0,
    },
  },
  statements: {
    current: 9,
    expiring_soon: 3,
    expired: 1,
  },
  keys: {
    active: 11,
  },
  trust_marks: {
    active: 14,
    definitions: 4,
  },
};

// ---------------------------------------------------------------------------
// Expiring Items
// ---------------------------------------------------------------------------

export const mockExpiringItems: ExpiringItems = {
  statements: [
    {
      id: 'stmt-004',
      subject: 'https://federation.desy.de',
      expires_at: isoDate(2 * oneDayMs),
    },
    {
      id: 'stmt-002',
      subject: 'https://federation.cscs.ch',
      expires_at: isoDate(4 * oneDayMs),
    },
    {
      id: 'stmt-001',
      subject: 'https://federation.lumi.csc.fi',
      expires_at: isoDate(5 * oneDayMs),
    },
    {
      id: 'stmt-eosc-jsc',
      subject: 'https://federation.fz-juelich.de',
      expires_at: isoDate(6 * oneDayMs),
    },
  ],
  trust_marks: [
    {
      id: 'tm-006',
      subject: 'https://federation.bsc.es',
      trust_mark_id: 'https://federation.eurohpc-ju.europa.eu/trust-marks/prace-partner',
      expires_at: null,
    },
  ],
};

// ---------------------------------------------------------------------------
// Federation Topology
// ---------------------------------------------------------------------------

export const mockWaldurInstances: WaldurInstance[] = [
  {
    id: 'inst-csc',
    name: 'Waldur CSC',
    base_url: 'http://localhost:9501',
    status: 'healthy',
    last_seen_at: isoDate(-60000),
    created_at: '2025-01-10T08:00:00Z',
    updated_at: isoDate(-60000),
  },
  {
    id: 'inst-geant',
    name: 'Waldur GEANT',
    base_url: 'http://localhost:9502',
    status: 'healthy',
    last_seen_at: isoDate(-120000),
    created_at: '2025-01-12T10:00:00Z',
    updated_at: isoDate(-120000),
  },
  {
    id: 'inst-desy',
    name: 'Waldur DESY',
    base_url: 'http://localhost:9503',
    status: 'unhealthy',
    last_seen_at: isoDate(-3600000),
    created_at: '2025-01-15T11:00:00Z',
    updated_at: isoDate(-3600000),
  },
  {
    id: 'inst-surf',
    name: 'Waldur SURF',
    base_url: 'http://localhost:9504',
    status: 'healthy',
    last_seen_at: isoDate(-90000),
    created_at: '2025-01-05T07:00:00Z',
    updated_at: isoDate(-90000),
  },
];

export const mockTopologyData: TopologyResponse = {
  instances: [
    {
      instance_id: 'inst-csc',
      name: 'Waldur CSC',
      base_url: 'http://localhost:9501',
      status: 'healthy',
      trust_anchor_urls: ['http://localhost:9500'],
      entity_count: 3,
      user_count: 12,
      federation_entities: [
        { entity_id: 'https://federation.lumi.csc.fi', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
        { entity_id: 'https://federation.cscs.ch', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
        { entity_id: 'https://federation.bsc.es', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
      ],
    },
    {
      instance_id: 'inst-geant',
      name: 'Waldur GEANT',
      base_url: 'http://localhost:9502',
      status: 'healthy',
      trust_anchor_urls: ['http://localhost:9500'],
      entity_count: 2,
      user_count: 8,
      federation_entities: [
        { entity_id: 'https://federation.desy.de', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
        { entity_id: 'https://federation.mpcdf.mpg.de', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
      ],
    },
    {
      instance_id: 'inst-desy',
      name: 'Waldur DESY',
      base_url: 'http://localhost:9503',
      status: 'unhealthy',
      trust_anchor_urls: ['http://localhost:9505'],
      entity_count: 2,
      user_count: 5,
      federation_entities: [
        { entity_id: 'https://federation.cineca.it', isd_source: null, trust_anchor_url: 'http://localhost:9505', is_active: true },
        { entity_id: 'https://federation.tgcc.cea.fr', isd_source: null, trust_anchor_url: 'http://localhost:9505', is_active: true },
      ],
    },
    {
      instance_id: 'inst-surf',
      name: 'Waldur SURF',
      base_url: 'http://localhost:9504',
      status: 'healthy',
      trust_anchor_urls: ['http://localhost:9500', 'http://localhost:9505'],
      entity_count: 4,
      user_count: 15,
      federation_entities: [
        { entity_id: 'https://federation.surfsara.nl', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
        { entity_id: 'https://federation.fz-juelich.de', isd_source: null, trust_anchor_url: 'http://localhost:9505', is_active: true },
        { entity_id: 'https://federation.lumi.csc.fi', isd_source: null, trust_anchor_url: 'http://localhost:9500', is_active: true },
        { entity_id: 'https://federation.cineca.it', isd_source: null, trust_anchor_url: 'http://localhost:9505', is_active: true },
      ],
    },
  ],
  nodes: [
    // Trust Anchors
    { id: 'ta-http://localhost:9500', type: 'trust_anchor', label: 'Federation A (localhost:9000)', data: { url: 'http://localhost:9500' } },
    { id: 'ta-http://localhost:9505', type: 'trust_anchor', label: 'Federation B (localhost:9001)', data: { url: 'http://localhost:9505' } },
    // Waldur Instances
    { id: 'inst-inst-csc', type: 'waldur_instance', label: 'Waldur CSC', data: { base_url: 'http://localhost:9501', status: 'healthy', entity_count: 3, user_count: 12 } },
    { id: 'inst-inst-geant', type: 'waldur_instance', label: 'Waldur GEANT', data: { base_url: 'http://localhost:9502', status: 'healthy', entity_count: 2, user_count: 8 } },
    { id: 'inst-inst-desy', type: 'waldur_instance', label: 'Waldur DESY', data: { base_url: 'http://localhost:9503', status: 'unhealthy', entity_count: 2, user_count: 5 } },
    { id: 'inst-inst-surf', type: 'waldur_instance', label: 'Waldur SURF', data: { base_url: 'http://localhost:9504', status: 'healthy', entity_count: 4, user_count: 15 } },
  ],
  edges: [
    { id: 'edge-csc-a', source: 'inst-inst-csc', target: 'ta-http://localhost:9500', type: 'trusts', label: null },
    { id: 'edge-geant-a', source: 'inst-inst-geant', target: 'ta-http://localhost:9500', type: 'trusts', label: null },
    { id: 'edge-desy-b', source: 'inst-inst-desy', target: 'ta-http://localhost:9505', type: 'trusts', label: null },
    { id: 'edge-surf-a', source: 'inst-inst-surf', target: 'ta-http://localhost:9500', type: 'trusts', label: null },
    { id: 'edge-surf-b', source: 'inst-inst-surf', target: 'ta-http://localhost:9505', type: 'trusts', label: null },
  ],
  summary: {
    total_instances: 4,
    healthy_instances: 3,
    total_federations: 2,
    total_federation_entities: 11,
    total_users: 40,
  },
};

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const mockScenarios: ScenarioMeta[] = [
  { id: 'ta-register-activate', name: 'Register & Activate Entity', description: 'Create an entity, activate it, and verify that a subordinate statement and signing key are generated.', category: 'Trust Anchor', requires_mock_instances: false },
  { id: 'ta-entity-lifecycle', name: 'Entity Lifecycle', description: 'Walk an entity through the full lifecycle: create → activate → suspend → reactivate → revoke.', category: 'Trust Anchor', requires_mock_instances: false },
  { id: 'ta-key-rotation', name: 'Key Rotation', description: 'Create and activate an entity, rotate its signing key, and verify the old key is ROTATED while the new key is ACTIVE.', category: 'Trust Anchor', requires_mock_instances: false },
  { id: 'ta-trust-mark-lifecycle', name: 'Trust Mark Lifecycle', description: 'Create a trust mark definition, issue a trust mark to an entity, verify it is active, then revoke it.', category: 'Trust Anchor', requires_mock_instances: false },
  { id: 'ta-instance-lifecycle', name: 'Instance Lifecycle', description: 'Register a Waldur instance, verify it appears in the list, then delete it and verify removal.', category: 'Trust Anchor', requires_mock_instances: false },
  { id: 'fed-identity-push', name: 'Identity Push', description: 'Register an entity, build an identity JWT, push it to the mock Waldur instance, and verify acceptance.', category: 'Federation', requires_mock_instances: true },
  { id: 'fed-multi-isd', name: 'Multi-ISD Aggregation', description: 'Create two entities, push the same user identity from both, and verify that attribute sources are merged.', category: 'Federation', requires_mock_instances: true },
  { id: 'sec-expired-jwt', name: 'Expired JWT Attack', description: 'Build a JWT with a past expiration time and push it to mock Waldur. Expects rejection (401).', category: 'Security', requires_mock_instances: true },
  { id: 'sec-invalid-signature', name: 'Invalid Signature Attack', description: 'Sign a JWT with an unregistered key and push it to mock Waldur. Expects rejection (401).', category: 'Security', requires_mock_instances: true },
  { id: 'sec-unknown-entity', name: 'Unknown Entity Attack', description: 'Build a JWT from a non-existent entity and push it to mock Waldur. Expects rejection (401/403).', category: 'Security', requires_mock_instances: true },
  { id: 'sec-policy-violation', name: 'Policy Violation', description: 'Create an entity with a metadata policy requiring email, then push with empty email. Expects rejection (422).', category: 'Security', requires_mock_instances: true },
];

export const mockScenarioResults: Record<string, ScenarioRunResponse> = {
  'ta-register-activate': {
    scenario_id: 'ta-register-activate', scenario_name: 'Register & Activate Entity', status: 'passed', duration_ms: 48.2,
    steps: [
      { name: 'Create entity', status: 'passed', detail: 'Created https://scenario-abc123.example.com', duration_ms: 12.1 },
      { name: 'Generate signing key', status: 'passed', detail: 'kid=abc123', duration_ms: 8.5 },
      { name: 'Activate entity', status: 'passed', detail: 'Status → active', duration_ms: 5.3 },
      { name: 'Issue subordinate statement', status: 'passed', detail: 'JWT length=842', duration_ms: 15.2 },
      { name: 'Verify signing key', status: 'passed', detail: 'Active key kid=abc123', duration_ms: 3.1 },
    ],
  },
  'ta-entity-lifecycle': {
    scenario_id: 'ta-entity-lifecycle', scenario_name: 'Entity Lifecycle', status: 'passed', duration_ms: 35.6,
    steps: [
      { name: 'Create entity (draft)', status: 'passed', detail: 'Created https://scenario-def456.example.com', duration_ms: 10.2 },
      { name: 'Activate', status: 'passed', detail: 'Status → active', duration_ms: 5.1 },
      { name: 'Suspend', status: 'passed', detail: 'Status → suspended', duration_ms: 4.8 },
      { name: 'Reactivate', status: 'passed', detail: 'Status → active', duration_ms: 4.9 },
      { name: 'Revoke', status: 'passed', detail: 'Status → revoked', duration_ms: 5.0 },
    ],
  },
  'ta-key-rotation': {
    scenario_id: 'ta-key-rotation', scenario_name: 'Key Rotation', status: 'passed', duration_ms: 52.3,
    steps: [
      { name: 'Create entity with key', status: 'passed', detail: 'kid=old-key-123', duration_ms: 14.0 },
      { name: 'Rotate key', status: 'passed', detail: 'New kid=new-key-456', duration_ms: 12.5 },
      { name: 'Verify old key rotated', status: 'passed', detail: 'kid=old-key-123 status=rotated', duration_ms: 3.2 },
      { name: 'Verify new key active', status: 'passed', detail: 'kid=new-key-456 status=active', duration_ms: 3.0 },
      { name: 'Verify JWKS updated', status: 'passed', detail: 'JWKS keys: [new-key-456]', duration_ms: 3.1 },
    ],
  },
  'ta-trust-mark-lifecycle': {
    scenario_id: 'ta-trust-mark-lifecycle', scenario_name: 'Trust Mark Lifecycle', status: 'passed', duration_ms: 61.4,
    steps: [
      { name: 'Create trust mark definition', status: 'passed', detail: 'id=https://scenario-trustmark.example.com', duration_ms: 8.3 },
      { name: 'Create + activate entity', status: 'passed', detail: 'entity=https://scenario-ghi789.example.com', duration_ms: 14.2 },
      { name: 'Issue trust mark', status: 'passed', detail: 'JWT length=654', duration_ms: 15.1 },
      { name: 'Verify trust mark active', status: 'passed', detail: 'status=active', duration_ms: 2.8 },
      { name: 'Revoke trust mark', status: 'passed', detail: 'status=revoked', duration_ms: 5.2 },
    ],
  },
  'ta-instance-lifecycle': {
    scenario_id: 'ta-instance-lifecycle', scenario_name: 'Instance Lifecycle', status: 'passed', duration_ms: 28.7,
    steps: [
      { name: 'Create instance', status: 'passed', detail: 'url=https://scenario-instance.example.com', duration_ms: 8.4 },
      { name: 'Verify instance in list', status: 'passed', detail: 'Found in database', duration_ms: 4.2 },
      { name: 'Delete instance', status: 'passed', detail: 'Deleted successfully', duration_ms: 5.1 },
      { name: 'Verify instance removed', status: 'passed', detail: 'Not found — confirmed deleted', duration_ms: 3.8 },
    ],
  },
  'fed-identity-push': {
    scenario_id: 'fed-identity-push', scenario_name: 'Identity Push', status: 'partial', duration_ms: 15.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.1 },
      { name: 'Create entity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Build identity JWT', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Register entity mapping', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push identity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
  'fed-multi-isd': {
    scenario_id: 'fed-multi-isd', scenario_name: 'Multi-ISD Aggregation', status: 'partial', duration_ms: 12.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.0 },
      { name: 'Create entity A', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Create entity B', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push identity from A', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push identity from B', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Verify merged sources', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
  'sec-expired-jwt': {
    scenario_id: 'sec-expired-jwt', scenario_name: 'Expired JWT Attack', status: 'partial', duration_ms: 10.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.0 },
      { name: 'Create entity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Build expired JWT', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push expired JWT', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
  'sec-invalid-signature': {
    scenario_id: 'sec-invalid-signature', scenario_name: 'Invalid Signature Attack', status: 'partial', duration_ms: 10.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.0 },
      { name: 'Create entity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Build JWT with wrong key', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push invalid JWT', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
  'sec-unknown-entity': {
    scenario_id: 'sec-unknown-entity', scenario_name: 'Unknown Entity Attack', status: 'partial', duration_ms: 10.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.0 },
      { name: 'Build JWT from unknown entity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push unknown entity JWT', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
  'sec-policy-violation': {
    scenario_id: 'sec-policy-violation', scenario_name: 'Policy Violation', status: 'partial', duration_ms: 10.0,
    steps: [
      { name: 'Check mock Waldur', status: 'skipped', detail: 'Mock Waldur unreachable at http://localhost:8000', duration_ms: 3.0 },
      { name: 'Create entity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Build JWT without email', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
      { name: 'Push policy-violating identity', status: 'skipped', detail: 'Mock Waldur unavailable', duration_ms: 0.1 },
    ],
  },
};
