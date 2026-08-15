-- ============================================================
-- DalConnect — size and type limits on storage buckets
--
-- Every bucket was created with file_size_limit = null and
-- allowed_mime_types = null, i.e. any signed-in user could upload a file of any
-- size and any type. Two consequences:
--
--   * cost/abuse: nothing stopped a multi-gigabyte upload, repeatedly
--   * content type: the image buckets are PUBLIC, so an .html or .svg uploaded
--     into one is served from the project's own domain — a phishing page or
--     stored XSS hosted by us, linked from a URL that looks like ours
--
-- The app only ever uploads photos (expo-image-picker, mediaTypes: ["images"]),
-- so restricting to image types costs nothing and closes both. id-documents
-- also accepts PDF, since that is a normal way to send an ID scan.
-- ============================================================

update storage.buckets
   set file_size_limit  = 5 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'avatars';

update storage.buckets
   set file_size_limit  = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id in ('booking-photos', 'chat-images', 'gallery', 'banners');

update storage.buckets
   set file_size_limit  = 10 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
 where id = 'id-documents';
