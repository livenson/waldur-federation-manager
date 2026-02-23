// ---------------------------------------------------------------------------
// Wizard state, option definitions, and helpers
// ---------------------------------------------------------------------------

export interface OrgMethodOption {
  id: string;
  name: string;
  speed: string;
  description: string;
  helpDetail: string;
}

export interface IdentityMethodOption {
  id: string;
  name: string;
  assurance: string;
  description: string;
  helpDetail: string;
}

export interface TrustMarkTier {
  id: string;
  name: string;
  enabled: boolean;
  trustMarkIdSuffix: string;
}

export interface WizardState {
  // Step 2
  orgMethods: string[];
  // Step 3
  identityMethods: string[];
  // Step 4
  sirtfi: boolean;
  researchAndScholarship: boolean;
  rafLevel: 'none' | 'low' | 'medium' | 'high';
  customRequirements: string[];
  // Step 5
  baseUrl: string;
  trustMarkTiers: TrustMarkTier[];
  // Step 6
  requiredScopes: string[];
  allowedAlgorithms: string[];
  requireContacts: boolean;
  requireOrgName: boolean;
}

export const INITIAL_STATE: WizardState = {
  orgMethods: [],
  identityMethods: [],
  sirtfi: false,
  researchAndScholarship: false,
  rafLevel: 'none',
  customRequirements: [],
  baseUrl: '',
  trustMarkTiers: [],
  requiredScopes: ['openid', 'profile', 'email'],
  allowedAlgorithms: ['ES256', 'RS256'],
  requireContacts: true,
  requireOrgName: true,
};

export const ORG_METHODS: OrgMethodOption[] = [
  {
    id: 'vlei',
    name: 'vLEI / GLEIF',
    speed: 'Instant',
    description: 'Verifiable Legal Entity Identifiers backed by the GLEIF trust chain.',
    helpDetail:
      'vLEI credentials are cryptographically verifiable and anchored in the Global Legal Entity Identifier Foundation (GLEIF). Verification is instant and machine-readable.',
  },
  {
    id: 'duns',
    name: 'DUNS / D&B',
    speed: '2-5 days',
    description: 'Dun & Bradstreet D-U-N-S Number lookup and validation.',
    helpDetail:
      'The DUNS number is a widely-used business identifier. Verification involves a lookup against the D&B database, which may take 2-5 business days for new registrations.',
  },
  {
    id: 'kyb',
    name: 'KYB Service',
    speed: 'Hours',
    description: 'Automated Know-Your-Business via providers like Sumsub or Onfido.',
    helpDetail:
      'KYB services cross-reference company registries, beneficial ownership databases, and sanctions lists. Typically completes within hours.',
  },
  {
    id: 'nren',
    name: 'NREN / GEANT TCS',
    speed: 'Attestation',
    description: 'National Research & Education Network attestation via GEANT Trusted Certificate Service.',
    helpDetail:
      'NRENs vouch for member institutions through the GEANT TCS framework. Suitable for academic and research organizations already part of the R&E ecosystem.',
  },
  {
    id: 'manual',
    name: 'Manual Review',
    speed: 'Variable',
    description: 'Human review of submitted documentation as a fallback.',
    helpDetail:
      'A federation operator manually reviews uploaded documents (registration certificates, articles of incorporation, etc.). Use as a fallback when automated methods are unavailable.',
  },
];

export const IDENTITY_METHODS: IdentityMethodOption[] = [
  {
    id: 'eudi',
    name: 'EUDI Wallet / eIDAS',
    assurance: 'High',
    description: 'EU Digital Identity Wallet with eIDAS high assurance level.',
    helpDetail:
      'The European Digital Identity Wallet provides LoA High under the eIDAS regulation. Requires an EU member-state issued digital identity.',
  },
  {
    id: 'kyc',
    name: 'Commercial KYC',
    assurance: 'Substantial',
    description: 'Identity verification via IDnow, Veriff, or similar providers.',
    helpDetail:
      'Commercial KYC providers use document scanning, liveness checks, and database lookups. Provides substantial assurance with global coverage.',
  },
  {
    id: 'academic',
    name: 'Academic Identity',
    assurance: 'Federated',
    description: 'eduGAIN / MyAccessID federated identity for R&E sector.',
    helpDetail:
      'Leverages the eduGAIN interfederation or MyAccessID to verify individuals through their home institution. Assurance depends on the home IdP.',
  },
  {
    id: 'oidc_ia',
    name: 'OIDC for Identity Assurance',
    assurance: 'Interoperable',
    description: 'OpenID Connect for Identity Assurance (OIDC4IDA) standard claims.',
    helpDetail:
      'Uses the OIDC4IDA specification to convey verified identity claims and evidence. Interoperable across compliant providers.',
  },
  {
    id: 'manual',
    name: 'Manual Review',
    assurance: 'Variable',
    description: 'Human review of identity documents as a fallback.',
    helpDetail:
      'A federation operator manually reviews submitted identity documents (passport, national ID). Use as a fallback when automated methods are unavailable.',
  },
];

export const ALGORITHM_OPTIONS = [
  { id: 'ES256', label: 'ES256', family: 'ECDSA' },
  { id: 'ES384', label: 'ES384', family: 'ECDSA' },
  { id: 'ES512', label: 'ES512', family: 'ECDSA' },
  { id: 'RS256', label: 'RS256', family: 'RSA' },
  { id: 'RS384', label: 'RS384', family: 'RSA' },
  { id: 'RS512', label: 'RS512', family: 'RSA' },
];

// ---------------------------------------------------------------------------
// Derive trust mark tiers from wizard selections
// ---------------------------------------------------------------------------
export function deriveTrustMarkTiers(state: WizardState): TrustMarkTier[] {
  const tiers: TrustMarkTier[] = [];

  if (state.orgMethods.length > 0) {
    tiers.push({
      id: 'org_verified',
      name: 'Organization Verified',
      enabled: true,
      trustMarkIdSuffix: 'org-verified',
    });
  }

  if (state.identityMethods.length > 0) {
    tiers.push({
      id: 'identity_verified',
      name: 'Representative Identity Verified',
      enabled: true,
      trustMarkIdSuffix: 'identity-verified',
    });
  }

  if (state.sirtfi) {
    tiers.push({
      id: 'sirtfi',
      name: 'Sirtfi Compliant',
      enabled: true,
      trustMarkIdSuffix: 'sirtfi',
    });
  }

  if (state.researchAndScholarship) {
    tiers.push({
      id: 'research_scholarship',
      name: 'Research & Scholarship',
      enabled: true,
      trustMarkIdSuffix: 'research-and-scholarship',
    });
  }

  if (state.rafLevel !== 'none') {
    tiers.push({
      id: `raf_${state.rafLevel}`,
      name: `RAF ${state.rafLevel.charAt(0).toUpperCase() + state.rafLevel.slice(1)} Assurance`,
      enabled: true,
      trustMarkIdSuffix: `raf-${state.rafLevel}`,
    });
  }

  if (state.orgMethods.length > 0 && state.identityMethods.length > 0) {
    tiers.push({
      id: 'fully_verified',
      name: 'Fully Verified Entity',
      enabled: true,
      trustMarkIdSuffix: 'fully-verified',
    });
  }

  return tiers;
}

// ---------------------------------------------------------------------------
// Build the metadata policy JSON from wizard state
// ---------------------------------------------------------------------------
export function buildPolicyJson(state: WizardState): Record<string, unknown> {
  const policy: Record<string, unknown> = {};

  if (state.requiredScopes.length > 0) {
    policy['scopes'] = {
      superset_of: state.requiredScopes,
      essential: true,
    };
  }

  if (state.allowedAlgorithms.length > 0) {
    policy['id_token_signing_alg_values_supported'] = {
      subset_of: state.allowedAlgorithms,
    };
    policy['userinfo_signing_alg_values_supported'] = {
      subset_of: state.allowedAlgorithms,
    };
  }

  if (state.requireContacts) {
    policy['contacts'] = { essential: true };
  }

  if (state.requireOrgName) {
    policy['organization_name'] = { essential: true };
  }

  return policy;
}
