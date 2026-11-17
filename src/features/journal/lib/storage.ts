import { hotspots } from "../../../shared/content";
import type { Entry } from "../../../shared/types";
import { clamp, wrap } from "../../../shared/format";

const key = "tidal-journal-v2";
const legacyKey = "tidal-journal-v1";
const version = 2;

interface JournalFile {
  version: 2;
  entries: Entry[];
  savedAt: number;
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeCamera(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const camera = raw as Record<string, unknown>;
  if (
    typeof camera.yaw !== "number" ||
    !Number.isFinite(camera.yaw) ||
    typeof camera.pitch !== "number" ||
    !Number.isFinite(camera.pitch) ||
    typeof camera.fov !== "number" ||
    !Number.isFinite(camera.fov)
  )
    return null;
  return {
    yaw: wrap(camera.yaw),
    pitch: clamp(camera.pitch, -65, 65),
    fov: clamp(camera.fov, 35, 95),
  };
}

/**
 * Accept both the pre-upgrade raw array and the versioned file. A legacy
 * record lacks updatedAt and was written when a hotspot could only be saved
 * once; it becomes exactly one valid discovery, never a duplicate.
 */
function normalizeEntry(raw: unknown): Entry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    !candidate.id ||
    typeof candidate.hotspotId !== "string" ||
    !candidate.hotspotId
  )
    return null;
  const camera = normalizeCamera(candidate.camera);
  if (!camera) return null;
  const createdAt = finite(candidate.createdAt, Date.now());
  const hotspot = hotspots.find((h) => h.id === candidate.hotspotId);
  // Every migrated record came from an earlier, separate visit, so it gets
  // its own visit marker. It becomes exactly one valid discovery, and a later
  // rewatch of the same spot is allowed to become a new one.
  const visitId =
    typeof candidate.visitId === "string" && candidate.visitId
      ? candidate.visitId
      : `legacy:${candidate.id}`;
  return {
    id: candidate.id,
    hotspotId: candidate.hotspotId,
    chapterId: text(candidate.chapterId, hotspot?.chapterId ?? ""),
    time: Math.max(0, finite(candidate.time, 0)),
    camera,
    title: text(candidate.title, hotspot?.title ?? "未命名发现"),
    note: text(candidate.note).slice(0, 500),
    createdAt,
    updatedAt: finite(candidate.updatedAt, createdAt),
    visitId,
  };
}

function parse(raw: string | null): Entry[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const list = Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>).entries
        : null;
    if (!Array.isArray(list)) return null;
    const seen = new Set<string>();
    const entries: Entry[] = [];
    for (const item of list) {
      const entry = normalizeEntry(item);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
    return entries;
  } catch {
    return null;
  }
}

export function loadEntries(): Entry[] {
  try {
    const current = parse(localStorage.getItem(key));
    if (current) return current;

    const legacy = parse(localStorage.getItem(legacyKey));
    if (!legacy) return [];
    if (persist(legacy)) {
      // The upgrade happens once. Keeping the old key would resurrect old
      // entries after the new file is cleared.
      localStorage.removeItem(legacyKey);
      return legacy;
    }
    return legacy;
  } catch {
    return [];
  }
}

export function persist(entries: Entry[]): boolean {
  const file: JournalFile = { version, entries, savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/** Storage is only trusted after persist; drafts are never written to it. */

