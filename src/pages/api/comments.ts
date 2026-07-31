import { randomUUID } from "node:crypto";
import type { APIRoute } from "astro";
import { assertSameOrigin, getCurrentUser, isAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";

export const prerender = false;

function validPath(value: string) {
	return value.startsWith("/") && value.length <= 255 ? value : null;
}

export const GET: APIRoute = async ({ url, cookies }) => {
	const pagePath = validPath(url.searchParams.get("path") || "");
	if (!pagePath) return new Response("无效页面", { status: 400 });
	const user = await getCurrentUser(cookies);
	const result = await query<{
		id: string;
		content: string;
		created_at: Date;
		author_id: string;
		username: string;
		display_name: string;
	}>(
		`SELECT c.id::text, c.content, c.created_at, c.author_id::text, u.username, u.display_name
		 FROM comments c JOIN users u ON u.id = c.author_id
		 WHERE c.page_path = $1 ORDER BY c.created_at ASC LIMIT 500`,
		[pagePath],
	);
	return Response.json({
		comments: result.rows,
		currentUser: user ? { id: user.id, admin: isAdmin(user) } : null,
	});
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		assertSameOrigin(request);
		const user = await getCurrentUser(cookies);
		if (!user) return new Response("请先登录", { status: 401 });
		const body = await request.json();
		const pagePath = validPath(String(body.path || ""));
		const content = String(body.content || "")
			.trim()
			.slice(0, 2000);
		if (!pagePath || !content)
			return new Response("评论内容不能为空", { status: 400 });
		await query(
			"INSERT INTO comments (id, page_path, author_id, content) VALUES ($1, $2, $3, $4)",
			[randomUUID(), pagePath, user.id, content],
		);
		return Response.json({ ok: true });
	} catch (cause) {
		return new Response(cause instanceof Error ? cause.message : "评论失败", {
			status: 400,
		});
	}
};

export const DELETE: APIRoute = async ({ request, cookies, url }) => {
	try {
		assertSameOrigin(request);
		const user = await getCurrentUser(cookies);
		if (!user) return new Response("请先登录", { status: 401 });
		const id = url.searchParams.get("id") || "";
		const result = await query<{ author_id: string }>(
			"SELECT author_id::text FROM comments WHERE id = $1",
			[id],
		);
		if (!result.rows[0]) return new Response("评论不存在", { status: 404 });
		if (result.rows[0].author_id !== user.id && !isAdmin(user))
			return new Response("无权删除", { status: 403 });
		await query("DELETE FROM comments WHERE id = $1", [id]);
		return Response.json({ ok: true });
	} catch (cause) {
		return new Response(cause instanceof Error ? cause.message : "删除失败", {
			status: 400,
		});
	}
};
