import { apiData } from "@/lib/client-api";

// Uploads a document File directly to R2 using a server-issued presigned PUT,
// then returns the metadata the caller records via POST /api/v1/documents.
export async function uploadDocument(file, scope = "residents") {
  if (!file) return null;
  const { uploadUrl, objectKey } = await apiData("/api/v1/uploads/r2-presign", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream", scope }),
  });
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: file.type ? { "Content-Type": file.type } : undefined,
  });
  if (!res.ok) throw new Error(`Document upload failed (${res.status}).`);
  return { objectKey, name: file.name, contentType: file.type || "application/octet-stream", size: file.size };
}

// Resolves a short-lived viewable URL for a stored document and opens it.
export async function openDocument(documentId) {
  const d = await apiData(`/api/v1/documents/${documentId}/url`);
  if (d?.url) window.open(d.url, "_blank", "noopener,noreferrer");
  return d?.url || null;
}
