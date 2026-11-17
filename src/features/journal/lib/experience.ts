import { chapters, hotspots } from "../../../shared/content";
import type { Camera, Entry, Position, StoryGroup } from "../../../shared/types";

/**
 * Two records describe the same discovery when they share the story,
 * chapter and viewpoint. During one visit (the stretch of mainline between
 * two explicit seeks or chapter changes) the same viewpoint can only be
 * saved once, which stops a double click from creating a run of identical
 * experiences. After a new visit — scrubbing the timeline, choosing another
 * chapter, or reopening a record from the journal — the same spot may be
 * saved again, because that is a deliberate rewatch.
 *
 * Any record without a visit marker (for example a file written by an older
 * build) falls back to a small time window when deciding whether the next
 * save is an accidental repeat.
 */
export const SAME_TIME_WINDOW = 2;
export const SAME_YAW_WINDOW = 3;
export const SAME_PITCH_WINDOW = 3;
export const SAME_FOV_WINDOW = 2;

type Experience = Pick<
  Entry,
  "hotspotId" | "chapterId" | "time" | "camera" | "visitId"
>;

export function angleDistance(a: number, b: number) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export function sameViewpoint(a: Camera, b: Camera) {
  return (
    angleDistance(a.yaw, b.yaw) <= SAME_YAW_WINDOW &&
    Math.abs(a.pitch - b.pitch) <= SAME_PITCH_WINDOW &&
    Math.abs(a.fov - b.fov) <= SAME_FOV_WINDOW
  );
}

export function isSameExperience(a: Experience, b: Experience) {
  if (a.hotspotId !== b.hotspotId || a.chapterId !== b.chapterId) return false;
  if (!sameViewpoint(a.camera, b.camera)) return false;
  // One visit keeps at most one record per viewpoint, so repeatedly pressing
  // the bookmark button cannot create a run of identical experiences, even
  // while the mainline keeps playing and the clock drifts. A new visit (seek,
  // chapter change, interview return, journal revisit) makes the same
  // viewpoint eligible again, because that is a deliberate rewatch.
  if (a.visitId && b.visitId) return a.visitId === b.visitId;
  // Records without a visit marker (older files) use the time window.
  return Math.abs(a.time - b.time) <= SAME_TIME_WINDOW;
}

export function findSameExperience<T extends Experience>(
  entries: T[],
  hotspotId: string,
  position: Pick<Position, "chapterId" | "time" | "camera">,
  visitId?: string,
) {
  return entries.find((entry) =>
    isSameExperience(entry, { hotspotId, ...position, visitId }),
  );
}

/**
 * Shared layer of a story: title, kind, chapter and summary are owned by the
 * hotspot definition. Independent layer: every entry keeps the camera,
 * mainline time, note and timestamps of that particular visit.
 */
export function groupEntries(entries: Entry[]): StoryGroup[] {
  const byHotspot = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = byHotspot.get(entry.hotspotId);
    if (list) list.push(entry);
    else byHotspot.set(entry.hotspotId, [entry]);
  }
  const groups: StoryGroup[] = [];
  for (const [hotspotId, list] of byHotspot) {
    // Sort is stable, so two discoveries saved in the same millisecond keep
    // the order in which they were made instead of flipping by random id.
    const ordered = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const latest = ordered[ordered.length - 1]!;
    const first = ordered[0]!;
    const hotspot = hotspots.find((h) => h.id === hotspotId);
    const chapterId = hotspot?.chapterId ?? latest.chapterId;
    groups.push({
      hotspotId,
      title: hotspot?.title ?? latest.title,
      chapterId,
      chapterTitle:
        chapters.find((c) => c.id === chapterId)?.title ?? chapterId,
      kind: hotspot?.kind ?? null,
      summary: hotspot?.summary ?? "",
      entries: ordered,
      count: ordered.length,
      firstAt: first.createdAt,
      lastAt: latest.createdAt,
    });
  }
  return groups.sort((a, b) => b.lastAt - a.lastAt);
}
