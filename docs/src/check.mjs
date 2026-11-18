import { check } from './stripboard.mjs';
import * as boards from './boards.mjs';
let bad = 0;
for (const [name, b] of Object.entries(boards)) {
  const p = check(b);
  console.log(`${name}: ${p.length ? p.length + ' problems' : 'ok'}`);
  for (const x of p) console.log('   ' + x);
  bad += p.length;
}
process.exit(bad ? 1 : 0);
