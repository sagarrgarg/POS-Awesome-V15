<template>
	<section class="pos-checkout" :class="{ 'pos-checkout--compact': isCompact }">
		<!-- ---- Figures ---------------------------------------------------- -->
		<!-- Read-only numbers are text, not disabled inputs: nothing here looks
		     tappable, and the eye lands on the total first. -->
		<div class="pos-checkout-figures">
			<div class="pos-figure">
				<span class="pos-figure-label">{{ __("Items") }}</span>
				<span class="pos-figure-value pos-num">{{ qtyDisplay }}</span>
			</div>

			<div class="pos-figure">
				<span class="pos-figure-label">{{ __("Item discounts") }}</span>
				<span
					class="pos-figure-value pos-num"
					:class="{ 'pos-figure-value--muted': !hasItemDiscount }"
				>
					{{ itemDiscountDisplay }}
				</span>
			</div>

			<label class="pos-figure pos-figure--editable">
				<span class="pos-figure-label">
					{{ usePercentageDiscount ? __("Discount %") : __("Discount") }}
				</span>
				<span class="pos-discount-input" :class="{ 'pos-discount-input--locked': discountLocked }">
					<span v-if="!usePercentageDiscount" class="pos-discount-affix">
						{{ currencySymbol(pos_profile.currency) }}
					</span>
					<!-- Native input: the value is echoed back on the very next
					     frame, with no component layer between key and paint. -->
					<input
						class="pos-discount-field pos-num"
						type="text"
						inputmode="decimal"
						autocomplete="off"
						:value="discountValue"
						:disabled="discountLocked"
						:aria-label="
							usePercentageDiscount
								? __('Additional discount percent')
								: __('Additional discount')
						"
						@input="onDiscountInput"
						@change="onDiscountCommit"
					/>
					<span v-if="usePercentageDiscount" class="pos-discount-affix">%</span>
				</span>
			</label>
		</div>

		<!-- ---- Total ------------------------------------------------------- -->
		<div class="pos-checkout-total">
			<span class="pos-checkout-total-label">{{ __("Total") }}</span>
			<!-- Re-keyed on value so the emphasis animation replays on change. -->
			<span :key="totalDisplay" class="pos-checkout-total-value pos-num">
				<span class="pos-checkout-total-symbol">{{ currencySymbol(displayCurrency) }}</span>
				{{ totalDisplay }}
			</span>
		</div>

		<!-- ---- Secondary actions ------------------------------------------- -->
		<div class="pos-checkout-actions">
			<button
				v-for="action in inlineActions"
				:key="action.key"
				type="button"
				class="pos-action pos-tap pos-press pos-focusable"
				:class="`pos-action--${action.tone}`"
				:disabled="isBusy(action.key)"
				@click="trigger(action)"
			>
				<v-icon size="18" class="pos-action-icon">{{ action.icon }}</v-icon>
				<span class="pos-action-label pos-truncate">{{ action.label }}</span>
			</button>

			<!-- Always rendered: even with no overflow actions the sheet is the
			     only route to Cancel Sale. -->
			<button
				type="button"
				class="pos-action pos-action--neutral pos-tap pos-press pos-focusable"
				:aria-label="__('More actions')"
				aria-haspopup="dialog"
				:aria-expanded="moreOpen ? 'true' : 'false'"
				@click="moreOpen = true"
			>
				<v-icon size="18" class="pos-action-icon">mdi-dots-horizontal</v-icon>
				<span class="pos-action-label pos-truncate">{{ __("More") }}</span>
			</button>
		</div>

		<!-- ---- Primary action ---------------------------------------------- -->
		<!-- Isolated by a hard gap and taller than everything else: the one
		     control a cashier can hit without looking. -->
		<div class="pos-checkout-primary">
			<button
				type="button"
				class="pos-pay pos-tap pos-press pos-focusable"
				:disabled="isBusy('pay')"
				@click="trigger(payAction)"
			>
				<v-icon size="22" class="pos-pay-icon">mdi-credit-card-outline</v-icon>
				<span>{{ __("PAY") }}</span>
				<span v-if="totalDisplay" class="pos-pay-amount pos-num">
					{{ currencySymbol(displayCurrency) }}{{ totalDisplay }}
				</span>
			</button>
		</div>

		<!-- ---- Overflow sheet ----------------------------------------------- -->
		<!-- One level deep, one tap in, everything visible at once. -->
		<PosActionSheet v-model="moreOpen" :title="__('Actions')" :close-label="__('Close')">
			<div class="pos-sheet-actions">
				<button
					v-for="action in overflowActions"
					:key="action.key"
					type="button"
					class="pos-sheet-action pos-tap pos-press pos-focusable"
					:disabled="isBusy(action.key)"
					@click="triggerFromSheet(action)"
				>
					<v-icon size="22" class="pos-sheet-action-icon">{{ action.icon }}</v-icon>
					<span class="pos-sheet-action-label">{{ action.label }}</span>
				</button>
			</div>

			<template #footer>
				<!-- Carried over from the confirmation dialog this hold replaces,
				     so the cashier still sees the non-destructive alternative. -->
				<p class="pos-sheet-note">
					{{ __("This deletes the current sale. Use Save & Clear to keep it as a draft.") }}
				</p>
				<!-- Destructive action lives only here, needs a deliberate hold,
				     and is never adjacent to PAY. A 650ms gesture is harder to
				     trigger by accident than a dialog is to dismiss by reflex, so
				     it commits directly rather than opening a second confirm. -->
				<PosHoldButton
					:label="__('Cancel Sale')"
					:holding-label="__('Hold to cancel…')"
					:hint="__('Press and hold to discard this sale.')"
					tone="danger"
					:disabled="isBusy('cancel')"
					@confirm="confirmCancel"
				>
					<template #icon>
						<v-icon size="18">mdi-close-circle-outline</v-icon>
					</template>
				</PosHoldButton>
			</template>
		</PosActionSheet>
	</section>
</template>

<script>
/* global __ */
import PosActionSheet from "../ui/PosActionSheet.vue";
import PosHoldButton from "../ui/PosHoldButton.vue";
import { useBreakpoints } from "../../composables/useBreakpoints.js";

/**
 * Strip everything that is not a digit or the first decimal point.
 *
 * Splitting on "." rather than a regex on purpose: a single global replace
 * cannot reliably collapse repeated separators ("1.2.3.4" survives it as
 * "1.2.34"), because the greedy match consumes past the remaining dots.
 */
function sanitizeDecimal(raw) {
	const parts = String(raw)
		.replace(/[^0-9.]/g, "")
		.split(".");
	return parts.length > 1 ? `${parts.shift()}.${parts.join("")}` : parts[0];
}

/** Window during which a repeated tap on the same action is swallowed. */
const REPEAT_GUARD_MS = 450;
/* Long enough to swallow a double tap, short enough that a cashier who fixes a
   validation error ("select a customer") can retry immediately. */
const PAY_GUARD_MS = 500;

export default {
	name: "InvoiceSummary",
	components: { PosActionSheet, PosHoldButton },
	props: {
		pos_profile: Object,
		total_qty: [Number, String],
		// Strings: the discount field emits raw text while the cashier types, so
		// declaring these Number-only produced a prop warning on every keystroke.
		additional_discount: [Number, String],
		additional_discount_percentage: [Number, String],
		total_items_discount_amount: Number,
		subtotal: Number,
		displayCurrency: String,
		formatFloat: Function,
		formatCurrency: Function,
		currencySymbol: Function,
		discount_percentage_offer_name: [String, Number],
		isNumber: Function,
	},
	emits: [
		"update:additional_discount",
		"update:additional_discount_percentage",
		"update_discount_umount",
		"save-and-clear",
		"load-drafts",
		"select-order",
		"cancel-sale",
		"cancel-sale-confirmed",
		"open-returns",
		"print-draft",
		"apply-offers",
		"show-payment",
	],
	setup() {
		const { isCompact } = useBreakpoints();
		return { isCompact };
	},
	data() {
		return {
			moreOpen: false,
			/** Action key currently within its repeat-guard window. */
			busyKey: null,
		};
	},
	created() {
		// Plain instance property: a timer id does not belong in reactive state.
		this.busyTimer = null;
	},
	computed: {
		hide_qty_decimals() {
			try {
				const saved = localStorage.getItem("posawesome_item_selector_settings");
				if (saved) {
					const opts = JSON.parse(saved);
					return !!opts.hide_qty_decimals;
				}
			} catch (e) {
				console.error("Failed to load item selector settings:", e);
			}
			return false;
		},

		qtyDisplay() {
			return this.formatFloat(this.total_qty, this.hide_qty_decimals ? 0 : undefined);
		},

		totalDisplay() {
			return this.formatCurrency(this.subtotal);
		},

		hasItemDiscount() {
			return Number(this.total_items_discount_amount) > 0;
		},

		itemDiscountDisplay() {
			const amount = this.formatCurrency(this.total_items_discount_amount);
			const symbol = this.currencySymbol(this.displayCurrency);
			return this.hasItemDiscount ? `-${symbol}${amount}` : `${symbol}${amount}`;
		},

		usePercentageDiscount() {
			return !!this.pos_profile.posa_use_percentage_discount;
		},

		discountValue() {
			return this.usePercentageDiscount
				? this.additional_discount_percentage
				: this.additional_discount;
		},

		discountLocked() {
			return (
				!this.pos_profile.posa_allow_user_to_edit_additional_discount ||
				!!this.discount_percentage_offer_name
			);
		},

		payAction() {
			return { key: "pay", event: "show-payment", guard: PAY_GUARD_MS };
		},

		/** Every secondary action the current profile allows, most-used first. */
		availableActions() {
			const profile = this.pos_profile || {};
			return [
				{
					key: "save",
					label: __("Save & Clear"),
					icon: "mdi-content-save-outline",
					event: "save-and-clear",
					tone: "accent",
					enabled: true,
				},
				{
					key: "drafts",
					label: __("Drafts"),
					icon: "mdi-file-document-outline",
					event: "load-drafts",
					tone: "warning",
					enabled: true,
				},
				{
					key: "offers",
					label: __("Offers"),
					icon: "mdi-tag-outline",
					event: "apply-offers",
					tone: "info",
					enabled: true,
				},
				{
					key: "order",
					label: __("Select S.O"),
					icon: "mdi-book-search-outline",
					event: "select-order",
					tone: "info",
					enabled: profile.custom_allow_select_sales_order == 1,
				},
				{
					key: "returns",
					label: __("Sales Return"),
					icon: "mdi-backup-restore",
					event: "open-returns",
					tone: "secondary",
					enabled: profile.posa_allow_return == 1,
				},
				{
					key: "print",
					label: __("Print Draft"),
					icon: "mdi-printer-outline",
					event: "print-draft",
					tone: "primary",
					enabled: !!profile.posa_allow_print_draft_invoices,
				},
			].filter((action) => action.enabled);
		},

		/**
		 * How many actions stay on the bar. Narrow layouts keep only the two
		 * highest-traffic ones so each keeps a comfortable target; the rest move
		 * one tap away rather than shrinking into a mis-tap hazard.
		 */
		inlineCapacity() {
			// Four inline tiles plus "More" left ~100px each in the cart pane at
			// 1024px, which ellipsised every label. Three keeps them readable.
			return this.isCompact ? 2 : 3;
		},

		inlineActions() {
			// The "More" tile is always present, so it always claims a slot.
			return this.availableActions.slice(0, this.inlineCapacity);
		},

		overflowActions() {
			return this.availableActions.slice(this.inlineActions.length);
		},

		/** Broadcast for the compact checkout dock rendered by the POS shell. */
		cartSummary() {
			return {
				count: Number(this.total_qty) || 0,
				total: `${this.currencySymbol(this.displayCurrency)}${this.totalDisplay}`,
			};
		},
	},
	watch: {
		cartSummary: {
			immediate: true,
			handler(summary) {
				this.eventBus.emit("update_cart_summary", summary);
			},
		},
	},
	beforeUnmount() {
		if (this.busyTimer) clearTimeout(this.busyTimer);
		this.eventBus.emit("update_cart_summary", { count: 0, total: "" });
	},
	methods: {
		isBusy(key) {
			return this.busyKey === key;
		},

		/**
		 * Fire an action once. During a fast checkout a button can easily take
		 * two taps before the UI has moved on; the guard swallows the second
		 * rather than submitting the sale twice.
		 */
		trigger(action) {
			if (this.busyKey) return;
			this.busyKey = action.key;
			this.$emit(action.event);

			if (this.busyTimer) clearTimeout(this.busyTimer);
			this.busyTimer = setTimeout(() => {
				this.busyKey = null;
				this.busyTimer = null;
			}, action.guard || REPEAT_GUARD_MS);
		},

		triggerFromSheet(action) {
			this.moreOpen = false;
			this.trigger(action);
		},

		confirmCancel() {
			this.moreOpen = false;
			this.trigger({ key: "cancel", event: "cancel-sale-confirmed" });
		},

		/**
		 * Keep the field numeric.
		 *
		 * The old Vuetify field validated with a rule, which only painted an
		 * error after the fact. Here the character never lands: anything that is
		 * not a digit or a single decimal point is stripped and the caret is put
		 * back where it was, so typing is uninterrupted.
		 */
		onDiscountInput(event) {
			const el = event.target;
			const raw = String(el.value);
			const clean = sanitizeDecimal(raw);

			if (clean !== raw) {
				// Sanitising the text *before* the caret gives its new index
				// exactly, rather than assuming everything dropped came after it.
				const caretSource = el.selectionStart ?? raw.length;
				const caret = sanitizeDecimal(raw.slice(0, caretSource)).length;
				el.value = clean;
				try {
					el.setSelectionRange(caret, caret);
				} catch {
					// Some mobile keyboards reject programmatic selection; the
					// value is still corrected, which is what matters.
				}
			}

			if (this.usePercentageDiscount) {
				this.$emit("update:additional_discount_percentage", clean);
			} else {
				this.$emit("update:additional_discount", clean);
			}
		},

		onDiscountCommit() {
			if (this.usePercentageDiscount) {
				this.$emit("update_discount_umount");
			}
		},
	},
};
</script>

<style scoped>
.pos-checkout {
	display: flex;
	flex-direction: column;
	gap: var(--pos-gap);
	margin-top: var(--pos-gap);
	padding: var(--pos-gutter);
	background: var(--pos-card-bg, #fff);
	border: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
	border-radius: var(--pos-radius-md);
	box-shadow: var(--pos-elev-1);
}

/* ---- Figures ------------------------------------------------------------ */

.pos-checkout-figures {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--pos-gap);
}

.pos-figure {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.pos-figure-label {
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--pos-text-secondary, #666);
}

.pos-figure-value {
	font-size: 1.0625rem;
	font-weight: 650;
	color: var(--pos-text-primary, #212121);
}

.pos-figure-value--muted {
	color: var(--pos-text-disabled, #9e9e9e);
	font-weight: 500;
}

.pos-figure--editable {
	cursor: text;
}

.pos-discount-input {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	min-height: 34px;
	padding: 0 8px;
	border: 1px solid var(--pos-border, rgba(0, 0, 0, 0.12));
	border-radius: var(--pos-radius-xs);
	background: var(--pos-input-bg, #f5f5f5);
	transition:
		border-color var(--pos-dur-fast) var(--pos-ease-out),
		box-shadow var(--pos-dur-fast) var(--pos-ease-out);
}

.pos-discount-input:focus-within {
	border-color: var(--pos-primary, #0097a7);
	box-shadow: var(--pos-focus-ring);
}

.pos-discount-input--locked {
	opacity: 0.55;
}

.pos-discount-affix {
	font-size: 0.8125rem;
	color: var(--pos-text-secondary, #666);
	flex: 0 0 auto;
}

.pos-discount-field {
	flex: 1 1 auto;
	min-width: 0;
	width: 100%;
	border: none;
	outline: none;
	background: transparent;
	color: var(--pos-text-primary, #212121);
	font-size: 1rem;
	font-weight: 600;
}

/* ---- Total -------------------------------------------------------------- */

.pos-checkout-total {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--pos-gap);
	padding: 10px 12px;
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-variant, #f5f7f8);
}

.pos-checkout-total-label {
	font-size: 0.75rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--pos-text-secondary, #666);
}

.pos-checkout-total-value {
	font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.125rem);
	font-weight: 750;
	line-height: 1.05;
	color: var(--pos-text-primary, #212121);
	animation: pos-pop var(--pos-dur-slow) var(--pos-ease-spring);
}

.pos-checkout-total-symbol {
	font-size: 0.6em;
	font-weight: 600;
	color: var(--pos-text-secondary, #666);
	margin-inline-end: 2px;
}

/* ---- Secondary actions --------------------------------------------------- */

.pos-checkout-actions {
	display: grid;
	grid-auto-flow: column;
	grid-auto-columns: minmax(0, 1fr);
	gap: var(--pos-gap);
}

.pos-action {
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 3px;
	min-height: var(--pos-hit-comfortable);
	padding: 6px 8px;
	min-width: 0;
	border: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-variant, #f5f5f5);
	color: var(--pos-text-primary, #212121);
	font-size: 0.75rem;
	font-weight: 600;
}

.pos-action:disabled {
	opacity: 0.55;
	cursor: not-allowed;
}

.pos-action-label {
	max-width: 100%;
	line-height: 1.1;
}

.pos-action--accent {
	color: var(--pos-accent, #ff6b35);
}
.pos-action--warning {
	color: var(--pos-warning, #ff9800);
}
.pos-action--info {
	color: var(--pos-info, #2196f3);
}
.pos-action--primary {
	color: var(--pos-primary, #0097a7);
}
.pos-action--secondary {
	color: var(--pos-secondary, #00bcd4);
}
.pos-action--neutral {
	color: var(--pos-text-secondary, #666);
}

/* ---- Primary action ------------------------------------------------------ */

.pos-checkout-primary {
	/* Dead space above PAY. A tap that overshoots the action row lands here
	   instead of on the most consequential button on the screen. */
	margin-top: var(--pos-danger-gap);
}

.pos-pay {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	width: 100%;
	min-height: var(--pos-hit-primary);
	border: none;
	border-radius: var(--pos-radius-sm);
	/* Flat fill first. Without color-mix() support the gradient declaration is
	   dropped wholesale, and the most important button on the screen would
	   otherwise render with no background at all. */
	background: var(--pos-success, #66bb6a);
	background: linear-gradient(
		135deg,
		var(--pos-success, #66bb6a),
		color-mix(in srgb, var(--pos-success, #66bb6a) 78%, #000)
	);
	color: #fff;
	font-size: 1.125rem;
	font-weight: 750;
	letter-spacing: 0.06em;
	box-shadow: 0 6px 18px rgba(76, 175, 80, 0.32);
	box-shadow: 0 6px 18px color-mix(in srgb, var(--pos-success, #66bb6a) 32%, transparent);
}

.pos-pay:disabled {
	opacity: 0.6;
	cursor: progress;
}

.pos-pay-amount {
	font-size: 1rem;
	font-weight: 650;
	letter-spacing: 0;
	opacity: 0.92;
	padding-inline-start: 10px;
	border-inline-start: 1px solid rgba(255, 255, 255, 0.35);
}

/* ---- Overflow sheet ------------------------------------------------------ */

.pos-sheet-actions {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: var(--pos-gap);
}

.pos-sheet-action {
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: var(--pos-hit-comfortable);
	padding: 0 14px;
	border: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-variant, #f5f5f5);
	color: var(--pos-text-primary, #212121);
	font-size: 0.9375rem;
	font-weight: 600;
	text-align: start;
}

.pos-sheet-note {
	margin: 0 0 var(--pos-gap);
	font-size: 0.8125rem;
	line-height: 1.4;
	color: var(--pos-text-secondary, #666);
}

.pos-sheet-action-icon {
	flex: 0 0 auto;
	color: var(--pos-primary, #0097a7);
}

/* ---- Compact ------------------------------------------------------------- */

.pos-checkout--compact .pos-checkout-figures {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pos-checkout--compact .pos-figure--editable {
	grid-column: 1 / -1;
}

@media (prefers-reduced-motion: reduce) {
	.pos-checkout-total-value {
		animation: none;
	}
}
</style>
