<template>
	<button
		type="button"
		class="pos-hold pos-tap pos-focusable"
		:class="[`pos-hold--${tone}`, { 'pos-hold--armed': holding, 'pos-hold--busy': loading }]"
		:style="{ '--pos-hold-duration': `${duration}ms` }"
		:disabled="disabled || loading"
		:aria-label="ariaLabel || label"
		:aria-describedby="`${uid}-hint`"
		@pointerdown="start"
		@pointerup="cancel"
		@pointerleave="cancel"
		@pointercancel="cancel"
		@keydown.space.prevent="start"
		@keydown.enter.prevent="start"
		@keyup.space.prevent="cancel"
		@keyup.enter.prevent="cancel"
		@contextmenu.prevent
	>
		<span class="pos-hold-fill" aria-hidden="true"></span>
		<span class="pos-hold-content">
			<slot name="icon"></slot>
			<span class="pos-hold-label pos-truncate">{{ holding ? holdingLabel : label }}</span>
		</span>
		<span :id="`${uid}-hint`" class="pos-sr-only">{{ hint }}</span>
	</button>
</template>

<script>
let uidCounter = 0;

/**
 * Press-and-hold confirmation for irreversible actions (Cancel Sale, void).
 *
 * A confirmation dialog is the usual answer, but at a busy till a dialog is two
 * extra taps and it trains the cashier to confirm reflexively. Holding is one
 * gesture that a stray tap cannot complete, and it stays out of the way of the
 * primary flow entirely.
 *
 * The progress fill is a CSS transition driven by a single class toggle, not a
 * requestAnimationFrame loop writing to reactive state — the browser animates
 * `scaleX` off the main thread and Vue renders twice per gesture instead of
 * once per frame.
 */
export default {
	name: "PosHoldButton",
	props: {
		label: { type: String, required: true },
		holdingLabel: { type: String, default: "Keep holding…" },
		/** Milliseconds the control must be held before it fires. */
		duration: { type: Number, default: 650 },
		tone: {
			type: String,
			default: "danger",
			validator: (v) => ["danger", "neutral", "warning"].includes(v),
		},
		disabled: { type: Boolean, default: false },
		loading: { type: Boolean, default: false },
		ariaLabel: { type: String, default: "" },
		hint: { type: String, default: "Press and hold to confirm." },
	},
	emits: ["confirm"],
	data() {
		return {
			uid: `pos-hold-${(uidCounter += 1)}`,
			holding: false,
		};
	},
	created() {
		// Plain instance property: a timer id in reactive state would trigger a
		// render every time the gesture starts or stops.
		this.timer = null;
	},
	beforeUnmount() {
		this.clearTimer();
	},
	methods: {
		start(event) {
			if (this.disabled || this.loading || this.holding) return;
			// Ignore secondary mouse buttons; `button` is absent on key events.
			if (event && typeof event.button === "number" && event.button > 0) return;

			this.holding = true;
			// Short haptic tick where supported — confirms the hold registered.
			navigator.vibrate?.(8);

			this.timer = setTimeout(this.fire, this.duration);
		},

		fire() {
			this.clearTimer();
			this.holding = false;
			navigator.vibrate?.([12, 40, 12]);
			this.$emit("confirm");
		},

		cancel() {
			if (!this.holding) return;
			this.clearTimer();
			this.holding = false;
		},

		clearTimer() {
			if (this.timer) {
				clearTimeout(this.timer);
				this.timer = null;
			}
		},
	},
};
</script>

<style scoped>
.pos-hold {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	min-height: var(--pos-hit-min);
	padding: 0 14px;
	border: 1px solid transparent;
	border-radius: var(--pos-radius-sm);
	font-size: 0.875rem;
	font-weight: 600;
	overflow: hidden;
	isolation: isolate;
	transition:
		background-color var(--pos-dur-fast) var(--pos-ease-out),
		border-color var(--pos-dur-fast) var(--pos-ease-out);
}

.pos-hold:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.pos-hold--danger {
	background: var(--pos-error-container, #fdeaea);
	border-color: rgba(232, 102, 116, 0.35);
	border-color: color-mix(in srgb, var(--pos-error, #e86674) 35%, transparent);
	color: var(--pos-error, #e86674);
}

.pos-hold--warning {
	background: var(--pos-warning-container, #fff3e0);
	border-color: rgba(255, 152, 0, 0.35);
	border-color: color-mix(in srgb, var(--pos-warning, #ff9800) 35%, transparent);
	color: var(--pos-warning, #ff9800);
}

.pos-hold--neutral {
	background: var(--pos-surface-variant, #f5f5f5);
	border-color: var(--pos-border, rgba(0, 0, 0, 0.12));
	color: var(--pos-text-primary, #212121);
}

/* Sweeps across as the hold progresses. `scaleX` only, so the whole gesture is
 * a compositor animation: no layout, no paint, no per-frame JS.
 * Origin follows writing direction so the fill runs the way text reads. */
.pos-hold-fill {
	position: absolute;
	inset: 0;
	transform-origin: left center;
	transform: scaleX(0);
	background: currentColor;
	opacity: 0.18;
	z-index: 0;
	pointer-events: none;
	/* Release snaps back quickly; only the arming direction takes `duration`. */
	transition: transform var(--pos-dur-fast) var(--pos-ease-out);
}

[dir="rtl"] .pos-hold-fill {
	transform-origin: right center;
}

.pos-hold--armed .pos-hold-fill {
	transform: scaleX(1);
	transition: transform var(--pos-hold-duration, 650ms) linear;
}

.pos-hold--armed .pos-hold-label {
	letter-spacing: 0.01em;
}

.pos-hold-content {
	position: relative;
	z-index: 1;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.pos-hold--busy {
	cursor: progress;
}

/* With motion reduced the sweep conveys nothing, but the hold must still take
 * the full duration — it is a safety delay, not decoration. */
@media (prefers-reduced-motion: reduce) {
	.pos-hold-fill,
	.pos-hold--armed .pos-hold-fill {
		transition: none;
	}

	.pos-hold--armed .pos-hold-fill {
		transform: scaleX(1);
	}
}
</style>
