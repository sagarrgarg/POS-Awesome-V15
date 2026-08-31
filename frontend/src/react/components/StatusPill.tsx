import { Badge } from "@radix-ui/themes";
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
		<Badge
			color={online ? "green" : "red"}
			variant="soft"
			radius="full"
			size="1"
			role="status"
			aria-live="polite"
		>
			{online ? t("Online") : t("Offline")}
		</Badge>
	);
}
