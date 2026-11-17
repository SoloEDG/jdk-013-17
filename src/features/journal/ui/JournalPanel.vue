<script setup lang="ts">
import { ref } from "vue";
import {
  Download,
  Bookmark,
  Trash2,
  ArrowUpRight,
  Layers,
  ListTree,
  AlertTriangle,
  RotateCcw,
  FileWarning,
  Eye,
  X,
} from "lucide-vue-next";
import { timecode } from "../../../shared/format";
import type { Entry, StoryGroup } from "../../../shared/types";
import type { Journal } from "../model/entries";
import { exportDrafts, exportJournal } from "../lib/export";
import { kindLabel } from "../../hotspots/lib/visibility";

const props = defineProps<{ journal: Journal }>();
const emit = defineEmits<{ revisit: [entry: Entry] }>();

const picker = ref<string | null>(null);
const confirmStory = ref<StoryGroup | null>(null);

function openPicker(group: StoryGroup) {
  if (group.count === 1) revisit(group.entries[0]!);
  else picker.value = picker.value === group.hotspotId ? null : group.hotspotId;
}

function removeStory() {
  if (!confirmStory.value) return;
  props.journal.removeStory(confirmStory.value.hotspotId);
  picker.value = null;
  confirmStory.value = null;
}

function cameraSummary(entry: Entry) {
  return `视角 ${Math.round(entry.camera.yaw)}° / ${Math.round(entry.camera.pitch)}°`;
}

function discoveryLabel(index: number, total: number) {
  return total > 1 ? `第 ${index + 1} 次发现` : "这次发现";
}

function revisit(entry: Entry) {
  picker.value = null;
  emit("revisit", entry);
}
</script>
<template>
  <section class="journal-panel">
    <div class="panel-heading">
      <div>
        <small>YOUR FIELD NOTES</small>
        <h2>
          探索手记
          <em>{{ journal.storyCount.value }}</em>
          <span class="count-split"
            >个故事 · {{ journal.discoveryCount.value }} 次发现</span
          >
        </h2>
      </div>
      <div class="panel-actions">
        <button
          class="text-button"
          :disabled="!journal.discoveryCount.value && !journal.draftCount.value"
          @click="
            exportJournal(
              journal.entries.value,
              journal.drafts.value.map((d) => ({
                entry: d.entry,
                reason: d.reason,
              })),
            )
          "
        >
          <Download :size="16" /> 导出手记
        </button>
      </div>
    </div>

    <div class="journal-views" role="tablist" aria-label="手记浏览方式">
      <button
        role="tab"
        :aria-selected="journal.view.value === 'stories'"
        :class="{ active: journal.view.value === 'stories' }"
        @click="journal.view.value = 'stories'"
      >
        <Layers :size="14" /> 按故事合并 <em>{{ journal.storyCount.value }}</em>
      </button>
      <button
        role="tab"
        :aria-selected="journal.view.value === 'discoveries'"
        :class="{ active: journal.view.value === 'discoveries' }"
        @click="journal.view.value = 'discoveries'"
      >
        <ListTree :size="14" /> 按发现浏览
        <em>{{ journal.discoveryCount.value }}</em>
      </button>
    </div>

    <p v-if="journal.error.value" class="journal-error" role="alert">
      <AlertTriangle :size="14" /> {{ journal.error.value }}
      <button aria-label="关闭提示" @click="journal.clearError()">
        <X :size="13" />
      </button>
    </p>

    <section
      v-if="journal.drafts.value.length"
      class="draft-shelf"
      aria-label="未保存草稿"
    >
      <div class="draft-heading">
        <div>
          <small><FileWarning :size="13" /> NOT SAVED</small>
          <h3>
            未保存草稿
            <em>{{ journal.draftCount.value }}</em>
          </h3>
          <p>
            这些修改没有写入浏览器存储，刷新后会消失。导出后仍保留完整内容；不要把它们当作已保存的记录。
          </p>
        </div>
        <button
          class="text-button"
          @click="
            exportDrafts(
              journal.drafts.value.map((d) => ({
                entry: d.entry,
                reason: d.reason,
              })),
            )
          "
        >
          <Download :size="15" /> 导出草稿
        </button>
      </div>
      <article
        v-for="draft in journal.drafts.value"
        :key="draft.id"
        class="draft-entry"
      >
        <small
          >{{ draft.reason === "new" ? "新增未保存" : "修改未保存" }} ·
          {{ draft.entry.title }} ·
          {{ timecode(draft.entry.time) }}</small
        >
        <p>{{ draft.entry.note || "（尚未写下感想）" }}</p>
        <div class="draft-actions">
          <button class="text-button" @click="journal.retryDraft(draft.id)">
            <RotateCcw :size="14" /> 重试保存
          </button>
          <button class="text-button" @click="journal.dropDraft(draft.id)">
            <Trash2 :size="14" /> 放弃草稿
          </button>
        </div>
      </article>
    </section>

    <div
      v-if="!journal.discoveryCount.value && !journal.draftCount.value"
      class="empty"
    >
      <Bookmark />
      <h3>每一次发现，都值得留下</h3>
      <p>在全景画面中点击热点，将感兴趣的故事收藏在这里。</p>
      <p class="empty-hint">
        同一个故事可以收藏多次：换个视角、回到主线不同时间，都会成为一次独立发现。
      </p>
    </div>

    <template v-else-if="journal.view.value === 'stories'">
      <article
        v-for="group in journal.groups.value"
        :key="group.hotspotId"
        class="story-group"
      >
        <header class="story-head">
          <div>
            <small>
              {{ group.kind ? kindLabel(group.kind) : "发现" }} ·
              {{ group.chapterTitle }} · 共 {{ group.count }} 次发现
            </small>
            <h3>{{ group.title }}</h3>
            <p v-if="group.summary" class="story-summary">
              {{ group.summary }}
            </p>
          </div>
          <div class="story-actions">
            <button class="text-button" @click="openPicker(group)">
              <Eye :size="14" />
              回到现场<template v-if="group.count > 1">（选择经历）</template>
              <ArrowUpRight :size="15" />
            </button>
            <button
              class="text-button danger"
              @click="confirmStory = group"
            >
              <Trash2 :size="14" /> 删除整个故事
            </button>
          </div>
        </header>

        <div v-if="picker === group.hotspotId" class="story-picker">
          <p>这个故事的每一次发现都保留了当时的镜头与主线时间，请选择要重现的一次。</p>
          <button
            v-for="(entry, index) in group.entries"
            :key="entry.id"
            class="picker-option"
            @click="revisit(entry)"
          >
            <span class="picker-index">{{ index + 1 }}</span>
            <span>
              <b>{{ discoveryLabel(index, group.count) }}</b>
              <small
                >{{ timecode(entry.time) }} · {{ cameraSummary(entry) }} ·
                {{
                  new Date(entry.createdAt).toLocaleString("zh-CN")
                }}</small
              >
              <span class="picker-note">{{
                entry.note || "（尚未写下感想）"
              }}</span>
            </span>
          </button>
          <button class="text-button" @click="picker = null">收起</button>
        </div>

        <ol class="discovery-list">
          <li
            v-for="(entry, index) in group.entries"
            :key="entry.id"
            class="discovery"
          >
            <div class="discovery-meta">
              <small
                >{{ discoveryLabel(index, group.count) }} ·
                {{ timecode(entry.time) }} · {{ cameraSummary(entry) }} ·
                {{
                  new Date(entry.createdAt).toLocaleDateString("zh-CN")
                }}</small
              >
              <button class="icon-button" @click="revisit(entry)">
                重现这次 <ArrowUpRight :size="14" />
              </button>
            </div>
            <textarea
              aria-label="记录这次发现的感想"
              maxlength="500"
              :value="entry.note"
              placeholder="写下此刻的感受…"
              @change="
                journal.note(
                  entry.id,
                  ($event.target as HTMLTextAreaElement).value,
                )
              "
            />
            <button
              class="delete discover-delete"
              :aria-label="`删除第 ${index + 1} 次发现`"
              @click="journal.remove(entry.id)"
            >
              <Trash2 :size="14" /> 删除这次
            </button>
          </li>
        </ol>
      </article>
    </template>

    <template v-else>
      <article
        v-for="entry in journal.entries.value
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)"
        :key="entry.id"
        class="journal-entry"
      >
        <div>
          <small
            >{{ timecode(entry.time) }} · {{ cameraSummary(entry) }} ·
            {{ new Date(entry.createdAt).toLocaleString("zh-CN") }} ·
            {{
              journal.entries.value.filter(
                (e) => e.hotspotId === entry.hotspotId,
              ).length
            }}
            次发现中的一次</small
          >
          <h3>{{ entry.title }}</h3>
        </div>
        <button class="text-button" @click="revisit(entry)">
          回到现场 <ArrowUpRight :size="16" /></button
        ><textarea
          aria-label="记录感想"
          maxlength="500"
          :value="entry.note"
          placeholder="写下此刻的感受…"
          @change="
            journal.note(entry.id, ($event.target as HTMLTextAreaElement).value)
          "
        /><button
          class="delete"
          aria-label="删除这次发现"
          @click="journal.remove(entry.id)"
        >
          <Trash2 :size="15" />
        </button>
      </article>
    </template>

    <div
      v-if="confirmStory"
      class="modal-backdrop"
      @click.self="confirmStory = null"
    >
      <section
        class="about confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="删除整个故事"
      >
        <small>REMOVE STORY</small>
        <h2>删除《{{ confirmStory.title }}》？</h2>
        <p>
          这个故事下的 {{ confirmStory.count }} 次发现与各自的感想都会删除，热点将回到未收藏状态。此操作无法撤销。
        </p>
        <div class="confirm-actions">
          <button class="text-button" @click="confirmStory = null">
            取消
          </button>
          <button class="primary" @click="removeStory">
            <Trash2 :size="14" /> 删除全部 {{ confirmStory.count }} 次发现
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
