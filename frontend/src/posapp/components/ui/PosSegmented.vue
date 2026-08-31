<template>
	<div class="pos-segmented" role="group" :aria-label="ariaLabel">
		<!-- A single sliding pill instead of per-option background transitions:
		     one transform, no repaint of the option list. -->
		<span class="pos-segmented-thumb" :style="thumbStyle" aria-hidden="true"></span>

		<button
			v-for="(option, index) in options"
			:key="option.value"
			:ref="(el) => setOptionRef(el, index)"
			type="button"
			class="pos-segmented-option pos-tap pos-focusable"
			:class="{ 'pos-segmented-option--active': option.value === modelValue }"
			:aria-pressed="option.value === modelValue ? 'true' : 'false'"
			@click="select(option.value)"
			@keydown.left.prevent="step(-1)"
			@keydown.right.prevent="step(1)"
		>
			<span class="pos-segmented-label pos-truncate">{{ option.label }}</span>
			<span v-if="option.badge" class="pos-segmented-badge pos-num">{{ option.badge }}</span>
		</button>
	</div>
</template>

<script>
/**
 * Flat pane switcher for compact layouts.
 *
 * Replaces a nested menu with one always-visible row: every destination is one
 * tap away and its hit area is a full segment, which is far harder to miss than
 * a menu item during a fast checkout.
 *
 * Deliberately a group of toggle buttons rather than a `tablist`: the panes it
 * switches are not `tabpanel`s and carry no `aria-controls` relationship, so
 * the tab role would promise a structure that is not there. Arrow keys still
 * move between options as a convenience.
 */
import { useRtl } from "../../composables/useRtl.js";

export default {
	name: "PosSegmented",
	props: {
		modelValue: { type: [String, Number], required: true },
		/** `[{ value, label, badge? }]` */
		options: { type: Array, required: true },
		ariaLabel: { type: String, default: "" },
	},
	emits: ["update:modelValue"],
	setup() {
		const { isRtl } = useRtl();
		return { isRtl };
	},
	created() {
		// Plain instance property, not `data`: putting DOM nodes into reactive
		// state makes Vue proxy them, which is both wasteful and surprising.
		this.optionEls = [];
	},
	computed: {
		activeIndex() {
			const index = this.options.findIndex((o) => o.value === this.modelValue);
			return index === -1 ? 0 : index;
		},
		thumbStyle() {
			const count = Math.max(1, this.options.length);
			// Transforms are physical, not logical: under RTL the options run
			// right-to-left while a positive translateX still moves right, so the
			// pill would slide away from the option it tracks.
			const direction = this.isRtl ? -1 : 1;
			// A percentage width on an absolutely positioned child resolves
			// against the *padding* box, so the container's 4px inset has to be
			// taken out by hand or the pill overhangs the option it tracks.
			return {
				width: `calc((100% - 8px) / ${count})`,
				transform: `translate3d(${this.activeIndex * 100 * direction}%, 0, 0)`,
			};
		},
	},
	methods: {
		setOptionRef(el, index) {
			if (el) this.optionEls[index] = el;
		},
		select(value) {
			if (value === this.modelValue) return;
			this.$emit("update:modelValue", value);
		},
		step(direction) {
			const next = (this.activeIndex + direction + this.options.length) % this.options.length;
			this.select(this.options[next].value);
			this.$nextTick(() => this.optionEls[next]?.focus());
		},
	},
};
</script>

<style scoped>
.pos-segmented {
	position: relative;
	display: flex;
	align-items: stretch;
	padding: 4px;
	gap: 0;
	border-radius: var(--pos-radius-pill);
	background: var(--pos-surface-variant, #f0f2f4);
	isolation: isolate;
	contain: layout paint;
}

.pos-segmented-thumb {
	position: absolute;
	top: 4px;
	bottom: 4px;
	inset-inline-start: 4px;
	/* Width is set inline so it can be divided by the option count. */
	border-radius: var(--pos-radius-pill);
	background: var(--pos-card-bg, #fff);
	box-shadow: var(--pos-elev-1);
	transition: transform var(--pos-dur-base) var(--pos-ease-out);
	z-index: 0;
	will-change: transform;
}

.pos-segmented-option {
	position: relative;
	z-index: 1;
	flex: 1 1 0;
	min-width: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-height: calc(var(--pos-hit-min) - 8px);
	padding: 0 12px;
	border: none;
	background: transparent;
	border-radius: var(--pos-radius-pill);
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--pos-text-secondary, #666);
	transition: color var(--pos-dur-fast) var(--pos-ease-out);
}

.pos-segmented-option--active {
	color: var(--pos-primary, #0097a7);
}

.pos-segmented-label {
	line-height: 1;
}

.pos-segmented-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 20px;
	height: 20px;
	padding: 0 6px;
	border-radius: var(--pos-radius-pill);
	font-size: 0.6875rem;
	font-weight: 700;
	background: var(--pos-primary, #0097a7);
	color: var(--pos-on-primary, #fff);
}
</style>
