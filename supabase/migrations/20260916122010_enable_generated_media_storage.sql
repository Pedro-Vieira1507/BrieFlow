-- Generated podcasts and videos share the private campaign asset bucket with
-- uploaded images. Keep the bucket private while allowing the MIME types and
-- maximum size enforced by the media-render Edge Function.
update storage.buckets
set
  file_size_limit = 50000000,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]::text[]
where id = 'campaign-assets';
