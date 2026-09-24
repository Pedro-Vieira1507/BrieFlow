/** Ignore async responses after logout, account changes, reset or library navigation. */
export function captureWorkspaceScope(
  read: () => { user: { id: string } | null; workspaceVersion: number },
): () => boolean {
  const { user, workspaceVersion } = read();
  return () =>
    Boolean(
      user &&
      read().user?.id === user.id &&
      read().workspaceVersion === workspaceVersion,
    );
}
