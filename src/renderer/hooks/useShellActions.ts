import { useOutletContext } from "react-router-dom";

export interface ShellOutletContext {
  openSetupAssistant: () => void;
  closeSetupAssistant: () => void;
}

export function useShellActions(): ShellOutletContext {
  return useOutletContext<ShellOutletContext>();
}
