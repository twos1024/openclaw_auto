import { create } from "zustand";

export interface SkillSummary {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

interface SkillStore {
  skills: SkillSummary[];
  setSkills: (skills: SkillSummary[]) => void;
  upsertSkill: (skill: SkillSummary) => void;
}

export const useSkillStore = create<SkillStore>((set) => ({
  skills: [],
  setSkills: (skills) => set({ skills }),
  upsertSkill: (skill) =>
    set((state) => {
      const next = state.skills.filter((item) => item.id !== skill.id);
      return { skills: [skill, ...next] };
    }),
}));
