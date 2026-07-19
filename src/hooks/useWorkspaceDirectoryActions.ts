import { open } from "@tauri-apps/plugin-dialog";
import type { Dispatch, SetStateAction } from "react";
import type { AppSettings } from "../model";

type Params = {
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

export function useWorkspaceDirectoryActions({ setSettings, updateSetting }: Params) {
  async function chooseOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") updateSetting("outputDir", selected);
  }

  async function addRootDirs() {
    const selected = await open({ directory: true, multiple: true });
    const picked = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    if (picked.length === 0) return;
    setSettings((current) => ({
      ...current,
      rootDirs: [...new Set([...current.rootDirs, ...picked])],
    }));
  }

  function removeRootDir(dir: string) {
    setSettings((current) => ({ ...current, rootDirs: current.rootDirs.filter((item) => item !== dir) }));
  }

  return { chooseOutputDir, addRootDirs, removeRootDir };
}
