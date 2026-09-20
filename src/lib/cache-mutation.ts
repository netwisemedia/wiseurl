export async function deleteLinkThenInvalidate(
  deleteLink: () => Promise<void>,
  invalidate: () => Promise<void>,
): Promise<{ deleted: true; cacheSynced: boolean; warning: string | null }> {
  await deleteLink()
  try {
    await invalidate()
    return { deleted: true, cacheSynced: true, warning: null }
  } catch (error) {
    return {
      deleted: true,
      cacheSynced: false,
      warning: error instanceof Error ? error.message : 'Cache synchronization failed',
    }
  }
}
