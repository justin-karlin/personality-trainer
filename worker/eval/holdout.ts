// Held-out cases, written independently of the reviewer prompt and the dev cases.
// Run them only to make a decision (e.g. which model to start on); don't tune the
// prompt to individual holdout failures, or they stop measuring anything.
import type { Case } from './cases';

const RAW: (Omit<Case, 'expect'> & { expect: Omit<Case['expect'], 'forbid'> & { forbid?: string[] } })[] = [];

export const HOLDOUT: Case[] = RAW.map((c) => ({
  ...c,
  expect: { ...c.expect, forbid: c.expect.forbid?.map((f) => new RegExp(f, 'i')) },
}));
