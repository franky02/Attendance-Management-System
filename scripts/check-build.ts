// Fails the build if a real (Supabase) build contains demo mode's staff list,
// i.e. checks that demo mode (src/demoDb.ts) was left out of the public files.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from 'vite'
import { SEED_STAFF } from '../src/seed'

const env = loadEnv('production', process.cwd())
if (!env.VITE_SUPABASE_URL) {
  console.log('check-build: demo build, staff list allowed')
  process.exit(0)
}
const needles = SEED_STAFF.flatMap(([, , pf, code]) => [pf, code])
const files = (d: string): string[] =>
  readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]))
const leaks = files('dist').filter((f) => /\.(js|html|json|css|webmanifest|map)$/.test(f))
  .filter((f) => { const t = readFileSync(f, 'utf8'); return needles.some((n) => t.includes(n)) })
if (leaks.length) {
  console.error('check-build: staff details found in public files:', leaks)
  process.exit(1)
}
console.log('check-build: no staff details in dist')
