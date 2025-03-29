const FALLBACK_CACHE_ID = 'fallback';

export async function getFromFallbackCache(req: Request): Promise<Response | null> {
  const cache = await caches.open(FALLBACK_CACHE_ID);

  const cachedResponse = await cache.match(req);
  if (cachedResponse) {
    return cachedResponse;
  }

  return null;
}
