/**
 * Reference-counted page scroll lock.
 *
 * The POS can have two overlays open at once — the cart sheet with the actions
 * sheet on top of it — and closing the inner one must not unlock the page while
 * the outer one is still up. Each owner locks under its own token and the page
 * is only released when the last token is gone.
 */

const owners = new Set();
const LOCK_CLASS = "pos-scroll-locked";

function sync() {
	if (typeof document === "undefined" || !document.documentElement) return;
	document.documentElement.classList.toggle(LOCK_CLASS, owners.size > 0);
}

export function lockScroll(token) {
	owners.add(token);
	sync();
}

export function unlockScroll(token) {
	owners.delete(token);
	sync();
}

/** Lock while `active` is true, release otherwise. */
export function setScrollLock(token, active) {
	if (active) {
		lockScroll(token);
	} else {
		unlockScroll(token);
	}
}
