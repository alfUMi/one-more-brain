import type { TagDto } from '@omb/shared'

/** Inbox count and tags shown in the sidebar. Pages call refresh() after they change items. */
export function useSidebar() {
  const inboxCount = useState<number | null>('sidebar-inbox', () => null)
  const tags = useState<TagDto[]>('sidebar-tags', () => [])
  /** Missed plus still due today. */
  const todayCount = useState<number | null>('sidebar-today', () => null)
  const api = useItemsApi()

  async function refresh() {
    const [counts, tagList, today] = await Promise.allSettled([
      api.counts('INBOX'),
      api.tags(),
      api.today(),
    ])
    if (counts.status === 'fulfilled') inboxCount.value = counts.value.ALL
    if (tagList.status === 'fulfilled') tags.value = tagList.value
    if (today.status === 'fulfilled') {
      todayCount.value = today.value.missed.length + today.value.today.length
    }
  }

  return { inboxCount, todayCount, tags, refresh }
}
