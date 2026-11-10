import React from "react";

// Shows a legal document's text with its structure: a blank line starts a paragraph, a line beginning
// "1. " ... "20. " is a heading, a line beginning "- " is a bullet. Anything else (the older one-paragraph
// documents, or text an admin typed in the Legal CMS) is shown as plain paragraphs, as before.
export default function LegalText({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: string) => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={key} className="list-disc ps-5 space-y-1 text-ink-muted">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("- ")) { bullets.push(line.slice(2)); return; }
    flush(`ul-${i}`);
    if (!line) return;
    if (/^\d{1,2}\.\s/.test(line) && line.length <= 90) {
      out.push(<h4 key={i} className="pt-3 font-serif font-bold text-[13px] text-ink">{line}</h4>);
    } else if (i === 0 && lines.length > 3) {
      out.push(<p key={i} className="font-serif font-bold text-sm text-ink">{line}</p>);
    } else {
      out.push(<p key={i} className="leading-relaxed text-ink-muted">{line}</p>);
    }
  });
  flush("ul-end");
  return <div className="space-y-2 text-xs font-sans">{out}</div>;
}
