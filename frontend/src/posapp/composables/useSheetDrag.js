/**
 * Drag-to-dismiss gesture for bottom sheets.
 *
 * Shared by `PosActionSheet` and the compact-layout cart pane so both feel
 * identical. Pointer events are used rather than touch events so a mouse, a
 * stylus and a finger all behave the same way.
 *
 * The transform is exposed as a style object rather than written to the DOM
 * directly; callers bind it while `dragging` is true and let CSS own the
 * transform the rest of the time, so the release still eases.
 */

import { computed, ref } from "vue";

/** A flick this fast dismisses regardless of distance travelled (px per ms). */
const FLICK_VELOCITY = 0.6;
/** A slow drag must cover this fraction of the sheet height to dismiss. */
const DISTANCE_RATIO = 0.33;

export function useSheetDrag({ onDismiss, getHeight, enabled = () => true } = {}) {
	const dragging = ref(false);
	const offset = ref(0);

	let pointerId = null;
	let startY = 0;
	let startTime = 0;
	let lastY = 0;
	let lastTime = 0;

	const reset = () => {
		dragging.value = false;
		offset.value = 0;
		pointerId = null;
	};

	const onPointerDown = (event) => {
		if (!enabled() || (typeof event.button === "number" && event.button > 0)) return;
		pointerId = event.pointerId;
		startY = event.clientY;
		lastY = event.clientY;
		startTime = event.timeStamp;
		lastTime = event.timeStamp;
		dragging.value = true;
		offset.value = 0;
		try {
			event.currentTarget?.setPointerCapture?.(event.pointerId);
		} catch {
			// Capture is an optimisation, not a requirement — a pointer that has
			// already ended cannot be captured, and the gesture still works.
		}
	};

	const onPointerMove = (event) => {
		if (!dragging.value || event.pointerId !== pointerId) return;
		// Downward only: dragging up must not detach the sheet from the edge.
		offset.value = Math.max(0, event.clientY - startY);
		lastY = event.clientY;
		lastTime = event.timeStamp;
	};

	const releaseCapture = (event) => {
		const target = event?.currentTarget;
		// releasePointerCapture throws if the pointer is no longer captured,
		// which is exactly the case after some pointercancel sequences.
		if (target?.hasPointerCapture?.(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
	};

	const onPointerUp = (event) => {
		if (!dragging.value) return;
		if (event && event.pointerId === pointerId) releaseCapture(event);

		const distance = offset.value;
		const elapsed = Math.max(1, lastTime - startTime);
		const velocity = (lastY - startY) / elapsed;
		const height = typeof getHeight === "function" ? getHeight() || 0 : 0;

		reset();

		const flicked = velocity > FLICK_VELOCITY;
		const dragged = height > 0 && distance > height * DISTANCE_RATIO;
		if ((flicked || dragged) && typeof onDismiss === "function") onDismiss();
	};

	/**
	 * A cancelled pointer (the browser took the gesture over, the window lost
	 * focus) is not a dismissal — it must spring the sheet back, not close it.
	 * Routing pointercancel into onPointerUp would close the cart on any
	 * interruption that happened to end low on the screen.
	 */
	const onPointerCancel = (event) => {
		if (!dragging.value) return;
		if (event && event.pointerId === pointerId) releaseCapture(event);
		reset();
	};

	/** Bind with `v-on="dragHandlers"` on the grip element. */
	const dragHandlers = {
		pointerdown: onPointerDown,
		pointermove: onPointerMove,
		pointerup: onPointerUp,
		pointercancel: onPointerCancel,
	};

	const dragStyle = computed(() =>
		dragging.value && offset.value > 0 ? { transform: `translate3d(0, ${offset.value}px, 0)` } : null,
	);

	return { dragging, offset, dragHandlers, dragStyle, cancelDrag: reset };
}
