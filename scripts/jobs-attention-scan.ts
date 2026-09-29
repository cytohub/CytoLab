import { config } from 'dotenv';
config({ quiet: true });
import { runAttentionScan } from '../src/server/modules/jobs/attention-scan';
import { closeDb } from '../src/server/db/client';

runAttentionScan()
  .then((r) => console.log(`✔ Attention scan: ${r.notified} notifications across ${r.organizations} organization(s)`))
  .then(closeDb)
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
