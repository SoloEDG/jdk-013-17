<script setup lang="ts">
import { computed } from "vue";
import { X, ArrowUpRight, Check, BookmarkPlus } from "lucide-vue-next";
import type { Hotspot } from "../../../shared/types";
import { kindLabel } from "../lib/visibility";
const props = defineProps<{
  hotspot: Hotspot;
  count: number;
  /** True when the current time and viewpoint already exist under this story. */
  duplicate: boolean;
  /** True when this exact viewpoint is sitting in the unsaved draft shelf. */
  draft: boolean;
  message: string;
}>();
defineEmits<{ close: []; interview: []; save: [] }>();
const label = computed(() => {
  if (props.draft) return "这次发现尚未保存（草稿）";
  if (props.duplicate) return "这次视角已记录";
  if (props.count) return `＋ 再次收藏这次发现（已有 ${props.count} 次）`;
  return "＋ 收藏这个发现";
});
</script>
<template>
  <aside class="detail-card">
    <button class="close" aria-label="关闭热点" @click="$emit('close')">
      <X /></button
    ><small>{{ kindLabel(hotspot.kind) }} / FIELD NOTES</small>
    <h2>{{ hotspot.title }}</h2>
    <p>{{ hotspot.summary }}</p>
    <p v-if="count" class="detail-count">
      <Check :size="13" /> 已收藏，共 {{ count }} 次发现
    </p>
    <button v-if="hotspot.personId" class="primary" @click="$emit('interview')">
      进入人物访谈 <ArrowUpRight :size="16" /></button
    ><button
      class="text-button"
      :disabled="duplicate || draft"
      :aria-disabled="duplicate || draft"
      @click="$emit('save')"
    >
      <Check v-if="duplicate || draft" :size="14" /><BookmarkPlus
        v-else
        :size="14"
      />
      {{ label }}
    </button>
    <p v-if="message" class="detail-message" role="status">{{ message }}</p>
    <p v-else-if="duplicate" class="detail-message">
      当前镜头与主线时间已收藏过；转动视角或回看后再收藏，会成为一次新的发现。
    </p>
  </aside>
</template>
