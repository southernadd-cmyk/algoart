// Meta can report FINISHED for a container before media_publish accepts it.
// Only the explicit "media is not ready" rejection is safe to retry.
export const INSTAGRAM_NOT_READY_CODE = 9007;
export const INSTAGRAM_NOT_READY_SUBCODE = 2207027;
export const DEFAULT_RETRY_DELAYS_MS = Object.freeze([3000, 5000, 8000, 13000, 21000]);

export function isInstagramMediaNotReady(error) {
  try {
    const response = JSON.parse(error?.message || '');
    return response?.error?.code === INSTAGRAM_NOT_READY_CODE &&
      response?.error?.error_subcode === INSTAGRAM_NOT_READY_SUBCODE;
  } catch {
    return false;
  }
}

export async function publishInstagramContainerSafely({
  graph,
  userId,
  containerId,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS
}) {
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const published = await graph(userId + '/media_publish', { creation_id: containerId });
      if (!published?.id) throw new Error('Instagram publish response has no media id.');
      return published;
    } catch (error) {
      // A network timeout or unexpected API response might mean publication
      // succeeded. Never retry it: that could produce a duplicate post.
      if (!isInstagramMediaNotReady(error) || attempt === retryDelaysMs.length) throw error;
      const delayMs = retryDelaysMs[attempt];
      console.warn('Instagram container not yet publishable (attempt ' +
        (attempt + 1) + '/' + (retryDelaysMs.length + 1) +
        '); retrying same container in ' + delayMs + ' ms.');
      await sleep(delayMs);
    }
  }
}
