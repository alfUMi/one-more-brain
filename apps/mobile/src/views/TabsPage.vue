<script setup lang="ts">
import {
  IonBadge,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '../components/AppIcon.vue'
import { store } from '../lib/store'

const { t } = useI18n()
</script>

<template>
  <IonPage>
    <IonTabs>
      <IonRouterOutlet />
      <IonTabBar id="omb-tab-bar" slot="bottom">
        <IonTabButton tab="capture" href="/tabs/capture">
          <AppIcon name="plus" :size="22" :stroke="2" />
          <IonLabel>{{ t('mobile.tabs.capture') }}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="inbox" href="/tabs/inbox">
          <AppIcon name="inbox" :size="22" />
          <IonBadge v-if="store.inbox.length" class="omb-badge">{{ store.inbox.length }}</IonBadge>
          <IonLabel>{{ t('mobile.tabs.inbox') }}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="today" href="/tabs/today">
          <AppIcon name="sun" :size="22" />
          <IonLabel>{{ t('mobile.tabs.today') }}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="library" href="/tabs/library">
          <AppIcon name="search" :size="22" />
          <IonLabel>{{ t('mobile.tabs.library') }}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>
