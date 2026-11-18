<script setup lang="ts">
const sidebar = useSidebar()
onMounted(sidebar.refresh)
// Keep this browser's push subscription registered (it can rotate or move between accounts).
onMounted(() => void usePush().sync())
// Offline shell for everyone (push registers the same worker), and the capture outbox.
onMounted(() => void registerServiceWorker()?.catch(() => undefined))
const outbox = useOutbox()
onMounted(outbox.start)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppTopBar />
    <main class="mx-auto w-full max-w-[760px] min-w-0 flex-1 px-4 pt-8 pb-20 md:px-6 md:pt-12">
      <slot />
    </main>
  </div>
</template>
