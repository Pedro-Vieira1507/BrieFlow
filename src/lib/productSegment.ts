import { invokeEdgeFunction } from "@/lib/supabase";

interface ProductSegmentResponse {
  url: string;
  path?: string;
  provider?: string;
}

export async function segmentProductImage(
  imageUrl: string,
  signal?: AbortSignal,
): Promise<ProductSegmentResponse> {
  const source = imageUrl.trim();
  if (!/^https?:\/\//i.test(source)) {
    throw new Error("product_segment_requires_remote_image");
  }

  const response = await invokeEdgeFunction<ProductSegmentResponse>(
    "product-segment",
    { image_url: source },
    signal,
  );

  if (!response.url) {
    throw new Error("product_segment_missing_url");
  }

  return response;
}
