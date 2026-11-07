// Verification documents (ID cards, commercial registrations) are private: the server only
// returns them to their owner or a platform admin and requires the Bearer token, which a plain
// <a href> cannot send. So the file is fetched with the token and shown from a temporary
// in-memory blob URL instead.
//
// The tab is opened synchronously inside the click handler (before the network round trip) -
// browsers block pop-ups that are opened after an await.

export async function openVerificationDocument(docId: string): Promise<{ ok: boolean; error?: string }> {
  const win = window.open("", "_blank");
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
      win?.close();
      return { ok: false, error };
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    if (win) {
      win.location.href = blobUrl;
    } else {
      // Pop-up blocked: fall back to navigating this tab's download.
      const a = document.createElement("a");
      a.href = blobUrl;
      a.target = "_blank";
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
    return { ok: true };
  } catch {
    win?.close();
    return { ok: false, error: "Could not open the document." };
  }
}
