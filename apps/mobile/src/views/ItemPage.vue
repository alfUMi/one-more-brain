<script setup lang="ts">
import { Browser } from '@capacitor/browser'
import { IonContent, IonPage, onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { ITEM_STATUSES, type ItemDto, type ItemStatus } from '@omb/shared'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import KindIcon from '../components/KindIcon.vue'
import {
  acceptReminder,
  remember,
  remind,
  removeItem,
  removeReminder,
  saveBody,
  setStatus,
  setTags,
} from '../lib/actions'
import { formatter, hostOf } from '../lib/format'
import { confirmDelete, shareItem } from '../lib/itemMenu'
import { cacheGet, cachePut } from '../lib/prefs'
import { pickReminder } from '../lib/remind'
import { api, session } from '../lib/session'
import { store } from '../lib/store'

/** One note: read, edit, tag, remind, triage. Opened from any list. */
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const route = useRoute()
const ionRouter = useIonRouter()

const item = ref<ItemDto | null>(null)
const missing = ref(false)
const body = ref('')
const newTag = ref('')
const bodyEl = ref<HTMLTextAreaElement | null>(null)
const tagEl = ref<HTMLInputElement | null>(null)

function show(found: ItemDto) {
  item.value = found
  body.value = found.body ?? ''
}

/** Lists on the phone first (instant, works offline), then the server copy. */
async function findLocal(): Promise<ItemDto | null> {
  const id = props.id
  const local =
    store.inbox.find((x) => x.id === id) ??
    store.recent.find((x) => x.id === id) ??
    store.today?.reminders.find((r) => r.item.id === id)?.item ??
    store.today?.onThisDay.find((r) => r.item.id === id)?.item ??
    store.today?.reviews.find((r) => r.item.id === id)?.item
  if (local) return local
  const userId = session.profile?.id
  return userId ? ((await cacheGet<ItemDto>(userId, `item:${id}`))?.data ?? null) : null
}

onIonViewWillEnter(async () => {
  const local = await findLocal()
  if (local) show(local)
  try {
    const fresh = await api.get(props.id)
    show(fresh)
    if (session.profile) void cachePut(session.profile.id, `item:${fresh.id}`, fresh)
  } catch (error) {
    if ((error as { status?: number }).status === 404) missing.value = true
  }
  await nextTick()
  if (route.query.edit) bodyEl.value?.focus()
  if (route.query.tags) tagEl.value?.focus()
})

function back() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate('/tabs/inbox', 'back', 'replace')
}

async function apply(result: Promise<ItemDto | null>) {
  const saved = await result
  if (saved) show(saved)
}

async function saveText() {
  if (!item.value || body.value === (item.value.body ?? '')) return
  await apply(saveBody(item.value, body.value))
}

const confirmedTags = computed(
  () => item.value?.tags.filter((x) => !x.suggested).map((x) => x.name) ?? [],
)

async function addTag() {
  const name = newTag.value.trim().replace(/^#/, '').toLowerCase()
  if (!item.value || !name) return
  newTag.value = ''
  if (!confirmedTags.value.includes(name)) {
    await apply(setTags(item.value, [...confirmedTags.value, name]))
  }
}

async function confirmTag(name: string) {
  if (item.value) await apply(setTags(item.value, [...confirmedTags.value, name]))
}

async function dropTag(name: string) {
  if (item.value)
    await apply(
      setTags(
        item.value,
        confirmedTags.value.filter((x) => x !== name),
      ),
    )
}

async function addReminder() {
  if (!item.value) return
  const choice = await pickReminder()
  if (choice) await apply(remind(item.value, choice))
}

async function changeStatus(status: ItemStatus) {
  if (item.value && item.value.status !== status) await apply(setStatus(item.value, status))
}

async function del() {
  if (item.value && (await confirmDelete()) && (await removeItem(item.value))) back()
}

const reminders = computed(
  () => item.value?.reminders.filter((r) => r.status === 'ACTIVE' || r.status === 'FIRED') ?? [],
)
const images = computed(() => item.value?.attachments.filter((a) => a.kind !== 'AUDIO') ?? [])
</script>

<template>
  <IonPage>
    <IonContent>
      <header class="top">
        <button type="button" class="omb-back" @click="back">
          <AppIcon name="chevron-left" :stroke="2" />{{ t('mobile.back') }}
        </button>
        <div class="grow" />
        <button
          v-if="item"
          type="button"
          class="icon-btn"
          :aria-label="t('mobile.inbox.share')"
          @click="shareItem(item)"
        >
          <AppIcon name="share" />
        </button>
      </header>

      <div v-if="missing && !item" class="omb-empty">
        <p>{{ t('mobile.item.notFound') }}</p>
      </div>

      <main v-if="item" class="main">
        <div class="meta-row">
          <KindIcon :kind="item.kind" />
          <span class="omb-meta">
            {{
              t('mobile.item.captured', {
                when: formatter.relative(item.capturedAt),
                source: t(`sources.${item.source}`),
              })
            }}
          </span>
        </div>
        <h1 v-if="item.title" class="title">{{ item.title }}</h1>
        <blockquote v-if="item.quote" class="quote">“{{ item.quote }}”</blockquote>

        <button
          v-if="item.url"
          type="button"
          class="link omb-card"
          @click="Browser.open({ url: item.url })"
        >
          <span class="link-icon"><AppIcon name="link" :size="18" /></span>
          <span class="link-text">
            <span class="link-title">{{ item.pageTitle || hostOf(item.url) }}</span>
            <span class="link-host">{{ hostOf(item.url) }}</span>
          </span>
          <AppIcon name="external" :size="18" />
        </button>

        <img v-for="img in images" :key="img.id" :src="img.url" alt="" class="image" />

        <label class="omb-label">
          {{ t('mobile.item.text') }}
          <textarea
            ref="bodyEl"
            v-model="body"
            class="omb-input"
            rows="4"
            :placeholder="t('mobile.item.textPlaceholder')"
            @blur="saveText"
          />
        </label>

        <section v-if="item.extractedText" class="section">
          <h2>{{ t('mobile.item.imageText') }}</h2>
          <p class="extracted">{{ item.extractedText }}</p>
        </section>

        <section class="section">
          <h2>{{ t('mobile.item.reminders') }}</h2>
          <p v-if="!reminders.length" class="omb-hint">{{ t('mobile.item.noReminders') }}</p>
          <div v-for="r in reminders" :key="r.id" class="rem-row">
            <span class="omb-chip omb-chip-rem" :class="{ 'omb-chip-ai': r.isAiSuggested }">
              <AppIcon
                :name="r.kind === 'RECURRING' ? 'repeat' : 'clock'"
                :size="14"
                :stroke="2.2"
              />
              {{
                r.isAiSuggested
                  ? t('reminder.suggested', { when: formatter.reminder(r) })
                  : formatter.reminder(r)
              }}
            </span>
            <div class="grow" />
            <button
              v-if="r.isAiSuggested"
              type="button"
              class="omb-btn omb-btn-sm"
              @click="apply(acceptReminder(item, r))"
            >
              {{ t('actions.accept') }}
            </button>
            <button
              type="button"
              class="omb-btn omb-btn-sm omb-btn-ghost"
              :aria-label="t('reminder.remove')"
              @click="apply(removeReminder(item, r))"
            >
              <AppIcon name="x" :size="16" />
            </button>
          </div>
          <button type="button" class="omb-btn omb-btn-sm add" @click="addReminder">
            <AppIcon name="clock" :size="16" />{{ t('mobile.item.addReminder') }}
          </button>
        </section>

        <section class="section">
          <h2>{{ t('mobile.item.tags') }}</h2>
          <div class="chips">
            <span v-if="!item.tags.length" class="omb-hint">{{ t('mobile.item.noTags') }}</span>
            <span
              v-for="tag in item.tags"
              :key="tag.name"
              class="omb-chip"
              :class="tag.suggested ? 'omb-chip-ai' : 'omb-chip-tag'"
            >
              <button v-if="tag.suggested" type="button" @click="confirmTag(tag.name)">
                #{{ tag.name }}
              </button>
              <template v-else>#{{ tag.name }}</template>
              <button
                type="button"
                :aria-label="t('actions.remove')"
                @click="
                  tag.suggested
                    ? setTags(item, confirmedTags).then((s) => s && show(s))
                    : dropTag(tag.name)
                "
              >
                <AppIcon name="x" :size="13" :stroke="2.2" />
              </button>
            </span>
          </div>
          <form class="tag-form" @submit.prevent="addTag">
            <input
              ref="tagEl"
              v-model="newTag"
              class="omb-input"
              :placeholder="t('mobile.item.addTag')"
              autocapitalize="off"
              enterkeyhint="done"
            />
            <button type="submit" class="omb-btn" :disabled="!newTag.trim()">
              <AppIcon name="plus" :stroke="2" />
            </button>
          </form>
          <p v-if="item.tags.some((x) => x.suggested)" class="omb-hint">
            {{ t('inbox.hints.ai') }}
          </p>
        </section>

        <section class="section">
          <h2>{{ t('review.title') }}</h2>
          <p v-if="item.review" class="omb-hint">
            {{ t('mobile.item.reviewNext', { when: formatter.when(item.review.nextAt) }) }}
          </p>
          <button
            v-else
            type="button"
            class="omb-btn omb-btn-sm add"
            @click="apply(remember(item))"
          >
            <AppIcon name="repeat" :size="16" />{{ t('actions.remember') }}
          </button>
        </section>

        <section class="section">
          <h2>{{ t('mobile.item.status') }}</h2>
          <div class="omb-segment" role="group" :aria-label="t('mobile.item.status')">
            <button
              v-for="s in ITEM_STATUSES"
              :key="s"
              type="button"
              :aria-pressed="item.status === s"
              @click="changeStatus(s)"
            >
              {{ t(`statuses.${s}`) }}
            </button>
          </div>
        </section>

        <button type="button" class="omb-btn omb-btn-danger delete" @click="del">
          <AppIcon name="trash" :size="18" />{{ t('actions.delete') }}
        </button>
      </main>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: calc(var(--ion-safe-area-top, 0px) + 8px) 12px 4px;
}
.icon-btn {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--omb-text-toned);
  display: flex;
  align-items: center;
  justify-content: center;
}
.main {
  padding: 4px 20px calc(var(--ion-safe-area-bottom, 0px) + 32px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.quote {
  margin: 0;
  padding: 12px 14px;
  background: var(--omb-highlight-quote);
  border-radius: 12px;
  font-family: 'Source Serif 4', Georgia, serif;
  font-size: 17px;
  line-height: 1.55;
  color: var(--omb-quote-text);
}
.link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  text-align: left;
  font: inherit;
  color: var(--omb-text-muted);
}
.link-icon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--omb-link-bg);
  color: var(--omb-link-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.link-text {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.link-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--omb-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link-host {
  font-size: 13px;
  color: var(--omb-link);
}
.image {
  width: 100%;
  border-radius: 14px;
  background: var(--omb-hover);
}
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section h2 {
  margin: 0;
  font-size: 13px;
  font-family: var(--ion-font-family);
  font-weight: 600;
  color: var(--omb-text-toned);
}
.extracted {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--omb-text-toned);
  white-space: pre-wrap;
}
.rem-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.add {
  align-self: flex-start;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.tag-form {
  display: flex;
  gap: 8px;
}
.tag-form .omb-btn {
  flex: none;
  width: 48px;
  padding: 0;
}
.delete {
  margin-top: 8px;
}
</style>
