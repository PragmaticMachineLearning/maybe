import { describe, expect, it } from 'vitest'

import { HyperFormula } from 'gaussformula'

describe('gaussformula package boundary', () => {
  it('exposes getVisualDependencyGraph on built instances', () => {
    const engine = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })

    expect(typeof engine.getVisualDependencyGraph).toBe('function')

    engine.destroy()
  })
})
