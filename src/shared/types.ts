export interface Camera {
  yaw: number;
  pitch: number;
  fov: number;
}
export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  panorama: string;
  video: string;
  location: string;
  description: string;
}
export interface Hotspot {
  id: string;
  chapterId: string;
  title: string;
  kind: "person" | "archive" | "sound";
  start: number;
  end: number;
  yaw: number;
  pitch: number;
  summary: string;
  personId?: string;
}
export interface Person {
  id: string;
  name: string;
  role: string;
  quote: string;
  paragraphs: string[];
}
export interface Position {
  chapterId: string;
  time: number;
  camera: Camera;
  playing: boolean;
}
export interface Entry {
  id: string;
  hotspotId: string;
  chapterId: string;
  time: number;
  camera: Camera;
  title: string;
  note: string;
  createdAt: number;
  updatedAt?: number;
  /**
   * Which mainline visit produced this discovery. A second click during the
   * same visit is a duplicate; after navigating, rewinding or revisiting, a
   * new visit id is issued and the same spot may be saved again.
   */
  visitId?: string;
}
/**
 * A story is the shared layer of one hotspot. Its discoveries stay separate:
 * each one keeps the camera, mainline time and note that belonged to that visit.
 */
export interface StoryGroup {
  hotspotId: string;
  title: string;
  chapterId: string;
  chapterTitle: string;
  kind: Hotspot["kind"] | null;
  summary: string;
  entries: Entry[];
  count: number;
  firstAt: number;
  lastAt: number;
}
export type Command =
  | { type: "chapter"; id: string }
  | { type: "seek"; time: number }
  | { type: "hotspot"; id: string }
  | { type: "return" }
  | { type: "revisit"; entry: Entry };
