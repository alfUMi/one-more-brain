import type { TagDto } from '@omb/shared'

/** Inbox count and tags shown in the sidebar. Pages call refresh() after they change items. */
export function useSidebar() {
  const inboxCount = useState<number | null>('sidebar-inbox', () => null)
  const tags = useState<TagDto[]>('sidebar-tags', () => [])
  const api = useItemsApi()

  async function refresh() {
    const [counts, tagList] = await Promise.allSettled([api.counts('INBOX'), api.tags()])
    if (counts.status === 'fulfilled') inboxCount.value = counts.value.ALL
    if (tagList.status === 'fulfilled') tags.value = tagList.value
  }

  return { inboxCount, tags, refresh }
}
