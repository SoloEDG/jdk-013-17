import type { Entry, StoryGroup } from "../../../shared/types";
import { groupEntries } from "./experience";

export interface DraftExport {
  entryId: string;
  reason: "new" | "edit";
  /** Drafts were never written to storage and must not be counted as records. */
  saved: false;
  entry: Entry;
}

export interface JournalExport {
  version: 2;
  title: string;
  summary: {
    stories: number;
    discoveries: number;
    drafts: number;
  };
  stories: Array<
    Omit<StoryGroup, "entries"> & {
      discoveries: Array<Entry & { saved: true }>;
    }
  >;
  drafts: DraftExport[];
}

/**
 * Stories carry the shared layer once (title, chapter, hotspot summary);
 * discoveries stay independent inside each story, so an export never
 * collapses several visits into a single "latest" record.
 */
export function buildJournalExport(
  entries: Entry[],
  drafts: Array<{ entry: Entry; reason: "new" | "edit" }> = [],
): JournalExport {
  const groups = groupEntries(entries);
  return {
    version: 2,
    title: "潮汐之间 · 探索手记",
    summary: {
      stories: groups.length,
      discoveries: entries.length,
      drafts: drafts.length,
    },
    stories: groups.map(({ entries: discoveries, ...group }) => ({
      ...group,
      discoveries: discoveries.map((entry) => ({
        ...entry,
        saved: true as const,
      })),
    })),
    drafts: drafts.map((draft) => ({
      entryId: draft.entry.id,
      reason: draft.reason,
      saved: false,
      entry: draft.entry,
    })),
  };
}

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJournal(
  entries: Entry[],
  drafts: Array<{ entry: Entry; reason: "new" | "edit" }> = [],
) {
  download("潮汐之间-探索手记.json", buildJournalExport(entries, drafts));
}

export function exportDrafts(
  drafts: Array<{ entry: Entry; reason: "new" | "edit" }>,
) {
  download("潮汐之间-未保存草稿.json", buildJournalExport([], drafts));
}
