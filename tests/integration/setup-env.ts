import { config } from 'dotenv';
import os from 'node:os';
import path from 'node:path';

config({ quiet: true });

// Point the app's db client at the isolated test database before it is imported.
const testUrl = process.env.DATABASE_URL_TEST ?? 'postgres://cytolab:cytolab@localhost:5432/cytolab_test';
const env = process.env as Record<string, string>;
env.DATABASE_URL = testUrl;
env.NODE_ENV = 'test';
env.LOG_LEVEL = 'error';
// Uploads made by tests go to a throwaway directory, not the dev workspace's.
env.STORAGE_DIR = path.join(os.tmpdir(), 'cytolab-test-uploads');
