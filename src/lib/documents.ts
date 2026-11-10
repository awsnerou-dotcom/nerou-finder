// Verification documents (ID cards, commercial registrations) are private: the server only
// returns them to their owner, their organisation's admin, or a platform admin, and requires the
// Bearer token, which a plain <a href> cannot send. So the file is fetched with the token and
// shown from a temporary in-memory blob URL, inside the app (see DocumentViewer) - never in a bare
// browser tab, which has no way back.

export async function fetchVerificationDocument(docId: string): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/verification-documents/${encodeURIComponent(docId)}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      let error = "Could not open the document.";
      try {
        const body = await res.json();
        if (body?.error) error = body.error;
      } catch {}
      return { ok: false, error };
    }
    return { ok: true, blob: await res.blob() };
  } catch {
    return { ok: false, error: "Could not open the document." };
  }
}

export type DocumentKind = "image" | "pdf" | "other";

export function documentKind(mime: string): DocumentKind {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  return "other";
}
