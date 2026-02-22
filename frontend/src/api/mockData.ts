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
