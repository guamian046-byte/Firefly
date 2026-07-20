"use strict";

const REPO = "guamian046-byte/Firefly";
const BRANCH = "master";
const API_ROOT = `https://api.github.com/repos/${REPO}`;
const POST_PATTERN = /^src\/content\/posts\/.+\.(?:md|mdx)$/i;

const elements = {
	token: document.querySelector("#token"),
	load: document.querySelector("#load"),
	status: document.querySelector("#status"),
	manager: document.querySelector("#manager"),
	list: document.querySelector("#article-list"),
	selection: document.querySelector("#selection"),
	selectAll: document.querySelector("#select-all"),
	clear: document.querySelector("#clear"),
	hide: document.querySelector("#hide"),
	publish: document.querySelector("#publish"),
};

const state = {
	token: "",
	refSha: "",
	baseTreeSha: "",
	entries: [],
	busy: false,
};

function setStatus(message, type = "") {
	elements.status.textContent = message;
	elements.status.className = type;
}

function setBusy(busy) {
	state.busy = busy;
	for (const button of document.querySelectorAll("button")) button.disabled = busy;
}

async function github(path, options = {}) {
	const response = await fetch(`${API_ROOT}${path}`, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${state.token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...options.headers,
		},
	});
	if (!response.ok) {
		let detail = "";
		try { detail = (await response.json()).message || ""; } catch { detail = await response.text(); }
		throw new Error(`GitHub 请求失败（${response.status}）${detail ? `：${detail}` : ""}`);
	}
	return response.status === 204 ? null : response.json();
}

function decodeBase64(value) {
	const binary = atob(value.replace(/\s/g, ""));
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function encodeBase64(value) {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return btoa(binary);
}

function getFrontmatter(content) {
	const match = content.match(/^---(\r?\n)([\s\S]*?)(\r?\n)---/);
	if (!match) throw new Error("文章缺少有效的 YAML Frontmatter");
	return { match, newline: match[1], data: match[2] };
}

function parseEntry(content, fallbackTitle) {
	const { data } = getFrontmatter(content);
	const titleMatch = data.match(/^title:\s*(.+?)\s*$/m);
	let title = titleMatch?.[1] || fallbackTitle;
	if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith("'") && title.endsWith("'"))) {
		title = title.slice(1, -1);
	}
	const draftMatch = data.match(/^draft:\s*(.+?)\s*$/m);
	return { title, draft: /^true$/i.test(draftMatch?.[1] || "false") };
}

function updateVisibility(content, makePrivate) {
	const { match, newline, data } = getFrontmatter(content);
	const draftLine = `draft: ${makePrivate ? "true" : "false"}`;
	const updatedData = /^draft:.*$/m.test(data)
		? data.replace(/^draft:.*$/m, draftLine)
		: `${draftLine}${newline}${data}`;
	return `${match.input.slice(0, match.index)}---${newline}${updatedData}${match[3]}---${match.input.slice((match.index || 0) + match[0].length)}`;
}

function selectedEntries() {
	const selectedPaths = new Set(
		[...elements.list.querySelectorAll("input:checked")].map((input) => input.value),
	);
	return state.entries.filter((entry) => selectedPaths.has(entry.path));
}

function updateSelection() {
	elements.selection.textContent = `已选择 ${selectedEntries().length} 篇`;
}

function renderEntries() {
	elements.list.replaceChildren();
	for (const entry of state.entries) {
		const label = document.createElement("label");
		label.className = "article";
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.value = entry.path;
		checkbox.addEventListener("change", updateSelection);
		const title = document.createElement("span");
		title.className = "title";
		title.textContent = entry.title;
		const badge = document.createElement("span");
		badge.className = `badge ${entry.draft ? "private" : "public"}`;
		badge.textContent = entry.draft ? "私密" : "公开";
		label.append(checkbox, title, badge);
		elements.list.append(label);
	}
	elements.manager.hidden = false;
	updateSelection();
}

async function loadArticles() {
	state.token = elements.token.value.trim();
	if (!state.token) {
		setStatus("请先输入 Access Token。", "error");
		return;
	}
	setBusy(true);
	setStatus("正在从 GitHub 加载文章……");
	try {
		const ref = await github(`/git/ref/heads/${BRANCH}`);
		state.refSha = ref.object.sha;
		const commit = await github(`/git/commits/${state.refSha}`);
		state.baseTreeSha = commit.tree.sha;
		const tree = await github(`/git/trees/${state.baseTreeSha}?recursive=1`);
		const files = tree.tree.filter((item) => item.type === "blob" && POST_PATTERN.test(item.path));
		state.entries = await Promise.all(files.map(async (file) => {
			const blob = await github(`/git/blobs/${file.sha}`);
			const content = decodeBase64(blob.content);
			const parsed = parseEntry(content, file.path.split("/").pop());
			return { path: file.path, sha: file.sha, content, ...parsed };
		}));
		state.entries.sort((a, b) => Number(a.draft) - Number(b.draft) || a.title.localeCompare(b.title, "zh-CN"));
		renderEntries();
		setStatus(`已加载 ${state.entries.length} 篇文章。`, "success");
		elements.token.value = "";
	} catch (error) {
		state.token = "";
		setStatus(error.message || String(error), "error");
	} finally {
		setBusy(false);
	}
}

async function applyVisibility(makePrivate) {
	const selected = selectedEntries();
	if (!selected.length) {
		setStatus("请至少勾选一篇文章。", "error");
		return;
	}
	const changed = selected.filter((entry) => entry.draft !== makePrivate);
	if (!changed.length) {
		setStatus(`所选文章已经全部是${makePrivate ? "私密" : "公开"}状态。`);
		return;
	}
	if (!confirm(`确定把选中的 ${changed.length} 篇文章设为${makePrivate ? "私密" : "公开"}吗？`)) return;

	setBusy(true);
	setStatus("正在生成一次批量提交，请不要关闭页面……");
	try {
		const latestRef = await github(`/git/ref/heads/${BRANCH}`);
		if (latestRef.object.sha !== state.refSha) {
			throw new Error("仓库内容已经发生变化，请重新点击“加载文章”后再操作。");
		}
		const treeItems = await Promise.all(changed.map(async (entry) => {
			const content = updateVisibility(entry.content, makePrivate);
			const blob = await github("/git/blobs", {
				method: "POST",
				body: JSON.stringify({ content: encodeBase64(content), encoding: "base64" }),
			});
			entry.content = content;
			entry.draft = makePrivate;
			entry.sha = blob.sha;
			return { path: entry.path, mode: "100644", type: "blob", sha: blob.sha };
		}));
		const newTree = await github("/git/trees", {
			method: "POST",
			body: JSON.stringify({ base_tree: state.baseTreeSha, tree: treeItems }),
		});
		const newCommit = await github("/git/commits", {
			method: "POST",
			body: JSON.stringify({
				message: makePrivate ? "content: bulk hide posts" : "content: bulk publish posts",
				tree: newTree.sha,
				parents: [state.refSha],
			}),
		});
		await github(`/git/refs/heads/${BRANCH}`, {
			method: "PATCH",
			body: JSON.stringify({ sha: newCommit.sha, force: false }),
		});
		state.refSha = newCommit.sha;
		state.baseTreeSha = newTree.sha;
		renderEntries();
		setStatus(`成功：${changed.length} 篇文章已设为${makePrivate ? "私密" : "公开"}，网站正在自动部署。`, "success");
	} catch (error) {
		setStatus(error.message || String(error), "error");
	} finally {
		setBusy(false);
	}
}

elements.load.addEventListener("click", loadArticles);
elements.token.addEventListener("keydown", (event) => {
	if (event.key === "Enter") loadArticles();
});
elements.selectAll.addEventListener("click", () => {
	for (const input of elements.list.querySelectorAll("input")) input.checked = true;
	updateSelection();
});
elements.clear.addEventListener("click", () => {
	for (const input of elements.list.querySelectorAll("input")) input.checked = false;
	updateSelection();
});
elements.hide.addEventListener("click", () => applyVisibility(true));
elements.publish.addEventListener("click", () => applyVisibility(false));
