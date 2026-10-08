import { create } from 'zustand';
import { roleInfo, ROLES, type Role } from '@/domain';

// Who is signed in: the role switcher in the account menu (FR-62). The role is remembered in
// the browser. In version 1 it is a switch for the demo, not a login.

const KEY = 'stowline.role';

function stored(): Role {
  try {
    const v = localStorage.getItem(KEY);
    if (ROLES.some((r) => r.id === v)) return v as Role;
  } catch {
    // Storage can be blocked. The default role is the vessel planner.
  }
  return 'planner';
}

interface SessionStore {
  role: Role;
  setRole: (role: Role) => void;
  /** Bumped to ask the account menu to open, from "Switch role" in the read only strip. */
  menuSeq: number;
  openMenu: () => void;
}

export const useSessionStore = create<SessionStore>()((set) => ({
  role: stored(),
  menuSeq: 0,
  openMenu: () => set((s) => ({ menuSeq: s.menuSeq + 1 })),
  setRole(role) {
    try {
      localStorage.setItem(KEY, role);
    } catch {
      // Not fatal: the choice just does not persist.
    }
    set({ role });
  },
}));

export const currentSession = () => {
  const role = useSessionStore.getState().role;
  return { role, user: roleInfo(role).user };
};

export function resetSessionStore(): void {
  useSessionStore.setState({ role: stored() });
}
