/**
 * Accessibility helpers used across SimEngine components.
 *
 * Net new (no legacy source). These wrap browser APIs that need real DOM
 * to test meaningfully, so they ship without unit tests in the foundation
 * phase. Component-level tests (Playwright, lands later) will exercise
 * them through real components.
 *
 * Design intent matches the spec §7 a11y requirements: respect reduced
 * motion, announce sim events to screen readers via aria-live, keep focus
 * trapped inside modals/cards/panels, restore focus on close.
 */

let liveRegion = /** @type {HTMLElement | null} */ (null);

/**
 * Whether the user has expressed a preference for reduced motion.
 * Returns false if the matchMedia API is unavailable (e.g., SSR).
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Announce a message to assistive technology via a hidden aria-live region.
 * Region is created lazily on first call and reused thereafter. Idempotent
 * across multiple <sim-engine> instances on the same page.
 *
 * @param {string} message
 * @param {'polite' | 'assertive'} [politeness]
 */
export function announce(message, politeness = 'polite') {
  if (typeof document === 'undefined') return;
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.setAttribute('aria-atomic', 'true');
    Object.assign(liveRegion.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    document.body.appendChild(liveRegion);
  } else if (liveRegion.getAttribute('aria-live') !== politeness) {
    liveRegion.setAttribute('aria-live', politeness);
  }
  // Clear and reset to ensure repeated identical messages are re-announced.
  liveRegion.textContent = '';
  // Slight delay lets assistive tech notice the change.
  setTimeout(() => {
    if (liveRegion) liveRegion.textContent = message;
  }, 50);
}

/**
 * Trap focus inside a container element (e.g., a data card or tweaks
 * panel). Tab cycles within the container; Shift+Tab cycles backwards.
 * Call the returned `release` function to restore default tab order.
 *
 * @param {HTMLElement} element
 * @returns {{ release: () => void }}
 */
export function trapFocus(element) {
  if (!element) return { release: () => {} };

  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = element.querySelectorAll(focusableSelector);
    if (focusables.length === 0) return;
    const first = /** @type {HTMLElement} */ (focusables[0]);
    const last = /** @type {HTMLElement} */ (focusables[focusables.length - 1]);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  element.addEventListener('keydown', onKey);
  return {
    release: () => element.removeEventListener('keydown', onKey),
  };
}

/**
 * Move focus to the given element. No-op if element is null/undefined or
 * has no .focus() method (defensive against edge cases).
 *
 * @param {HTMLElement | null | undefined} element
 */
export function restoreFocusTo(element) {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}
