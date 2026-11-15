/** Reactive navigator.onLine. */
export function useOnline() {
  const online = useState('online', () => (import.meta.client ? navigator.onLine : true))
  onMounted(() => {
    const update = () => (online.value = navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    onBeforeUnmount(() => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    })
  })
  return online
}
