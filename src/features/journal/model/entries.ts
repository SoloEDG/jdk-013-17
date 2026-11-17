import { computed, ref } from "vue";
import type { Entry, Hotspot, Position } from "../../../shared/types";
import { loadEntries, persist } from "../lib/storage";
import {
  findSameExperience,
  groupEntries,
  isSameExperience,
} from "../lib/experience";

export type SaveStatus = "saved" | "duplicate" | "failed";
export interface SaveResult {
  status: SaveStatus;
  entry?: Entry;
  message?: string;
}
export interface Draft {
  id: string;
  entry: Entry;
  reason: "new" | "edit";
  message: string;
}

const DUPLICATE_MESSAGE = "这次视角已经记录过了，换个角度或回到不同的时间再收藏";
const STORAGE_MESSAGE = "本地空间不足，此次修改未保存。它作为未保存草稿保留在此页面，可先导出。";

export function createJournal() {
  const entries = ref<Entry[]>(loadEntries()),
    drafts = ref<Draft[]>([]),
    error = ref(""),
    view = ref<"stories" | "discoveries">("stories"),
    rewatch = ref<string | null>(null);

  const groups = computed(() => groupEntries(entries.value));
  const storyCount = computed(() => groups.value.length);
  const discoveryCount = computed(() => entries.value.length);
  const draftCount = computed(() => drafts.value.length);

  /** Persisted state changes only after the write succeeds. */
  function commit(next: Entry[]): boolean {
    if (!persist(next)) {
      error.value = STORAGE_MESSAGE;
      return false;
    }
    entries.value = next;
    error.value = "";
    return true;
  }

  function addDraft(entry: Entry, reason: Draft["reason"]) {
    const existing = drafts.value.find((draft) => draft.entry.id === entry.id);
    if (existing && reason === "new") return;
    drafts.value = [
      ...drafts.value.filter((draft) => draft.entry.id !== entry.id),
      { id: entry.id, entry, reason, message: STORAGE_MESSAGE },
    ];
  }

  function dropDraft(id: string) {
    drafts.value = drafts.value.filter((draft) => draft.entry.id !== id);
    if (!drafts.value.length && error.value === STORAGE_MESSAGE) error.value = "";
  }

  function has(hotspotId: string) {
    return entries.value.some((entry) => entry.hotspotId === hotspotId);
  }

  function countFor(hotspotId: string) {
    return entries.value.filter((entry) => entry.hotspotId === hotspotId).length;
  }

  function draftFor(id: string) {
    return drafts.value.find((draft) => draft.entry.id === id);
  }

  function sameExperience(hotspotId: string, position: Position, visitId?: string) {
    return findSameExperience(entries.value, hotspotId, position, visitId);
  }

  /** True when the current view already sits in the unsaved draft shelf. */
  function hasDraftFor(hotspotId: string, position: Position) {
    return drafts.value.some(
      (draft) =>
        draft.reason === "new" &&
        isSameExperience(draft.entry, { hotspotId, ...position }),
    );
  }

  function save(hotspot: Hotspot, position: Position, visitId?: string): SaveResult {
    const duplicate = sameExperience(hotspot.id, position, visitId);
    if (duplicate) {
      return {
        status: "duplicate",
        entry: duplicate,
        message: DUPLICATE_MESSAGE,
      };
    }
    const pending = drafts.value.find(
      (draft) =>
        draft.reason === "new" &&
        isSameExperience(draft.entry, { hotspotId: hotspot.id, ...position }),
    );
    if (pending) {
      return {
        status: "failed",
        entry: pending.entry,
        message: "这次发现仍以未保存草稿的形式留在手记里，请先重试保存或导出。",
      };
    }
    const now = Date.now();
    const entry: Entry = {
      id: crypto.randomUUID(),
      hotspotId: hotspot.id,
      chapterId: position.chapterId,
      time: position.time,
      camera: { ...position.camera },
      title: hotspot.title,
      note: "",
      createdAt: now,
      updatedAt: now,
      visitId,
    };
    if (!commit([...entries.value, entry])) {
      addDraft(entry, "new");
      return { status: "failed", entry, message: STORAGE_MESSAGE };
    }
    return { status: "saved", entry };
  }

  function note(id: string, note: string) {
    const current = entries.value.find((entry) => entry.id === id);
    if (!current || current.note === note.slice(0, 500)) return true;
    const next = { ...current, note: note.slice(0, 500), updatedAt: Date.now() };
    if (
      commit(entries.value.map((entry) => (entry.id === id ? next : entry)))
    ) {
      dropDraft(id);
      return true;
    }
    addDraft(next, "edit");
    return false;
  }

  /** Removing one discovery keeps the story and the hotspot saved state. */
  function remove(id: string) {
    const next = entries.value.filter((entry) => entry.id !== id);
    if (next.length === entries.value.length) return false;
    if (!commit(next)) return false;
    dropDraft(id);
    return true;
  }

  /** Removing a story removes every discovery under it. */
  function removeStory(hotspotId: string) {
    const removed = new Set(
      entries.value
        .filter((entry) => entry.hotspotId === hotspotId)
        .map((entry) => entry.id),
    );
    const hasDrafts = drafts.value.some(
      (draft) => draft.entry.hotspotId === hotspotId,
    );
    if (!removed.size && !hasDrafts) return false;
    const next = entries.value.filter(
      (entry) => entry.hotspotId !== hotspotId,
    );
    if (removed.size && !commit(next)) return false;
    drafts.value = drafts.value.filter(
      (draft) => draft.entry.hotspotId !== hotspotId,
    );
    if (!removed.size) error.value = "";
    return true;
  }
  /** Retry a failed write from the draft list, without pretending it was saved. */
  function retryDraft(id: string) {
    const draft = drafts.value.find((item) => item.id === id);
    if (!draft) return false;
    const exists = entries.value.some((entry) => entry.id === id);
    const next = exists
      ? entries.value.map((entry) => (entry.id === id ? draft.entry : entry))
      : [...entries.value, draft.entry];
    if (!commit(next)) return false;
    dropDraft(id);
    return true;
  }

  function clearError() {
    error.value = "";
  }

  return {
    entries,
    drafts,
    error,
    view,
    groups,
    storyCount,
    discoveryCount,
    draftCount,
    has,
    countFor,
    draftFor,
    hasDraftFor,
    sameExperience,
    save,
    note,
    remove,
    removeStory,
    retryDraft,
    dropDraft,
    clearError,
  };
}
export type Journal = ReturnType<typeof createJournal>;
