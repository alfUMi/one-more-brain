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
          <AppIcon name="chevron-left" :stroke="2" />{{ back }}
        </button>
      </header>
      <h1 class="title">{{ title }}</h1>
      <main class="main">
        <slot />
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  padding: calc(var(--ion-safe-area-top, 0px) + 8px) 12px 4px;
}
.title {
  margin: 0;
  padding: 0 20px 12px;
  font-size: 26px;
  font-weight: 700;
}
.main {
  padding: 0 16px calc(var(--ion-safe-area-bottom, 0px) + 32px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.main :deep(.group) {
  background: var(--omb-surface);
  border: 1px solid var(--omb-border);
  border-radius: 14px;
  overflow: hidden;
}
.main :deep(.cap) {
  margin: 6px 4px 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--omb-text-muted);
}
.main :deep(.row) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border: 0;
  border-top: 1px solid var(--omb-border-muted);
  background: transparent;
  font: 500 15px var(--ion-font-family);
  color: var(--omb-text);
  text-align: left;
  box-sizing: border-box;
}
.main :deep(.row:first-child) {
  border-top: 0;
}
.main :deep(.row:disabled) {
  opacity: 1;
  color: var(--omb-text-muted);
}
.main :deep(.val) {
  margin-left: auto;
  font-size: 14px;
  color: var(--omb-text-muted);
  text-align: right;
}
.main :deep(.soon) {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--omb-text-muted);
  background: var(--omb-kind-bg);
  border-radius: 999px;
  padding: 3px 8px;
}
.main :deep(.pad) {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.main :deep(.note) {
  margin: 2px 4px 0;
}
</style>
