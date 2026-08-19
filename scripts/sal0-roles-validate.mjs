#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ROLES_FILE = join(ROOT, 'docs', 'coordination', 'AGENT_ROLES.json')

const roleSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    authority: z.string().min(1),
    primaryLane: z.enum(['Unity/Game', 'Web', 'Make Automation', 'Coordination']),
    surfaces: z.array(z.string().min(1)).min(1),
    sessionPolicy: z.string().min(1),
    callWhen: z.array(z.string().min(1)).min(1),
    outputSchema: z.string().min(1),
    allowedActions: z.array(z.string().min(1)).min(1),
    forbiddenActions: z.array(z.string().min(1)).min(1),
    failsafes: z.array(z.string().min(1)).min(1),
  })
  .strict()

const rolesSchema = z
  .object({
    schemaVersion: z.literal('sal0-agent-roles-v0'),
    defaultStopRules: z.array(z.string().min(1)).min(1),
    agents: z.array(roleSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set()
    for (const agent of value.agents) {
      if (ids.has(agent.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate agent id: ${agent.id}`,
          path: ['agents'],
        })
      }
      ids.add(agent.id)
    }
  })

const roles = rolesSchema.parse(JSON.parse(readFileSync(ROLES_FILE, 'utf8')))
console.log(`agent roles valid: ${roles.agents.length} agents`)
