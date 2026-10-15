// Runs the executable checks behind NOTES-api.md under vitest.
import {describe, expect, it} from 'vitest'
import {runNotesApiChecks} from './notes-api-check.ts'

describe('NOTES-api.md claims', () => {
  const results = runNotesApiChecks()
  for (const {label, ok, detail} of results) {
    it(label, () => {
      expect(ok, detail).toBe(true)
    })
  }
})
