import { create } from "zustand";
import type { GatewayStatus } from "@/services/serviceService";

export interface AdminStatus {
  isElevated: boolean;
  platform: string;
  elevationRequired: boolean;
  detail: string;
  suggestion: string;
}

interface GatewayStore {
  adminStatus: AdminStatus | null;
  adminChecked: boolean;
  gatewayStatus: GatewayStatus | null;
  setAdminStatus: (status: AdminStatus) => void;
  setGatewayStatus: (status: GatewayStatus) => void;
}

export const useGatewayStore = create<GatewayStore>((set) => ({
  adminStatus: null,
  adminChecked: false,
  gatewayStatus: null,
  setAdminStatus: (status) => set({ adminStatus: status, adminChecked: true }),
  setGatewayStatus: (status) => set({ gatewayStatus: status }),
}));
