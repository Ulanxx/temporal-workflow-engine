import { WorkflowDefinition } from './types';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

export function canonicalizeDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    schemaVersion: 1,
    nodes: [...definition.nodes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => ({ ...node, config: sortValue(node.config) as typeof node.config })),
    edges: [...definition.edges]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => ({ ...edge })),
    viewport: definition.viewport ? { ...definition.viewport } : undefined,
  };
}

export function stableStringifyDefinition(definition: WorkflowDefinition): string {
  return JSON.stringify(sortValue(canonicalizeDefinition(definition)));
}

/** A deterministic non-cryptographic checksum for version identity and tests. */
export function checksumDefinition(definition: WorkflowDefinition): string {
  const source = stableStringifyDefinition(definition);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
