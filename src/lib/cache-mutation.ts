export async function deleteLinkThenInvalidate(
  deleteLink: () => Promise<void>,
  invalidate: () => Promise<void>,
): Promise<void> {
  await deleteLink()
  await invalidate()
}
