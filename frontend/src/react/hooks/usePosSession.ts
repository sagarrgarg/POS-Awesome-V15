import { useCallback, useEffect, useState } from "react";
import { call, getFrappe } from "../lib/frappe";
import type { PosProfile } from "../lib/types";

interface OpeningShift {
	name: string;
	[key: string]: unknown;
}

interface ShiftPayload {
	pos_opening_shift?: OpeningShift;
	pos_profile?: PosProfile;
	company?: { name: string };
}

export interface PosSession {
	loading: boolean;
	/** Null once loaded means: no open shift, the cashier must open one. */
	profile: PosProfile | null;
	shift: OpeningShift | null;
	error: string | null;
	reload: () => void;
}

/**
 * Resolves the open POS shift for the current user.
 *
 * `check_opening_shift` returns an empty string (not null) when there is no
 * open shift, which is why the payload is shape-checked rather than checked
 * for truthiness.
 */
export function usePosSession(): PosSession {
	const [loading, setLoading] = useState(true);
	const [profile, setProfile] = useState<PosProfile | null>(null);
	const [shift, setShift] = useState<OpeningShift | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [nonce, setNonce] = useState(0);

	const reload = useCallback(() => setNonce((n) => n + 1), []);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			setLoading(true);
			setError(null);
			try {
				const user = getFrappe()?.session?.user;
				const payload = await call<ShiftPayload | "">(
					"posawesome.posawesome.api.shifts.check_opening_shift",
					{ user },
				);

				if (cancelled) return;

				if (
					payload &&
					typeof payload === "object" &&
					payload.pos_profile
				) {
					setProfile(payload.pos_profile);
					setShift(payload.pos_opening_shift ?? null);
				} else {
					setProfile(null);
					setShift(null);
				}
			} catch (e) {
				if (!cancelled)
					setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [nonce]);

	return { loading, profile, shift, error, reload };
}
