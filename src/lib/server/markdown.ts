import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderUserMarkdown(markdown: string) {
	const raw = marked.parse(markdown, { async: false }) as string;
	return sanitizeHtml(raw, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "figure", "figcaption"]),
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			a: ["href", "name", "target", "rel"],
			img: ["src", "alt", "title", "loading"],
			code: ["class"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		transformTags: {
			a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer" }),
			img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
		},
	});
}
