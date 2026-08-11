import { RunEventType, StepInvocation } from './types';

export function createInvocationId(
  runId: string,
  nodeId: string,
  branchPath: string[] = [],
  iterationPath: number[] = [],
): string {
  const branch = branchPath.length === 0 ? 'root' : branchPath.join('.');
  const iteration = iterationPath.length === 0 ? 'root' : iterationPath.join('.');
  return `${runId}:${nodeId}:${branch}:${iteration}`;
}

export function createRunEventIdempotencyKey(
  invocation: Pick<StepInvocation, 'runId' | 'id' | 'attempt'>,
  type: RunEventType,
  occurrence = 1,
): string {
  return [invocation.runId, invocation.id, type, invocation.attempt, occurrence].join(':');
}
