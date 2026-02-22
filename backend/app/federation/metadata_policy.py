"""Metadata policy engine implementing OIDC Federation 1.0 Section 6.1 operators.

Operators (applied in spec order):
  value     — replace the value unconditionally
  add       — append values to list
  default   — set if missing
  one_of    — validate that value is one of allowed values
  subset_of — validate that value is a subset of allowed values
  superset_of — validate that value is a superset of required values
  essential — validate that value is present (not null/empty)
"""

from app.exceptions import MetadataPolicyError


OPERATOR_ORDER = ["value", "add", "default", "one_of", "subset_of", "superset_of", "essential"]


def apply_policy_to_value(value, policy_operators: dict):
    """Apply a set of policy operators to a single metadata value."""
    for op in OPERATOR_ORDER:
        if op not in policy_operators:
            continue
        op_value = policy_operators[op]

        if op == "value":
            value = op_value

        elif op == "add":
            if not isinstance(op_value, list):
                op_value = [op_value]
            if value is None:
                value = op_value
            elif isinstance(value, list):
                for item in op_value:
                    if item not in value:
                        value.append(item)
            else:
                value = [value] + op_value

        elif op == "default":
            if value is None:
                value = op_value

        elif op == "one_of":
            if value is not None:
                allowed = op_value if isinstance(op_value, list) else [op_value]
                if value not in allowed:
                    raise MetadataPolicyError(
                        f"Value {value!r} not in one_of {allowed}"
                    )

        elif op == "subset_of":
            if value is not None:
                allowed = set(op_value) if isinstance(op_value, list) else {op_value}
                val_set = set(value) if isinstance(value, list) else {value}
                if not val_set.issubset(allowed):
                    raise MetadataPolicyError(
                        f"Value {value!r} is not a subset of {op_value}"
                    )

        elif op == "superset_of":
            if value is not None:
                required = set(op_value) if isinstance(op_value, list) else {op_value}
                val_set = set(value) if isinstance(value, list) else {value}
                if not val_set.issuperset(required):
                    raise MetadataPolicyError(
                        f"Value {value!r} is not a superset of {op_value}"
                    )

        elif op == "essential":
            if op_value and (value is None or value == "" or value == []):
                raise MetadataPolicyError("Essential value is missing or empty")

    return value


def apply_policy(metadata: dict, policy: dict) -> dict:
    """Apply a full metadata policy to a metadata dict.

    The policy is structured as:
    {
        "entity_type_name": {
            "claim_name": {
                "operator": value,
                ...
            }
        }
    }

    Returns the modified metadata.
    """
    result = dict(metadata)
    for entity_type, type_policy in policy.items():
        if entity_type not in result:
            result[entity_type] = {}
        entity_metadata = result[entity_type]
        if not isinstance(entity_metadata, dict) or not isinstance(type_policy, dict):
            continue
        for claim, operators in type_policy.items():
            if not isinstance(operators, dict):
                continue
            current_value = entity_metadata.get(claim)
            entity_metadata[claim] = apply_policy_to_value(current_value, operators)
        result[entity_type] = entity_metadata
    return result


def merge_policies(upper_policy: dict, lower_policy: dict) -> dict:
    """Merge two metadata policies. Upper (closer to anchor) takes precedence.

    For conflicting operators on the same claim, upper wins.
    """
    merged = dict(lower_policy)
    for entity_type, type_policy in upper_policy.items():
        if entity_type not in merged:
            merged[entity_type] = type_policy
            continue
        if not isinstance(type_policy, dict):
            merged[entity_type] = type_policy
            continue
        for claim, operators in type_policy.items():
            if claim not in merged[entity_type]:
                merged[entity_type][claim] = operators
            elif isinstance(operators, dict) and isinstance(merged[entity_type][claim], dict):
                # Upper operators override lower for same claim
                merged[entity_type][claim] = {
                    **merged[entity_type][claim],
                    **operators,
                }
            else:
                merged[entity_type][claim] = operators
    return merged
