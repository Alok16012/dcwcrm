/**
 * Every engine scenario again, running on the seeded admission script from
 * the Flow Builder instead of the built-in questions.
 */

import { compileScript, applyScript } from '../src/script.mjs'
import { admissionScript } from '../src/flows/seed.mjs'

applyScript(compileScript(JSON.parse(JSON.stringify(admissionScript()))))
await import('./engine.test.mjs')
