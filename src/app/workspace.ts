import { computed, ref } from "vue";
import { createCamera } from "../features/panorama";
import { createPlayback } from "../features/chapters";
import { createDiscovery } from "../features/hotspots";
import { createBranch } from "../features/interviews";
import { createJournal } from "../features/journal";
import type { Command, Position } from "../shared/types";
export function createWorkspace() {
  const camera = createCamera(),
    playback = createPlayback(),
    discovery = createDiscovery(() => playback.state),
    branch = createBranch(),
    journal = createJournal(),
    tab = ref("story"),
    saveMessage = ref(""),
    visitId = ref(crypto.randomUUID());
  const newVisit = () => (visitId.value = crypto.randomUUID());
  const position = (): Position => ({
    chapterId: playback.state.chapterId,
    time: playback.state.time,
    camera: { ...camera.camera },
    playing: playback.state.playing,
  });
  function enterPerson(id: string) {
    branch.enter(id, position());
    playback.state.playing = false;
    discovery.close();
    saveMessage.value = "";
  }
  function dispatch(command: Command) {
    switch (command.type) {
      case "chapter":
        if (branch.personId.value) return;
        playback.select(command.id);
        camera.reset();
        discovery.close();
        saveMessage.value = "";
        newVisit();
        break;
      case "seek":
        playback.seek(command.time);
        saveMessage.value = "";
        newVisit();
        break;
      case "hotspot":
        discovery.select(command.id);
        saveMessage.value = "";
        break;
      case "return": {
        const saved = branch.leave();
        if (saved) {
          playback.select(saved.chapterId);
          playback.seek(saved.time);
          camera.restore(saved.camera);
          playback.state.playing = saved.playing;
          newVisit();
        }
        break;
      }
      case "revisit":
        branch.leave();
        playback.select(command.entry.chapterId);
        playback.seek(command.entry.time);
        camera.restore(command.entry.camera);
        discovery.select(command.entry.hotspotId);
        saveMessage.value = "";
        newVisit();
        tab.value = "story";
        break;
    }
  }
  /** Reads the live position, so the duplicate check reflects the current view. */
  const duplicate = computed(() => {
    const hotspot = discovery.detail.value;
    return (
      !!hotspot &&
      !!journal.sameExperience(hotspot.id, position(), visitId.value)
    );
  });
  const draft = computed(() => {
    const hotspot = discovery.detail.value;
    return !!hotspot && journal.hasDraftFor(hotspot.id, position());
  });
  function save() {
    const hotspot = discovery.detail.value;
    if (!hotspot) return;
    const result = journal.save(hotspot, position(), visitId.value);
    saveMessage.value =
      result.status === "saved"
        ? `已记录第 ${journal.countFor(hotspot.id)} 次发现`
        : (result.message ?? "");
  }
  return {
    camera,
    playback,
    discovery,
    branch,
    journal,
    tab,
    saveMessage,
    visitId,
    position,
    duplicate,
    draft,
    enterPerson,
    dispatch,
    save,
  };
}
