# BrieFlow Product Segment Worker

This Worker removes product-image backgrounds with **Cloudflare Images**
`segment: "foreground"`, which uses BiRefNet under the hood.

## Free-plan fit

Cloudflare Images Free includes up to **5,000 unique transformations/month**.
Repeated requests for the same source + transformation in the same month count
once when served from Cloudflare's transformation cache.

## Deploy

1. Log in to Cloudflare with Wrangler:

   ```bash
   npx wrangler login
   ```

2. From this directory, add the shared secret:

   ```bash
   npx wrangler secret put BRIEFLOW_SEGMENT_SECRET
   ```

3. Deploy:

   ```bash
   npx wrangler deploy
   ```

4. In Supabase Edge Function secrets, add:

   - `CLOUDFLARE_SEGMENT_WORKER_URL` = the deployed `workers.dev` URL.
   - `CLOUDFLARE_SEGMENT_SHARED_SECRET` = the same value used above.

The browser never receives this shared secret. It calls the authenticated
Supabase `product-segment` Edge Function, which forwards image bytes to this
Worker and stores the transparent WebP back in `campaign-assets`.
