import { config } from 'dotenv';

config({ quiet: true });

// Point the app's db client at the isolated test database before it is imported.
const testUrl = process.env.DATABASE_URL_TEST ?? 'postgres://cytolab:cytolab@localhost:5432/cytolab_test';
const env = process.env as Record<string, string>;
env.DATABASE_URL = testUrl;
env.NODE_ENV = 'test';
env.LOG_LEVEL = 'error';
