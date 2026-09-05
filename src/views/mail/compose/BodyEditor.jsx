import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, Link2, Highlighter, Check, X,
} from "lucide-react";
import { C, F, R, SP, glass } from "../../../ui/theme";
import { createMentionSuggestion } from "./mentionSuggestion";

// Injected once: mention + highlight visuals that live outside the inline-style
// system because Tiptap renders these nodes itself (no React style prop to hook).
let stylesInjected = false;
function injectEditorStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const tag = document.createElement("style");
  tag.textContent = `
    .compose-body .mention { color: ${C.minor}; font-weight: 600; background: rgba(59,163,255,0.14); border-radius: 4px; padding: 0 3px; }
    .compose-body mark { background: rgba(59,163,255,0.22); color: inherit; border-radius: 2px; padding: 0 1px; }
    .compose-body a { color: ${C.minor}; text-decoration: underline; }
    .compose-body p.is-editor-empty:first-child::before {
      content: attr(data-placeholder); float: left; color: ${C.inkFaint}; pointer-events: none; height: 0;
    }
    .compose-body { outline: none; }
  `;
  document.head.appendChild(tag);
}

export default function BodyEditor({ initialHtml, onChange, getTeam, editorRef }) {
  const [linkPopover, setLinkPopover] = useState(null); // { url }
  const linkInputRef = useRef(null);

  useEffect(() => { injectEditorStyles(); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Write your message…" }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: createMentionSuggestion(getTeam),
      }),
    ],
    content: initialHtml || "",
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  useEffect(() => {
    if (editor && linkPopover) {
      requestAnimationFrame(() => linkInputRef.current?.focus());
    }
  }, [linkPopover, editor]);

  if (!editor) return null;

  const openLinkPopover = () => {
    const prev = editor.getAttributes("link").href || "";
    setLinkPopover({ url: prev });
  };

  const applyLink = () => {
    const url = (linkPopover?.url || "").trim();
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkPopover(null);
  };

  const btn = (active, disabled) => ({
    display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
    background: active ? C.ink : "transparent", color: active ? C.void : C.inkDim,
    border: "none", borderRadius: 7, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {editor && (
        <BubbleMenu editor={editor} options={{ placement: "top" }}>
          <div
            style={{
              ...glass(R.pill), display: "flex", alignItems: "center", gap: 2, padding: 4,
              boxShadow: "0 10px 24px -10px rgba(0,0,0,0.7)",
            }}
          >
            {linkPopover ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
                <input
                  ref={linkInputRef}
                  value={linkPopover.url}
                  onChange={(e) => setLinkPopover({ url: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setLinkPopover(null); }}
                  placeholder="https://…"
                  style={{ width: 180, background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 6, color: C.ink, font: `400 12px ${F.mono}`, padding: "5px 8px", outline: "none" }}
                />
                <button onClick={applyLink} style={btn(false)} title="Apply"><Check size={14} /></button>
                <button onClick={() => setLinkPopover(null)} style={btn(false)} title="Cancel"><X size={14} /></button>
              </div>
            ) : (
              <>
                <button onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive("bold"))} title="Bold"><Bold size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive("italic"))} title="Italic"><Italic size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={btn(editor.isActive("underline"))} title="Underline"><UnderlineIcon size={14} /></button>
                <button onClick={() => editor.chain().focus().toggleStrike().run()} style={btn(editor.isActive("strike"))} title="Strikethrough"><Strikethrough size={14} /></button>
                <span style={{ width: 1, height: 18, background: C.hair, margin: "0 3px" }} />
                <button onClick={() => editor.chain().focus().setTextAlign("left").run()} style={btn(editor.isActive({ textAlign: "left" }))} title="Align left"><AlignLeft size={14} /></button>
                <button onClick={() => editor.chain().focus().setTextAlign("center").run()} style={btn(editor.isActive({ textAlign: "center" }))} title="Align center"><AlignCenter size={14} /></button>
                <button onClick={() => editor.chain().focus().setTextAlign("right").run()} style={btn(editor.isActive({ textAlign: "right" }))} title="Align right"><AlignRight size={14} /></button>
                <span style={{ width: 1, height: 18, background: C.hair, margin: "0 3px" }} />
                <button onClick={() => editor.chain().focus().toggleHighlight().run()} style={btn(editor.isActive("highlight"))} title="Highlight"><Highlighter size={14} /></button>
                <button onClick={openLinkPopover} style={btn(editor.isActive("link"))} title="Link"><Link2 size={14} /></button>
              </>
            )}
          </div>
        </BubbleMenu>
      )}
      <EditorContent
        editor={editor}
        className="compose-body"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", color: C.ink, font: `400 14px ${F.mono}`, lineHeight: 1.7, padding: `${SP.sm}px 0` }}
      />
    </div>
  );
}
