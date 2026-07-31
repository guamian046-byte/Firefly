import { query } from "@/lib/server/db";
import { getSortedPosts } from "@/utils/content-utils";

export const prerender = false;

export async function GET() {
	const posts = await getSortedPosts();

	const staticPosts = posts
		.map((post) => ({
			id: post.id,
			title: post.data.title,
			description: post.data.description,
			published: post.data.published.getTime(),
			category: post.data.category || "",
			password: !!post.data.password,
		}))
		// 日历按纯日期排序，忽略置顶
		.sort((a, b) => b.published - a.published);
	let communityPosts: Array<{
		id: string;
		title: string;
		description: string;
		published: number;
		category: string;
		password: boolean;
		href: string;
	}> = [];
	try {
		const result = await query<{
			slug: string;
			title: string;
			excerpt: string;
			published_at: Date;
		}>(
			"SELECT slug, title, excerpt, published_at FROM community_posts WHERE status = 'published' AND slug IS NOT NULL ORDER BY published_at DESC",
		);
		communityPosts = result.rows.map((post) => ({
			id: post.slug,
			title: post.title,
			description: post.excerpt,
			published: new Date(post.published_at).getTime(),
			category: "社区文章",
			password: false,
			href: `/articles/${post.slug}/`,
		}));
	} catch {}
	const allPostsData = [
		...staticPosts.map((post) => ({ ...post, href: `/posts/${post.id}/` })),
		...communityPosts,
	].sort((a, b) => b.published - a.published);

	return new Response(JSON.stringify(allPostsData));
}
