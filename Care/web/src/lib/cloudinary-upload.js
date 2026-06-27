import { apiData } from "@/lib/client-api";

// Uploads an image File to Cloudinary using a server-issued signature and
// returns the secure HTTPS URL. `kind` selects the tenant media folder
// ('residents' | 'staff'). The api_secret stays on the server.
export async function uploadPortrait(file, kind = "residents") {
  if (!file) return null;
  const sig = await apiData(`/api/v1/uploads/sign?kind=${encodeURIComponent(kind)}`);
  if (!sig?.signature) throw new Error("Image uploads are not configured.");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Image upload failed.");
  }
  return data.secure_url;
}
