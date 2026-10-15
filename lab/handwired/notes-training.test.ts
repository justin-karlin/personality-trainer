// Runs the executable checks behind NOTES-training.md under vitest.
import {describe, expect, it} from 'vitest'
import {runNotesTrainingChecks} from './notes-training-check.ts'

describe('NOTES-training.md claims', () => {
  const results = runNotesTrainingChecks()
  for (const {label, ok, detail} of results) {
    it(label, () => {
      expect(ok, detail).toBe(true)
    })
  }
})
