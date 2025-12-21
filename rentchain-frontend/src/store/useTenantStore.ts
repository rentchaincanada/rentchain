// rentchain-frontend/src/store/useTenantStore.ts
import { create } from "zustand";

interface TenantStore {
  selectedTenantId: string | null;
  setSelectedTenant: (id: string | null) => void;
}

export const useTenantStore = create<TenantStore>((set) => ({
  selectedTenantId: null,
  setSelectedTenant: (id: string | null) => set({ selectedTenantId: id }),
}));
