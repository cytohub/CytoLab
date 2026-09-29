import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env';

/**
 * Binary storage for attachments. V1 writes to local disk; production swaps in an
 * object store (S3/GCS/Azure) with short-lived signed URLs behind this interface.
 */
export interface StorageProvider {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const KEY_RE = /^[a-z0-9-]+\/[a-f0-9]{2}\/[a-f0-9]{48}$/;

class LocalDiskStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Keys are generated server-side; the pattern check makes traversal impossible even so.
    if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
    return path.join(this.root, key);
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { flag: 'wx' });
  }

  async get(key: string): Promise<Uint8Array> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  provider ??= new LocalDiskStorage(path.resolve(process.cwd(), env().STORAGE_DIR));
  return provider;
}

/** Opaque key: `<org-id>/<2-hex shard>/<48-hex random>`. Never derived from the file name. */
export function newStorageKey(orgId: string): string {
  const random = randomBytes(24).toString('hex');
  return `${orgId}/${random.slice(0, 2)}/${random}`;
}

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}
