<template>
	<!-- Teleported because on compact layouts this sheet renders inside the cart
	     pane, which is transformed and paint-contained — either of which would
	     make `position: fixed` resolve against that pane instead of the viewport
	     and trap the sheet inside the cart. -->
	<Teleport :to="teleportTo">
		<div class="pos-sheet-root" :class="{ 'pos-sheet-root--open': modelValue }">
			<div
				class="pos-sheet-scrim"
				:class="{ 'pos-sheet-scrim--visible': modelValue }"
				@click="onScrimClick"
			></div>

			<div
				ref="sheet"
				class="pos-sheet"
				:class="[
					`pos-sheet--${size}`,
					{ 'pos-sheet--open': modelValue, 'pos-sheet--dragging': dragging },
				]"
				:style="dragStyle"
				role="dialog"
				:aria-modal="modelValue ? 'true' : 'false'"
				:aria-hidden="modelValue ? 'false' : 'true'"
				:aria-label="title || undefined"
				tabindex="-1"
				@keydown.esc.stop="requestClose('escape')"
				@keydown.tab="trapFocus"
			>
				<!-- Grab handle: the whole header is draggable, but the handle is the
			     affordance. Pointer events (not touch) so a stylus/mouse works too. -->
				<div v-if="dismissible" class="pos-sheet-grip" v-on="dragHandlers">
					<span class="pos-sheet-grip-bar"></span>
				</div>

				<header v-if="title || $slots.header" class="pos-sheet-header">
					<slot name="header">
						<div class="pos-sheet-heading">
							<h2 class="pos-sheet-title pos-truncate">{{ title }}</h2>
							<p v-if="subtitle" class="pos-sheet-subtitle pos-truncate">{{ subtitle }}</p>
						</div>
						<button
							v-if="dismissible"
							type="button"
							class="pos-sheet-close pos-tap pos-hit pos-focusable"
							:aria-label="closeLabel"
							@click="requestClose('button')"
						>
							<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
								<path
									d="M6 6l12 12M18 6L6 18"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					</slot>
				</header>

				<div class="pos-sheet-body pos-scroll" :class="{ 'pos-sheet-body--flush': flush }">
					<slot></slot>
				</div>

				<footer v-if="$slots.footer" class="pos-sheet-footer">
					<slot name="footer"></slot>
				</footer>
			</div>
		</div>
	</Teleport>
</template>

<script>
/**
 * Bottom action sheet used for the compact (mobile / tablet-portrait) checkout.
 *
 * Two things make this different from a plain `v-dialog`:
 *
 *  1. The default slot is never unmounted. The cart lives inside this sheet on
 *     compact layouts, and unmounting it on close would throw away the sale.
 *     Closed state is `visibility: hidden` + an off-screen transform, so the
 *     children keep their size and any ResizeObserver stays accurate — opening
 *     costs one compositor frame, not a re-layout.
 *
 *  2. Drag-to-dismiss follows the finger (see `useSheetDrag`). The gesture only
 *     ever drives a transform, so tracking costs a compositor frame and never
 *     invalidates layout for the cart rendered inside.
 */
import { ref } from "vue";
import { useSheetDrag } from "../../composables/useSheetDrag.js";
import { setScrollLock, unlockScroll } from "../../utils/scrollLock.js";

export default {
	name: "PosActionSheet",
	props: {
		modelValue: { type: Boolean, default: false },
		title: { type: String, default: "" },
		subtitle: { type: String, default: "" },
		/** `auto` hugs content, `tall` fills most of the viewport. */
		size: {
			type: String,
			default: "auto",
			validator: (v) => ["auto", "tall", "full"].includes(v),
		},
		/** Allow scrim click / drag / Escape to close. */
		dismissible: { type: Boolean, default: true },
		/** Remove body padding (for panes that bring their own). */
		flush: { type: Boolean, default: false },
		closeLabel: { type: String, default: "Close" },
		/** Where the sheet is portalled to. Overridable mainly for tests. */
		teleportTo: { type: String, default: "body" },
	},
	emits: ["update:modelValue", "opened", "closed"],
	setup(props, { emit }) {
		const sheet = ref(null);
		const drag = useSheetDrag({
			enabled: () => props.dismissible,
			getHeight: () => sheet.value?.offsetHeight || 0,
			onDismiss: () => emit("update:modelValue", false),
		});
		return { sheet, ...drag };
	},
	data() {
		return { previouslyFocused: null };
	},
	watch: {
		modelValue(open) {
			if (open) {
				this.onOpen();
			} else {
				this.onClose();
			}
		},
	},
	mounted() {
		if (this.modelValue) this.onOpen();
	},
	beforeUnmount() {
		this.releaseScrollLock();
	},
	methods: {
		onOpen() {
			this.previouslyFocused = document.activeElement;
			this.lockScroll();
			this.$nextTick(() => {
				const el = this.$refs.sheet;
				if (!el) return;
				// Prefer the first genuinely interactive child so a cashier can
				// start typing/tapping without an extra hop.
				const target = el.querySelector("[data-autofocus]") || el;
				target.focus({ preventScroll: true });
				this.$emit("opened");
			});
		},

		onClose() {
			this.releaseScrollLock();
			this.cancelDrag();
			const prev = this.previouslyFocused;
			this.previouslyFocused = null;
			if (prev && typeof prev.focus === "function" && document.contains(prev)) {
				prev.focus({ preventScroll: true });
			}
			this.$emit("closed");
		},

		requestClose(source) {
			if (!this.dismissible && source !== "programmatic") return;
			this.$emit("update:modelValue", false);
		},

		onScrimClick() {
			this.requestClose("scrim");
		},

		lockScroll() {
			// Stops the page behind the sheet from scrolling under the finger.
			// Reference counted: a sheet stacked on the cart sheet must not
			// unlock the page when only the inner one closes.
			setScrollLock(this, true);
		},

		releaseScrollLock() {
			unlockScroll(this);
		},

		// ---- Focus trap ------------------------------------------------------

		trapFocus(event) {
			const el = this.$refs.sheet;
			if (!el || !this.modelValue) return;

			const focusable = Array.from(
				el.querySelectorAll(
					'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				),
			).filter((node) => node.offsetParent !== null || node === document.activeElement);

			if (!focusable.length) {
				event.preventDefault();
				el.focus({ preventScroll: true });
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		},
	},
};
</script>

<style scoped>
.pos-sheet-root {
	position: fixed;
	inset: 0;
	z-index: var(--pos-z-sheet);
	/* The root itself never intercepts input; only the scrim and sheet do. */
	pointer-events: none;
}

.pos-sheet-scrim {
	position: absolute;
	inset: 0;
	background: rgba(15, 23, 32, 0.44);
	opacity: 0;
	pointer-events: none;
	transition: opacity var(--pos-dur-base) var(--pos-ease-standard);
	backdrop-filter: blur(2px);
	z-index: var(--pos-z-scrim);
}

.pos-sheet-scrim--visible {
	opacity: 1;
	pointer-events: auto;
}

.pos-sheet {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: var(--pos-z-sheet);
	display: flex;
	flex-direction: column;
	background: var(--pos-card-bg, #fff);
	color: var(--pos-text-primary, #212121);
	border-top-left-radius: var(--pos-radius-xl);
	border-top-right-radius: var(--pos-radius-xl);
	box-shadow: var(--pos-elev-3);
	padding-bottom: var(--pos-safe-bottom);
	/* The keyboard inset is published by useResponsive from visualViewport; a
	   sheet sized purely in vh would run underneath the on-screen keyboard the
	   moment a field inside it takes focus. */
	max-height: calc(var(--pos-sheet-max-height) - var(--pos-keyboard-inset, 0px));

	/* Closed: parked below the fold. `visibility` (not `display`) keeps the
	   subtree measurable so children do not re-layout on open. */
	transform: translate3d(0, 100%, 0);
	visibility: hidden;
	pointer-events: none;
	transition:
		transform var(--pos-dur-slow) var(--pos-ease-out),
		visibility 0s linear var(--pos-dur-slow);
	will-change: transform;
	contain: layout paint;
}

.pos-sheet--open {
	transform: translate3d(0, 0, 0);
	visibility: visible;
	pointer-events: auto;
	transition:
		transform var(--pos-dur-slow) var(--pos-ease-out),
		visibility 0s linear 0s;
}

/* While the finger owns the sheet, transitions would fight the drag. */
.pos-sheet--dragging {
	transition: none;
}

.pos-sheet--tall {
	height: var(--pos-sheet-max-height);
}

.pos-sheet--full {
	height: 100%;
	border-radius: 0;
	padding-top: var(--pos-safe-top);
}

.pos-sheet-grip {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 28px;
	flex: 0 0 auto;
	cursor: grab;
	touch-action: none;
	-webkit-tap-highlight-color: transparent;
}

.pos-sheet--dragging .pos-sheet-grip {
	cursor: grabbing;
}

.pos-sheet-grip-bar {
	width: 44px;
	height: 5px;
	border-radius: var(--pos-radius-pill);
	background: var(--pos-outline, rgba(0, 0, 0, 0.2));
}

.pos-sheet-header {
	display: flex;
	align-items: center;
	gap: var(--pos-gap);
	padding: 4px var(--pos-gutter) 10px;
	flex: 0 0 auto;
	border-bottom: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
}

.pos-sheet-heading {
	min-width: 0;
	flex: 1 1 auto;
}

.pos-sheet-title {
	margin: 0;
	font-size: 1.0625rem;
	font-weight: 650;
	line-height: 1.25;
}

.pos-sheet-subtitle {
	margin: 2px 0 0;
	font-size: 0.8125rem;
	color: var(--pos-text-secondary, #666);
}

.pos-sheet-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: none;
	border-radius: var(--pos-radius-pill);
	background: var(--pos-surface-variant, #f5f5f5);
	color: var(--pos-text-secondary, #666);
	flex: 0 0 auto;
	transition: background-color var(--pos-dur-fast) var(--pos-ease-out);
}

.pos-sheet-close:hover {
	background: var(--pos-hover-bg, rgba(0, 0, 0, 0.06));
}

.pos-sheet-body {
	flex: 1 1 auto;
	min-height: 0;
	padding: var(--pos-gutter);
}

.pos-sheet-body--flush {
	padding: 0;
}

.pos-sheet-footer {
	flex: 0 0 auto;
	padding: var(--pos-gap) var(--pos-gutter);
	border-top: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
	background: var(--pos-card-bg, #fff);
}
</style>
