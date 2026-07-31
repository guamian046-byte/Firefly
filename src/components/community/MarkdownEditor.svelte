<script lang="ts">
	import { marked } from "marked";
	let { value = "" }: { value?: string } = $props();
	let body = $state(value);
	let preview = $derived.by(() => {
		const raw = marked.parse(body || "_预览会显示在这里_", { async: false }) as string;
		if (typeof document === "undefined") return raw;
		const doc = new DOMParser().parseFromString(raw, "text/html");
		doc.querySelectorAll("script,style,iframe,object,embed,form").forEach((node) => node.remove());
		doc.querySelectorAll("*").forEach((element) => {
			for (const attribute of [...element.attributes]) {
				if (attribute.name.startsWith("on") || attribute.value.trim().toLowerCase().startsWith("javascript:")) element.removeAttribute(attribute.name);
			}
		});
		return doc.body.innerHTML;
	});
</script>

<div class="editor-grid">
	<div class="editor-pane"><div class="editor-label">Markdown</div><textarea name="body" bind:value={body} required minlength="20" placeholder="# 从这里开始写作…"></textarea></div>
	<div class="editor-pane preview-pane"><div class="editor-label">实时预览</div><div class="markdown-content preview-content">{@html preview}</div></div>
</div>

<style>
	.editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.editor-pane { min-width: 0; display: grid; grid-template-rows: auto 1fr; gap: .45rem; }
	.editor-label { font-weight: 700; font-size: .85rem; opacity: .7; }
	textarea { width: 100%; min-height: 32rem; resize: vertical; border: 1px solid var(--line-divider); background: var(--card-bg); color: inherit; border-radius: .75rem; padding: 1rem; outline: none; font-family: var(--font-mono, ui-monospace, monospace); line-height: 1.7; }
	textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent); }
	.preview-pane { border-left: 1px solid var(--line-divider); padding-left: 1rem; }
	.preview-content { min-height: 32rem; overflow-wrap: anywhere; }
	@media (max-width: 900px) { .editor-grid { grid-template-columns: 1fr; } .preview-pane { border-left: 0; border-top: 1px solid var(--line-divider); padding: 1rem 0 0; } }
</style>
