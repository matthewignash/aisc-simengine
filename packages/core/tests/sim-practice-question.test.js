import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-practice-question.js';

const STORAGE_KEY_P1_SL = 'aisc-simengine:practice:s1.5-gas-laws:sl:practice-1';

async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    id = 'practice-1',
    section = 'practice',
    label = 'Calculate the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa.',
    answer = 'V = nRT / P = 3.46 L',
  } = opts;
  const el = document.createElement('sim-practice-question');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  el.id = id;
  el.setAttribute('section', section);
  if (label) el.setAttribute('label', label);
  if (answer !== null) {
    const slot = document.createElement('div');
    slot.slot = 'answer';
    slot.textContent = answer;
    el.appendChild(slot);
  }
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  return el;
}

describe('<sim-practice-question>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders prompt + attempt textarea + Show-answer button; reveal block hidden', async () => {
    const el = await mount();
    const prompt = el.shadowRoot.querySelector('.sim-practice__prompt');
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    expect(prompt.textContent).toContain('volume occupied by 0.25 mol');
    expect(textarea).toBeTruthy();
    expect(showBtn.textContent).toBe('Show answer');
    expect(reveal.hidden).toBe(true);
  });

  it('clicking Show answer reveals slot + 3 rating chips', async () => {
    const el = await mount();
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    showBtn.click();
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    expect(reveal.hidden).toBe(false);
    expect(showBtn.disabled).toBe(true);
    expect(chips).toHaveLength(3);
    expect(chips[0].dataset.rating).toBe('got-it');
    expect(chips[1].dataset.rating).toBe('after-reveal');
    expect(chips[2].dataset.rating).toBe('confused');
    expect(chips[0].textContent).toBe('Got it');
    expect(chips[1].textContent).toBe('Got it after reveal');
    expect(chips[2].textContent).toBe('Still confused');
  });

  it('clicking a rating chip records state + sets aria-pressed + emits practice-changed', async () => {
    const el = await mount();
    const events = [];
    document.body.addEventListener('practice-changed', (e) => events.push(e.detail));
    el.shadowRoot.querySelector('.sim-practice__show-answer').click();
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    chips[1].click();
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    expect(chips[2].getAttribute('aria-pressed')).toBe('false');
    expect(el.getState().rating).toBe('after-reveal');
    expect(events.some((e) => e.rating === 'after-reveal')).toBe(true);
  });

  it('attempt + revealed + rating all persist + restore from localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY_P1_SL,
      JSON.stringify({
        attempt: 'V = (0.25 × 8.314 × 250) / 150000 = 0.00346 m^3',
        revealed: true,
        rating: 'got-it',
      })
    );
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    expect(textarea.value).toContain('0.00346');
    expect(reveal.hidden).toBe(false);
    expect(showBtn.disabled).toBe(true);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('level swap force-flushes pending debounce to OLD key, then loads NEW', async () => {
    const _STORAGE_KEY_P1_HL = 'aisc-simengine:practice:s1.5-gas-laws:hl:practice-1';
    localStorage.setItem(
      _STORAGE_KEY_P1_HL,
      JSON.stringify({ attempt: 'hl draft', revealed: false, rating: null })
    );
    const el = await mount({ level: 'sl' });
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    textarea.value = 'sl mid-debounce';
    textarea.dispatchEvent(new Event('input'));
    el.setAttribute('level', 'hl');
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_P1_SL))).toEqual({
      attempt: 'sl mid-debounce',
      revealed: false,
      rating: null,
    });
    expect(textarea.value).toBe('hl draft');
  });

  it('getState() returns { attempt, revealed, rating }', async () => {
    const el = await mount();
    el.shadowRoot.querySelector('.sim-practice__show-answer').click();
    el.shadowRoot.querySelectorAll('.sim-practice__chip')[2].click();
    expect(el.getState()).toEqual({ attempt: '', revealed: true, rating: 'confused' });
  });

  it('restoring revealed=true with no [slot=answer] content logs a console warning', async () => {
    localStorage.setItem(
      STORAGE_KEY_P1_SL,
      JSON.stringify({ attempt: '', revealed: true, rating: null })
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await mount({ answer: null });
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
