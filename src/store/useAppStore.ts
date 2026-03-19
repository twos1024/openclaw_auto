import { create } from "zustand";
import type { GatewayStatus } from "../services/serviceService";

// ─── Admin state ──────────────────────────────────────────────────────────────

export interface AdminStatus {
  isElevated: boolean;
  platform: string;
  elevationRequired: boolean;
  detail: string;
  suggestion: string;
}

// ─── Instance state ───────────────────────────────────────────────────────────

export interface InstanceRecord {
  id: string;
  displayName: string;
  systemPrompt: string;
  modelId: string;
  modelName: string;
  channelType: string;
  apiKeyRef: string;
  baseUrl: string;
  status: "created" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  totalTokensUsed: number;
  totalConversations: number;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface AppStore {
  // Admin
  adminStatus: AdminStatus | null;
  adminChecked: boolean;
  setAdminStatus: (status: AdminStatus) => void;

  // Gateway
  gatewayStatus: GatewayStatus | null;
  setGatewayStatus: (status: GatewayStatus) => void;

  // Instances
  instances: InstanceRecord[];
  instancesLoaded: boolean;
  setInstances: (instances: InstanceRecord[]) => void;
  addInstance: (instance: InstanceRecord) => void;
  updateInstance: (id: string, patch: Partial<InstanceRecord>) => void;
  removeInstance: (id: string) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Admin
  adminStatus: null,
  adminChecked: false,
  setAdminStatus: (status) =>
    set({ adminStatus: status, adminChecked: true }),

  // Gateway
  gatewayStatus: null,
  setGatewayStatus: (status) => set({ gatewayStatus: status }),

  // Instances
  instances: [],
  instancesLoaded: false,
  setInstances: (instances) => set({ instances, instancesLoaded: true }),
  addInstance: (instance) =>
    set((state) => ({ instances: [instance, ...state.instances] })),
  updateInstance: (id, patch) =>
    set((state) => ({
      instances: state.instances.map((inst) =>
        inst.id === id ? { ...inst, ...patch } : inst,
      ),
    })),
  removeInstance: (id) =>
    set((state) => ({
      instances: state.instances.filter((inst) => inst.id !== id),
    })),

  // UI
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
