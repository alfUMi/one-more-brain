<script setup lang="ts">
import { IonContent, IonPage, useIonRouter } from '@ionic/vue'
import AppIcon from '../AppIcon.vue'

/** Layout of every settings screen: back link, big title, content. */
const props = defineProps<{ title: string; back: string; backTo: string }>()
const ionRouter = useIonRouter()

function goBack() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate(props.backTo, 'back', 'replace')
}
</script>

<template>
  <IonPage>
    <IonContent>
      <header class="top">
        <button type="button" class="omb-back" @click="goBack">
          <AppIcon name="chevron-left" :size="18" :stroke="1.8" />{{ back }}
        </button>
        <h1 class="title">{{ title }}</h1>
      </header>
      <main class="main">
        <slot />
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.top {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: calc(var(--ion-safe-area-top, 0px) + 12px) 16px 6px;
}
.title {
  margin: 0;
  padding: 0 6px;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.main {
  padding: 8px 16px calc(var(--ion-safe-area-bottom, 0px) + 32px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.main :deep(.group) {
  background: var(--omb-surface);
  border-radius: 20px;
  box-shadow: var(--omb-shadow-sm);
  overflow: hidden;
}
.main :deep(.cap) {
  padding: 14px 6px 0;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--omb-text-muted);
}
.main :deep(.row) {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 50px;
  margin: 0;
  padding: 0 18px;
  border: 0;
  border-top: 1px solid var(--omb-divider);
  background: transparent;
  font: 400 15px var(--ion-font-family);
  color: var(--omb-text);
  text-align: left;
  box-sizing: border-box;
}
.main :deep(button.row:active:not(:disabled)) {
  background: var(--omb-surface-muted);
}
.main :deep(.row:first-child) {
  border-top: 0;
}
.main :deep(.row:disabled) {
  opacity: 1;
  color: var(--omb-text-faint);
}
.main :deep(.val) {
  margin-left: auto;
  font-size: 14px;
  color: var(--omb-text-muted);
  text-align: right;
}
.main :deep(.soon) {
  margin-left: auto;
  font-size: 12.5px;
  color: var(--omb-text-faint);
}
.main :deep(.pad) {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.main :deep(.note) {
  margin: 2px 6px 0;
}
</style>
