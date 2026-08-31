<template>
	<div
		class="pos-shell pos-main-container"
		:class="[rtlClasses, shellClasses]"
		:style="[responsiveStyles, rtlStyles]"
	>
		<ClosingDialog></ClosingDialog>
		<Drafts></Drafts>
		<SalesOrders></SalesOrders>
		<Returns></Returns>
		<NewAddress></NewAddress>
		<MpesaPayments></MpesaPayments>
		<Variants></Variants>
		<OpeningDialog v-if="dialog" :dialog="dialog"></OpeningDialog>

		<!-- Everything below is hidden, never unmounted, while the opening voucher
		     dialog is up: these panes hold the open sale and are subscribed to
		     the bus events the dialog itself emits on close. -->
		<div v-show="!dialog && isCompact && !payment" class="pos-shell-switch">
			<PosSegmented
				:model-value="browsePane"
				:options="browseOptions"
				:aria-label="__('Choose panel')"
				@update:model-value="setBrowsePane"
			/>
		</div>

		<div v-show="!dialog" class="pos-shell-grid">
			<!-- Browse column: items, or whichever pane has taken it over. -->
			<section class="pos-pane pos-pane--browse" :aria-label="__('Item selection')">
				<div v-show="!payment && !showOffers && !coupons" class="pos-pane-slot">
					<ItemsSelector></ItemsSelector>
				</div>
				<div v-show="showOffers" class="pos-pane-slot">
					<PosOffers></PosOffers>
				</div>
				<div v-show="coupons" class="pos-pane-slot">
					<PosCoupons></PosCoupons>
				</div>
				<div v-show="payment" class="pos-pane-slot">
					<Payments></Payments>
				</div>
			</section>

			<!-- Cart column. On compact layouts the very same element becomes a
			     floating sheet — it is never re-parented or unmounted, so the
			     open sale survives every rotation and resize. -->
			<section
				ref="cartPane"
				class="pos-pane pos-pane--cart"
				:class="{ 'pos-pane--sheet': isCompact, 'pos-pane--sheet-open': isCompact && cartOpen }"
				:style="isCompact ? dragStyle : null"
				:aria-label="__('Cart')"
				:role="isCompact ? 'dialog' : undefined"
				:aria-modal="isCompact && cartOpen ? 'true' : undefined"
				:aria-hidden="isCompact && !cartOpen ? 'true' : 'false'"
				@keydown.esc="closeCart"
			>
				<div v-if="isCompact" class="pos-cart-grip" v-on="dragHandlers">
					<span class="pos-cart-grip-bar"></span>
				</div>
				<Invoice></Invoice>
			</section>
		</div>

		<!-- Scrim for the compact cart sheet. -->
		<div
			v-if="isCompact && !dialog"
			class="pos-cart-scrim"
			:class="{ 'pos-cart-scrim--visible': cartOpen }"
			@click="closeCart"
		></div>

		<!-- Persistent checkout dock. One row, three fixed slots, no menus:
		     the cashier's thumb learns exactly one set of positions. -->
		<div
			v-if="isCompact && !dialog"
			class="pos-dock"
			:class="{ 'pos-dock--hidden': cartOpen || payment }"
		>
			<button
				type="button"
				class="pos-dock-cart pos-tap pos-press pos-focusable"
				:aria-label="__('View cart')"
				@click="openCart"
			>
				<span class="pos-dock-cart-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="24" height="24">
						<path
							d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.55L20.5 8H6.2"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="10" cy="20" r="1.4" fill="currentColor" />
						<circle cx="17" cy="20" r="1.4" fill="currentColor" />
					</svg>
					<span v-if="cartCount" class="pos-dock-badge pos-num" :key="cartCount">
						{{ cartCount }}
					</span>
				</span>
			</button>

			<div class="pos-dock-total">
				<span class="pos-dock-total-label">{{ __("Total") }}</span>
				<span class="pos-dock-total-value pos-num pos-truncate">{{ cartTotalDisplay }}</span>
			</div>

			<button
				type="button"
				class="pos-dock-pay pos-tap pos-press pos-focusable"
				:disabled="!cartCount"
				@click="requestPayment"
			>
				{{ __("PAY") }}
			</button>
		</div>
	</div>
</template>

<script>
/* global __, frappe */
import ItemsSelector from "./ItemsSelector.vue";
import Invoice from "./Invoice.vue";
import OpeningDialog from "./OpeningDialog.vue";
import Payments from "./Payments.vue";
import PosOffers from "./PosOffers.vue";
import PosCoupons from "./PosCoupons.vue";
import Drafts from "./Drafts.vue";
import SalesOrders from "./SalesOrders.vue";
import ClosingDialog from "./ClosingDialog.vue";
import NewAddress from "./NewAddress.vue";
import Variants from "./Variants.vue";
import Returns from "./Returns.vue";
import MpesaPayments from "./Mpesa-Payments.vue";
import PosSegmented from "../ui/PosSegmented.vue";
import { getCurrentInstance, ref } from "vue";
import { usePosShift } from "../../composables/usePosShift.js";
import { useOffers } from "../../composables/useOffers.js";
// Import the cache cleanup function
import { clearExpiredCustomerBalances } from "../../../offline/index.js";
import { useResponsive } from "../../composables/useResponsive.js";
import { useRtl } from "../../composables/useRtl.js";
import { useSheetDrag } from "../../composables/useSheetDrag.js";
import { setScrollLock, unlockScroll } from "../../utils/scrollLock.js";
import { useCustomersStore } from "../../stores/customersStore.js";
import { storeToRefs } from "pinia";

export default {
	setup() {
		const instance = getCurrentInstance();
		const responsive = useResponsive();
		const rtl = useRtl();
		const shift = usePosShift(() => {
			if (instance && instance.proxy) {
				instance.proxy.dialog = true;
			}
		});
		const offers = useOffers();

		const cartPane = ref(null);
		const cartOpen = ref(false);
		const cartDrag = useSheetDrag({
			enabled: () => responsive.isCompact.value && cartOpen.value,
			getHeight: () => cartPane.value?.offsetHeight || 0,
			onDismiss: () => {
				cartOpen.value = false;
			},
		});

		return { ...responsive, ...rtl, ...shift, ...offers, cartPane, cartOpen, ...cartDrag };
	},
	data: function () {
		return {
			dialog: false,

			payment: false,
			showOffers: false,
			coupons: false,
			itemsLoaded: false,
			customersLoaded: false,
			// Mirrored from the invoice so the dock can render a total without
			// reaching into the Invoice component.
			cartCount: 0,
			cartTotalDisplay: "",
			// Badge counts for the compact pane switch, kept in sync with the
			// same bus events the item selector listens to.
			offersCount: 0,
			couponsCount: 0,
		};
	},

	components: {
		ItemsSelector,
		Invoice,
		OpeningDialog,
		Payments,
		Drafts,
		ClosingDialog,

		Returns,
		PosOffers,
		PosCoupons,
		NewAddress,
		Variants,
		MpesaPayments,
		SalesOrders,
		PosSegmented,
	},

	computed: {
		/** Which pane currently owns the browse column. */
		browsePane() {
			if (this.payment) return "payment";
			if (this.showOffers) return "offers";
			if (this.coupons) return "coupons";
			return "items";
		},

		browseOptions() {
			return [
				{ value: "items", label: __("Items") },
				{ value: "offers", label: __("Offers"), badge: this.offersCount || 0 },
				{ value: "coupons", label: __("Coupons"), badge: this.couponsCount || 0 },
			];
		},

		shellClasses() {
			return {
				"pos-shell--compact": this.isCompact,
				"pos-shell--split": !this.isCompact,
				"pos-shell--dragging": this.dragging,
			};
		},
	},

	watch: {
		// Leaving compact must not strand the sheet in its open state.
		isCompact(compact) {
			if (!compact) this.cartOpen = false;
		},

		// Payment takes the whole screen; the cart sheet would only be in the way.
		payment(active) {
			if (active) this.cartOpen = false;
		},

		cartOpen(open) {
			setScrollLock(this, open);
		},
	},

	methods: {
		create_opening_voucher() {
			this.dialog = true;
		},
		get_pos_setting() {
			frappe.db.get_doc("POS Settings", undefined).then((doc) => {
				this.eventBus.emit("set_pos_settings", doc);
			});
		},
		checkLoadingComplete() {
			if (this.itemsLoaded && this.customersLoaded) {
				console.info("Loading completed");
			}
		},

		/**
		 * Jump straight to a pane instead of backing out of the current one.
		 *
		 * Exactly one event is emitted: each `show_*` handler already clears the
		 * other two flags, so emitting a "false" alongside a "true" would just
		 * undo the switch.
		 */
		setBrowsePane(pane) {
			if (pane === this.browsePane) return;

			if (pane === "offers") {
				this.eventBus.emit("show_offers", "true");
			} else if (pane === "coupons") {
				this.eventBus.emit("show_coupons", "true");
			} else if (this.showOffers) {
				this.eventBus.emit("show_offers", "false");
			} else if (this.coupons) {
				this.eventBus.emit("show_coupons", "false");
			} else if (this.payment) {
				this.eventBus.emit("show_payment", "false");
			}
		},

		openCart() {
			this.cartOpen = true;
		},

		closeCart() {
			this.cartOpen = false;
		},

		/**
		 * Route through the invoice so the same customer/items/stock validation
		 * runs whether payment is started from the dock or from the cart.
		 */
		requestPayment() {
			if (!this.cartCount) return;
			this.eventBus.emit("request_payment");
		},

		handleOffersCounter(data) {
			this.offersCount = Number(data?.offersCount) || 0;
		},

		handleCouponsCounter(data) {
			this.couponsCount = Number(data?.couponsCount) || 0;
		},

		handleCartSummary(summary) {
			if (!summary) return;
			this.cartCount = Number(summary.count) || 0;
			this.cartTotalDisplay = summary.total || "";
		},
	},

	mounted: function () {
		this.$nextTick(function () {
			this.check_opening_entry();
			this.get_pos_setting();
			this.eventBus.on("close_opening_dialog", () => {
				this.dialog = false;
			});
			this.eventBus.on("register_pos_data", (data) => {
				this.pos_profile = data.pos_profile;
				this.get_offers(this.pos_profile.name, this.pos_profile);
				this.pos_opening_shift = data.pos_opening_shift;
				this.eventBus.emit("register_pos_profile", data);
				console.info("LoadPosProfile");
			});
			// When profile is registered directly from composables,
			// ensure offers are fetched as well
			this.eventBus.on("register_pos_profile", (data) => {
				if (data && data.pos_profile) {
					this.get_offers(data.pos_profile.name, data.pos_profile);
				}
			});
			this.eventBus.on("show_payment", (data) => {
				this.payment = data === "true";
				this.showOffers = false;
				this.coupons = false;
			});
			this.eventBus.on("show_offers", (data) => {
				this.showOffers = data === "true";
				this.payment = false;
				this.coupons = false;
			});
			this.eventBus.on("show_coupons", (data) => {
				this.coupons = data === "true";
				this.showOffers = false;
				this.payment = false;
			});
			this.eventBus.on("open_closing_dialog", () => {
				this.get_closing_data();
			});
			this.eventBus.on("submit_closing_pos", (data) => {
				this.submit_closing_pos(data);
			});

			this.eventBus.on("items_loaded", () => {
				this.itemsLoaded = true;
				this.checkLoadingComplete();
			});
		});
	},
	beforeUnmount() {
		this.eventBus.off("close_opening_dialog");
		this.eventBus.off("register_pos_data");
		this.eventBus.off("register_pos_profile");
		this.eventBus.off("LoadPosProfile");
		this.eventBus.off("show_offers");
		this.eventBus.off("show_coupons");
		this.eventBus.off("open_closing_dialog");
		this.eventBus.off("submit_closing_pos");
		this.eventBus.off("items_loaded");
		this.eventBus.off("update_cart_summary", this.handleCartSummary);
		this.eventBus.off("update_offers_counters", this.handleOffersCounter);
		this.eventBus.off("update_coupons_counters", this.handleCouponsCounter);
		unlockScroll(this);
	},
	// In the created() or mounted() lifecycle hook
	created() {
		// Subscribed here rather than in mounted(): the invoice summary pushes its
		// first cart total from its own created() hook, which runs before this
		// component is mounted. Late subscription left the dock blank until the
		// cashier touched the cart.
		this.eventBus.on("update_cart_summary", this.handleCartSummary);
		this.eventBus.on("update_offers_counters", this.handleOffersCounter);
		this.eventBus.on("update_coupons_counters", this.handleCouponsCounter);

		// Clean up expired customer balance cache on POS load
		clearExpiredCustomerBalances();
		const customersStore = useCustomersStore();
		const { customersLoaded } = storeToRefs(customersStore);
		this.$watch(
			() => customersLoaded.value,
			(value) => {
				if (value) {
					this.customersLoaded = true;
					this.checkLoadingComplete();
				}
			},
			{ immediate: true },
		);
	},
};
</script>

<style scoped>
/* =============================================================================
 * Shell
 * ========================================================================== */

.pos-shell {
	/* Beats the `mx-4` the router applies, so compact layouts run edge to edge. */
	margin-left: var(--pos-gutter) !important;
	margin-right: var(--pos-gutter) !important;
	display: flex;
	flex-direction: column;
	gap: var(--pos-gap);
	min-height: 0;
}

/* =============================================================================
 * Grid
 * ========================================================================== */

.pos-shell-grid {
	display: grid;
	gap: var(--pos-pane-gap);
	align-items: start;
	min-height: 0;
}

/* Single column: the cart is lifted out into the sheet below. */
.pos-shell--compact .pos-shell-grid {
	grid-template-columns: minmax(0, 1fr);
	/* Clear the docked checkout bar. */
	padding-bottom: calc(var(--pos-dock-height) + var(--pos-safe-bottom) + var(--pos-gap));
}

.pos-shell--split .pos-shell-grid {
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
}

/* Extra width goes to the item grid, not to already-legible cart rows. */
@media (min-width: 1440px) {
	.pos-shell--split .pos-shell-grid {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
	}
}

.pos-pane {
	min-width: 0;
	min-height: 0;
}

/* Panes stack on top of each other rather than being torn down, so switching
   between Items / Offers / Coupons / Payment costs no mount work. */
.pos-pane-slot {
	min-width: 0;
}

/* =============================================================================
 * Compact cart sheet
 * ========================================================================== */

.pos-pane--sheet {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: var(--pos-z-sheet);
	display: flex;
	flex-direction: column;
	/* Shrinks with the on-screen keyboard (see --pos-keyboard-inset), so editing
	   a quantity inside the cart never pushes the field out of sight. */
	max-height: calc(var(--pos-sheet-max-height) - var(--pos-keyboard-inset, 0px));
	padding: 0 var(--pos-gutter) var(--pos-safe-bottom);
	background: var(--pos-card-bg, #fff);
	border-top-left-radius: var(--pos-radius-xl);
	border-top-right-radius: var(--pos-radius-xl);
	box-shadow: var(--pos-elev-3);
	overflow-y: auto;
	overscroll-behavior: contain;

	/* Parked below the fold. `visibility` rather than `display` keeps the cart
	   measurable while closed, so opening is a single compositor frame and the
	   items table inside never re-measures from zero. */
	transform: translate3d(0, 100%, 0);
	visibility: hidden;
	pointer-events: none;
	transition:
		transform var(--pos-dur-slow) var(--pos-ease-out),
		visibility 0s linear var(--pos-dur-slow);
	will-change: transform;
	contain: layout paint;
}

.pos-pane--sheet-open {
	transform: translate3d(0, 0, 0);
	visibility: visible;
	pointer-events: auto;
	transition:
		transform var(--pos-dur-slow) var(--pos-ease-out),
		visibility 0s linear 0s;
}

/* While a finger owns the sheet, an easing curve would fight the gesture. */
.pos-shell--dragging .pos-pane--sheet {
	transition: none;
}

/* The cart card manages its own height on desktop (it is user-resizable and
   persisted); inside the sheet the sheet decides, so override the inline
   height the component writes. */
.pos-pane--sheet :deep(.cards) {
	height: auto !important;
	max-height: none !important;
	resize: none !important;
	box-shadow: none !important;
	border: none !important;
	margin-top: 0 !important;
}

.pos-cart-grip {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 26px;
	flex: 0 0 auto;
	cursor: grab;
	touch-action: none;
	-webkit-tap-highlight-color: transparent;
}

.pos-shell--dragging .pos-cart-grip {
	cursor: grabbing;
}

.pos-cart-grip-bar {
	width: 44px;
	height: 5px;
	border-radius: var(--pos-radius-pill);
	background: var(--pos-outline, rgba(0, 0, 0, 0.2));
}

.pos-cart-scrim {
	position: fixed;
	inset: 0;
	z-index: var(--pos-z-scrim);
	background: rgba(15, 23, 32, 0.44);
	backdrop-filter: blur(2px);
	opacity: 0;
	pointer-events: none;
	transition: opacity var(--pos-dur-base) var(--pos-ease-standard);
}

.pos-cart-scrim--visible {
	opacity: 1;
	pointer-events: auto;
}

/* =============================================================================
 * Pane switch
 * ========================================================================== */

.pos-shell-switch {
	position: sticky;
	top: 0;
	z-index: 5;
	padding: var(--pos-gap) 0 2px;
	/* Fades the switch into the list scrolling beneath it. */
	background: linear-gradient(to bottom, var(--pos-bg-primary, #fff) 62%, transparent);
}

/* =============================================================================
 * Checkout dock
 * ========================================================================== */

.pos-dock {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: var(--pos-z-dock);
	display: grid;
	/* Three fixed slots. The total never pushes PAY around as digits change,
	   which is what stops a rapid tap landing on the wrong control. */
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: var(--pos-danger-gap);
	height: calc(var(--pos-dock-height) + var(--pos-safe-bottom));
	padding: 0 var(--pos-gutter) var(--pos-safe-bottom);
	background: var(--pos-card-bg, #fff);
	border-top: 1px solid var(--pos-border-light, rgba(0, 0, 0, 0.06));
	box-shadow: 0 -4px 20px var(--pos-shadow, rgba(0, 0, 0, 0.1));
	transition:
		transform var(--pos-dur-base) var(--pos-ease-out),
		opacity var(--pos-dur-fast) var(--pos-ease-out);
}

.pos-dock--hidden {
	transform: translate3d(0, 100%, 0);
	opacity: 0;
	pointer-events: none;
}

.pos-dock-cart {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: var(--pos-hit-comfortable);
	min-height: var(--pos-hit-comfortable);
	border: 1px solid var(--pos-border, rgba(0, 0, 0, 0.12));
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-variant, #f5f5f5);
	color: var(--pos-text-primary, #212121);
}

.pos-dock-cart-icon {
	position: relative;
	display: inline-flex;
}

.pos-dock-badge {
	position: absolute;
	top: -8px;
	inset-inline-end: -10px;
	min-width: 20px;
	height: 20px;
	padding: 0 5px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--pos-radius-pill);
	background: var(--pos-accent, #ff6b35);
	color: #fff;
	font-size: 0.6875rem;
	font-weight: 700;
	line-height: 1;
	animation: pos-pop var(--pos-dur-slow) var(--pos-ease-spring);
}

.pos-dock-total {
	display: flex;
	flex-direction: column;
	justify-content: center;
	min-width: 0;
	line-height: 1.15;
}

.pos-dock-total-label {
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--pos-text-secondary, #666);
}

.pos-dock-total-value {
	font-size: 1.375rem;
	font-weight: 700;
	color: var(--pos-text-primary, #212121);
}

.pos-dock-pay {
	min-width: 132px;
	min-height: var(--pos-hit-primary);
	padding: 0 24px;
	border: none;
	border-radius: var(--pos-radius-sm);
	background: var(--pos-success, #66bb6a);
	color: #fff;
	font-size: 1.0625rem;
	font-weight: 700;
	letter-spacing: 0.04em;
	box-shadow: 0 4px 12px rgba(76, 175, 80, 0.32);
	box-shadow: 0 4px 12px color-mix(in srgb, var(--pos-success, #66bb6a) 32%, transparent);
}

.pos-dock-pay:disabled {
	background: var(--pos-surface-variant, #e0e0e0);
	color: var(--pos-text-disabled, #9e9e9e);
	box-shadow: none;
	cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
	.pos-dock-badge {
		animation: none;
	}
}
</style>
