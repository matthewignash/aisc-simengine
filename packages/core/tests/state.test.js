import { describe, it, expect } from 'vitest';
import { createState } from '../src/engine/state.js';

describe('createState', () => {
  it('returns a store where get(key) returns the initial value', () => {
    const state = createState({ T: 298, V: 6.4 });
    expect(state.get('T')).toBe(298);
    expect(state.get('V')).toBe(6.4);
  });

  it('set(key, value) updates the value retrievable via get', () => {
    const state = createState({ T: 298 });
    state.set('T', 350);
    expect(state.get('T')).toBe(350);
  });

  it('on(key, listener) fires the listener with the new value when set', () => {
    const state = createState({ T: 298 });
    const calls = [];
    state.on('T', (value) => calls.push(value));
    state.set('T', 350);
    expect(calls).toEqual([350]);
  });

  it('on() returns an unsubscribe function that stops further notifications', () => {
    const state = createState({ T: 298 });
    const calls = [];
    const off = state.on('T', (value) => calls.push(value));
    state.set('T', 350);
    off();
    state.set('T', 400);
    expect(calls).toEqual([350]);
  });

  it('multiple listeners on the same key fire in registration order', () => {
    const state = createState({ T: 298 });
    const order = [];
    state.on('T', () => order.push('first'));
    state.on('T', () => order.push('second'));
    state.on('T', () => order.push('third'));
    state.set('T', 350);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('listeners on one key are not fired when a different key is set', () => {
    const state = createState({ T: 298, V: 6.4 });
    const calls = [];
    state.on('T', () => calls.push('T-fired'));
    state.set('V', 8.0);
    expect(calls).toEqual([]);
  });

  it('emit(key, ...args) fires listeners with the supplied args without changing stored data', () => {
    const state = createState({ T: 298 });
    const calls = [];
    state.on('T', (...args) => calls.push(args));
    state.emit('T', 'manual-event', 42);
    expect(calls).toEqual([['manual-event', 42]]);
    expect(state.get('T')).toBe(298); // data unchanged
  });

  it('getAll() returns a snapshot of all values that does not mutate the store on edit', () => {
    const state = createState({ T: 298, V: 6.4 });
    const snap = state.getAll();
    expect(snap).toEqual({ T: 298, V: 6.4 });
    snap.T = 999;
    expect(state.get('T')).toBe(298); // mutating snapshot must not affect store
  });

  it('reset() restores initial values and fires listeners for keys that changed', () => {
    const state = createState({ T: 298, V: 6.4 });
    state.set('T', 350);
    state.set('V', 8.0);
    const calls = [];
    state.on('T', (v) => calls.push(['T', v]));
    state.on('V', (v) => calls.push(['V', v]));
    state.reset();
    expect(state.get('T')).toBe(298);
    expect(state.get('V')).toBe(6.4);
    expect(calls).toContainEqual(['T', 298]);
    expect(calls).toContainEqual(['V', 6.4]);
  });

  it('two stores from createState do not share data or listeners', () => {
    const a = createState({ T: 100 });
    const b = createState({ T: 200 });
    const aCalls = [];
    a.on('T', (v) => aCalls.push(v));
    b.set('T', 999);
    expect(a.get('T')).toBe(100);
    expect(aCalls).toEqual([]);
  });
});
