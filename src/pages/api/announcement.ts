import type { APIRoute } from "astro";
import { query } from "@/lib/server/db";

export const prerender = false;
export const GET: APIRoute = async () => {
	const result = await query<{ key: string; value: string }>(
		"SELECT key, value FROM site_settings WHERE key IN ('announcement_title', 'announcement_content')",
	);
	const values = Object.fromEntries(
		result.rows.map((row) => [row.key, row.value]),
	);
	return Response.json({
		title: values.announcement_title || "公告",
		content: values.announcement_content || "",
	});
};
