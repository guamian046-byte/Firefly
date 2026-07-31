import { query } from "./db";

export type SitePermissions = {
	registrationEnabled: boolean;
	publishingEnabled: boolean;
	requireReview: boolean;
};

export async function getSitePermissions(): Promise<SitePermissions> {
	const result = await query<{ key: string; value: string }>("SELECT key, value FROM site_settings");
	const values = new Map(result.rows.map((row) => [row.key, row.value]));
	return {
		registrationEnabled: values.get("registration_enabled") !== "false",
		publishingEnabled: values.get("publishing_enabled") !== "false",
		requireReview: values.get("require_review") !== "false",
	};
}

export async function updateSitePermissions(input: SitePermissions) {
	const values = [
		["registration_enabled", input.registrationEnabled],
		["publishing_enabled", input.publishingEnabled],
		["require_review", input.requireReview],
	] as const;
	for (const [key, value] of values) {
		await query(
			"INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
			[key, String(value)],
		);
	}
}
