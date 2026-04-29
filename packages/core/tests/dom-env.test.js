import { describe, it, expect } from 'vitest';

describe('test environment', () => {
  it('document.createElement creates a real DOM element', () => {
    const el = document.createElement('div');
    el.textContent = 'hello';
    expect(el.tagName).toBe('DIV');
    expect(el.textContent).toBe('hello');
  });

  it('customElements registry is available', () => {
    expect(typeof customElements).toBe('object');
    expect(typeof customElements.define).toBe('function');
  });

  it('shadow DOM supports adopted constructable stylesheets', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(':host { display: block; }');
    root.adoptedStyleSheets = [sheet];
    expect(root.adoptedStyleSheets.length).toBe(1);
  });
});
