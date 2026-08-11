import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export class LocalArtifactStore {
  constructor(private readonly root = process.env.WORKFLOW_ENGINE_ARTIFACT_DIR ?? resolve(process.cwd(), '.runtime', 'artifacts')) {
    mkdirSync(this.root, { recursive: true });
  }

  write(name: string, content: string | Buffer): { uri: string; size: number } {
    const safeName = basename(name).replace(/[^A-Za-z0-9._-]/g, '_');
    const fileName = `${randomUUID()}-${safeName}`;
    const path = resolve(this.root, fileName);
    writeFileSync(path, content);
    return { uri: `local://${fileName}`, size: Buffer.byteLength(content) };
  }

  read(uri: string): Buffer {
    if (!uri.startsWith('local://')) throw new Error('不支持的 Artifact URI。');
    const fileName = basename(uri.slice('local://'.length));
    return readFileSync(resolve(this.root, fileName));
  }
}
