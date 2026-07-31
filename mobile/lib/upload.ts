import { supabase } from "./supabase";

/**
 * Upload a local file (image picker URI) to Supabase Storage.
 * Files are namespaced under the user's id folder to satisfy storage RLS.
 * Returns the public URL (or storage path for private buckets).
 */
export async function uploadImage(opts: {
  bucket: "avatars" | "booking-photos" | "gallery" | "chat-images" | "id-documents";
  userId: string;
  localUri: string;
  /** unique-ish name; caller supplies e.g. `${Date.now()}.jpg` */
  fileName: string;
}): Promise<string> {
  const { bucket, userId, localUri, fileName } = opts;
  const res = await fetch(localUri);
  const arrayBuffer = await res.arrayBuffer();
  const path = `${userId}/${fileName}`;
  const contentType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  if (bucket === "id-documents") return path; // private bucket — store the path
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
