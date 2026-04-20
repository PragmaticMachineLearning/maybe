import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { HyperFormula } from 'gaussformula'

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>
  workspaces?: string[]
}

describe('gaussformula package boundary', () => {
  it('exposes getVisualDependencyGraph on built instances', () => {
    const engine = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })

    expect(typeof engine.getVisualDependencyGraph).toBe('function')

    engine.destroy()
  })

  it('depends on the published npm package instead of a local package', () => {
    expect(packageJson.dependencies?.gaussformula).toBeDefined()
    expect(packageJson.dependencies?.gaussformula).not.toMatch(/^workspace:/)
    expect(packageJson.dependencies?.gaussformula).not.toMatch(/^file:/)
    expect(packageJson.workspaces ?? []).not.toContain('hyperformula')
  })
})
