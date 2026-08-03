import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";
import { assertSameOrigin, getCurrentUser } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

export const prerender = false;

const uploadRoot =
	process.env.GALLERY_UPLOAD_DIR || "/var/www/guamian/uploads/gallery";
const maxFileSize = 8 * 1024 * 1024;
const allowedTypes = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"image/avif",
]);

export const POST: APIRoute = async ({ cookies, params, request }) => {
	try {
		assertSameOrigin(request);
		const user = await getCurrentUser(cookies);
		if (!user) {
			return Response.json({ error: "请先登录后再上传图片" }, { status: 401 });
		}
		const album = (
			await query<{ id: string }>(
				"SELECT id::text FROM gallery_albums WHERE id = $1",
				[params.albumId || ""],
			)
		).rows[0];
		if (!album) {
			return Response.json({ error: "相册不存在" }, { status: 404 });
		}

		const form = await request.formData();
		const file = form.get("photo");
		if (!(file instanceof File) || file.size === 0) {
			return Response.json({ error: "请选择图片" }, { status: 400 });
		}
		if (!allowedTypes.has(file.type.toLowerCase())) {
			return Response.json(
				{ error: "仅支持 JPG、PNG、WebP、GIF、AVIF" },
				{ status: 415 },
			);
		}
		if (file.size > maxFileSize) {
			return Response.json({ error: "单张图片不能超过 8MB" }, { status: 413 });
		}

		await fs.mkdir(uploadRoot, { recursive: true });
		const id = randomUUID();
		const target = path.join(uploadRoot, id);
		await fs.writeFile(target, Buffer.from(await file.arrayBuffer()), {
			flag: "wx",
		});
		try {
			await query(
				"INSERT INTO gallery_photos (id, album_id, uploaded_by, file_name, content_type, file_size) VALUES ($1, $2, $3, $4, $5, $6)",
				[id, album.id, user.id, file.name.slice(0, 255), file.type, file.size],
			);
		} catch (cause) {
			await fs.rm(target, { force: true });
			throw cause;
		}

		return Response.json(
			{ id, name: file.name, url: `/api/gallery/photos/${id}` },
			{ status: 201 },
		);
	} catch (cause) {
		return Response.json(
			{ error: cause instanceof Error ? cause.message : "上传失败" },
			{ status: 500 },
		);
	}
};
