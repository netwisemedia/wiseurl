import type { CacheFence } from './blob-cache'

export async function fenceThenMutate(
  fence: () => Promise<CacheFence>,
  mutate: () => Promise<void>,
  publish?: (fence: CacheFence) => Promise<boolean>,
): Promise<{ mutated: true; cacheSynced: boolean }> {
  const acquired = await fence()
  await mutate()
  return { mutated: true, cacheSynced: publish ? await publish(acquired) : true }
}
