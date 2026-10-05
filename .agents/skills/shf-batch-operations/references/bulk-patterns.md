# Bulk Patterns & Concurrency Control

When performing bulk updates (e.g. updating 500 identities or triggering 100 workflow runs), naive loops will saturate the network and trigger HTTP 429 errors.

## Chunking & Throttling Pattern

Use an async queue or chunker to control concurrency:

```typescript
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  concurrencyLimit: number,
  worker: (chunk: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  // Split into chunks
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  // Process chunks with concurrency limit
  let index = 0;
  async function next(): Promise<void> {
    while (index < chunks.length) {
      const current = index++;
      const result = await worker(chunks[current]);
      results[current] = result;
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, chunks.length) }, () => next());
  await Promise.all(workers);

  return results;
}
```

---

## 429 Exponential Backoff Pattern

Wrap API calls with an automatic retry handler that honors `Retry-After`:

```typescript
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }

      // Check if response is HTTP 429
      const isRateLimited = error?.status === 429 || error?.statusCode === 429;
      if (!isRateLimited && error?.status < 500) {
        // Do not retry 4xx errors other than 429
        throw error;
      }

      // Check for Retry-After header
      const retryAfterHeader = error?.headers?.get?.('Retry-After');
      let delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      if (retryAfterHeader) {
        const seconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(seconds)) {
          delayMs = seconds * 1000;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```
