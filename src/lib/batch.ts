/**
 * Runs `worker` over `items` in fixed-size slices, so a batch endpoint that is
 * bound by I/O (S3 download, ffmpeg transcode, LLM round trip) makes progress in
 * parallel without opening a connection per item. Results keep the input order.
 *
 * Deliberately small and dependency-free: there is no job runner in this app,
 * and the batch endpoints keep their own "call again until remaining is 0"
 * contract — this only stops them from processing one item at a time.
 */
export async function mapInBatches<In, Out>(
  items: readonly In[],
  size: number,
  worker: (item: In, index: number) => Promise<Out>
): Promise<Out[]> {
  const batchSize = normalizeConcurrency(size, 1, Math.max(1, items.length));
  const results: Out[] = new Array(items.length);

  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);
    const settled = await Promise.all(
      slice.map((item, offset) => worker(item, start + offset))
    );
    settled.forEach((value, offset) => {
      results[start + offset] = value;
    });
  }

  return results;
}

/** Clamps a caller-supplied concurrency into a sane range (default 3, max 8). */
export function normalizeConcurrency(value: unknown, fallback = 3, max = 8): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}
