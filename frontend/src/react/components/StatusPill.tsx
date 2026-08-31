import { t } from "../lib/frappe";

/**
 * Connectivity indicator.
 *
 * This replaces the database-health, server-health, CPU and cache gadgets that
 * used to sit in the navbar. A cashier can act on "offline" — keep selling,
 * sales queue locally — but cannot act on a CPU percentage, so the binary is
 * the only part worth screen space at a till.
 */
export function StatusPill({ online }: { online: boolean }) {
	return (
		<span
			className={[
				"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold",
				online
					? "bg-crayon-green/10 text-crayon-green"
					: "bg-crayon-red/10 text-crayon-red",
			].join(" ")}
			role="status"
			aria-live="polite"
		>
			<span
				aria-hidden="true"
				className={[
					"h-1.5 w-1.5 rounded-full",
					online ? "bg-crayon-green" : "bg-crayon-red",
				].join(" ")}
			/>
			{online ? t("Online") : t("Offline")}
		</span>
	);
}
