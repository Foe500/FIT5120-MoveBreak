import test from 'node:test'
import assert from 'node:assert/strict'
import { checkPlanConflicts, localDateTime, planIntervals, zonedIso } from '../src/lib/assistant.js'
import { getSavedPlannerBreaks, savePlannerBreaks, addConfirmedPlannerItems } from '../src/lib/plannerStorage.js'

// Supply the browser lock interface; do not depend on Node's experimental lock manager.
Object.defineProperty(globalThis, 'navigator', { value: { locks: { request: async (_key, callback) => callback() } }, configurable: true })
const values = new Map()
globalThis.window = { localStorage: { getItem: (k) => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }, dispatchEvent: () => {} }

const makeItem = (id, start = '2099-09-29T03:00:00.000Z') => ({
  id, activity: 'Eye reset', type: 'Indoor', period: 'Afternoon', duration: 5,
  startAt: start, endAt: new Date(Date.parse(start) + 300000).toISOString(),
})

test('Melbourne wall time respects daylight saving and refuses gap/fold', () => {
  assert.equal(zonedIso('2026-09-30T13:00'), '2026-09-30T03:00:00.000Z')
  assert.equal(zonedIso('2026-10-05T13:00'), '2026-10-05T02:00:00.000Z')
  assert.equal(localDateTime('2026-09-30T03:00:00Z'), '2026-09-30T13:00')
  assert.throws(() => zonedIso('2026-10-04T02:30'))
  assert.throws(() => zonedIso('2027-04-04T02:30'))
})

test('clearing a plan stays empty instead of restoring fake items', () => {
  assert.equal(savePlannerBreaks([]), true)
  assert.deepEqual(getSavedPlannerBreaks([makeItem('fake')]), [])
})

test('duplicate confirmations are idempotent and conflicting new items fail', async () => {
  savePlannerBreaks([])
  assert.equal(await addConfirmedPlannerItems([makeItem('a')], checkPlanConflicts), 1)
  assert.equal(await addConfirmedPlannerItems([makeItem('a')], checkPlanConflicts), 0)
  await assert.rejects(addConfirmedPlannerItems([makeItem('b')], checkPlanConflicts))
  assert.equal(getSavedPlannerBreaks().length, 1)
})

test('concurrent preview items cannot overlap; adjoining breaks can', () => {
  assert.throws(() => checkPlanConflicts([makeItem('a'), makeItem('b')], []))
  assert.doesNotThrow(() => checkPlanConflicts([makeItem('b', '2099-09-29T03:05:00Z')], [makeItem('a')]))
})

test('unscheduled legacy entries do not invent a reserved time', () => {
  assert.deepEqual(planIntervals([{ id: 'old', time: 'Next break', duration: 10 }]), [])
})

test('failed storage cannot be reported as a successful save', async () => {
  const original = window.localStorage.setItem
  window.localStorage.setItem = () => { throw new Error('Quota') }
  assert.equal(savePlannerBreaks([]), false)
  await assert.rejects(addConfirmedPlannerItems([makeItem('c', '2099-09-29T04:00:00Z')], checkPlanConflicts), { code: 'STORAGE_FAILED' })
  window.localStorage.setItem = original
})

test('invalid or silently discarded items are never reported as saved', async () => {
  savePlannerBreaks([])
  assert.equal(savePlannerBreaks([{}]), false)
  const original = window.localStorage.setItem
  window.localStorage.setItem = () => {}
  await assert.rejects(addConfirmedPlannerItems([makeItem('discarded')], checkPlanConflicts), { code: 'STORAGE_FAILED' })
  window.localStorage.setItem = original
})
