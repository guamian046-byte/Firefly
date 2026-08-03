import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
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
		const filePath = path.join(uploadRoot, photo.id);
		const stat = await fs.stat(filePath);
		const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
		return new Response(stream, {
			headers: {
				"content-type": photo.content_type,
				"content-length": String(stat.size),
				"cache-control": "public, max-age=31536000, immutable",
				"x-content-type-options": "nosniff",
			},
		});
	} catch {
		return new Response("图片文件不存在", { status: 404 });
	}
};
