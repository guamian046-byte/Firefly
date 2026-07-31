import fs from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";
import { query } from "@/lib/server/db";

export const prerender = false;
const uploadRoot =
	process.env.GALLERY_UPLOAD_DIR || "/var/www/guamian/uploads/gallery";

export const GET: APIRoute = async ({ params }) => {
	const photo = (
		await query<{ id: string; content_type: string }>(
			"SELECT id::text, content_type FROM gallery_photos WHERE id = $1",
			[params.id],
		)
	).rows[0];
	if (!photo) return new Response("图片不存在", { status: 404 });
	try {
		const bytes = await fs.readFile(path.join(uploadRoot, photo.id));
		return new Response(bytes, {
			headers: {
				"content-type": photo.content_type,
				"cache-control": "public, max-age=31536000, immutable",
			},
		});
	} catch {
		return new Response("图片文件不存在", { status: 404 });
	}
};
