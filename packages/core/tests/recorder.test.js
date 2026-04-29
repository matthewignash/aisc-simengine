import { describe, it, expect } from 'vitest';
import { createRecorder } from '../src/engine/recorder.js';

describe('createRecorder', () => {
  it('record() appends a row of the current state; snapshot() returns rows in call order', () => {
    let current = { T: 298, V: 6.4 };
    const rec = createRecorder({
      variables: ['T', 'V'],
      getState: () => current,
    });
    rec.startRun();
    rec.record();
    current = { T: 350, V: 6.4 };
    rec.record();
    current = { T: 350, V: 8.0 };
    rec.record();
    rec.stopRun();
    expect(rec.snapshot()).toEqual([
      { T: 298, V: 6.4 },
      { T: 350, V: 6.4 },
      { T: 350, V: 8.0 },
    ]);
  });

  it('snapshot() returns a deep copy: mutating it does not affect subsequent snapshots', () => {
    const current = { T: 298 };
    const rec = createRecorder({ variables: ['T'], getState: () => current });
    rec.startRun();
    rec.record();
    const snap = rec.snapshot();
    snap[0].T = 999;
    snap.push({ T: 0 });
    // Recorder's internal state should be unchanged.
    expect(rec.snapshot()).toEqual([{ T: 298 }]);
  });

  it('toCSV() with no records returns a header-only line ending in CRLF', () => {
    const rec = createRecorder({
      variables: ['T', 'V', 'P'],
      getState: () => ({}),
    });
    rec.startRun();
    rec.stopRun();
    expect(rec.toCSV()).toBe('T,V,P\r\n');
  });

  it('toCSV() emits numeric rows in order with CRLF line endings', () => {
    let current = { T: 298, V: 6.4 };
    const rec = createRecorder({ variables: ['T', 'V'], getState: () => current });
    rec.startRun();
    rec.record();
    current = { T: 350, V: 8.0 };
    rec.record();
    rec.stopRun();
    expect(rec.toCSV()).toBe('T,V\r\n298,6.4\r\n350,8\r\n');
  });

  it('toCSV() RFC 4180-quotes fields containing commas, quotes, or newlines', () => {
    let current = {
      label: 'simple',
      note: 'has, comma',
      remark: 'she said "hi"',
      multi: 'line\nbreak',
    };
    const rec = createRecorder({
      variables: ['label', 'note', 'remark', 'multi'],
      getState: () => current,
    });
    rec.startRun();
    rec.record();
    rec.stopRun();
    expect(rec.toCSV()).toBe(
      'label,note,remark,multi\r\n' + 'simple,"has, comma","she said ""hi""","line\nbreak"\r\n'
    );
  });

  it('toCSV() emits empty string for null and undefined fields', () => {
    let current = { a: null, b: undefined, c: 0 };
    const rec = createRecorder({ variables: ['a', 'b', 'c'], getState: () => current });
    rec.startRun();
    rec.record();
    rec.stopRun();
    expect(rec.toCSV()).toBe('a,b,c\r\n,,0\r\n');
  });

  it('startSweep(spec) iterates the cartesian product in declaration order, last key cycles fastest', () => {
    const rec = createRecorder({ variables: ['T', 'V'], getState: () => ({}) });
    const combos = [...rec.startSweep({ T: [298, 350], V: [4, 8] })];
    expect(combos).toEqual([
      { T: 298, V: 4 },
      { T: 298, V: 8 },
      { T: 350, V: 4 },
      { T: 350, V: 8 },
    ]);
  });
});
