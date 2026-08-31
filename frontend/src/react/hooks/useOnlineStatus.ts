import { useEffect, useState } from "react";

/**
 * Connectivity for the header pill.
 *
 * Replaces the old database-health / server-health / CPU gadgets: a cashier can
 * act on "offline" (sales queue locally) but cannot act on a CPU percentage, so
 * only the binary is worth screen space.
 *
 * `navigator.onLine` alone lies — it reports true for a captive portal or a
 * dead uplink — so a reachable-server check is layered on top of the events.
 */
const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;

async function probeServer(): Promise<boolean> {
	if (!navigator.onLine) return false;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		// /api/method/ping is whitelisted and guest-accessible in Frappe.
		const response = await fetch("/api/method/ping", {
			method: "GET",
			cache: "no-store",
			credentials: "same-origin",
			signal: controller.signal,
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

export function useOnlineStatus(): boolean {
	const [online, setOnline] = useState(() => navigator.onLine);

	useEffect(() => {
		let cancelled = false;

		const check = async () => {
			const reachable = await probeServer();
			if (!cancelled) setOnline(reachable);
		};

		const goOffline = () => setOnline(false);

		window.addEventListener("online", check);
		window.addEventListener("offline", goOffline);
		check();
		const interval = setInterval(check, PROBE_INTERVAL_MS);

		return () => {
			cancelled = true;
			clearInterval(interval);
			window.removeEventListener("online", check);
			window.removeEventListener("offline", goOffline);
		};
	}, []);

	return online;
}
