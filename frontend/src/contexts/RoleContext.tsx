import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type Role = 'manager' | 'member';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  memberEntityId: string | null;
  setMemberEntityId: (id: string | null) => void;
  isManager: boolean;
  isMember: boolean;
  isOwnEntity: (entityId: string) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

const ROLE_KEY = 'waldur-fed-role';
const ENTITY_KEY = 'waldur-fed-member-entity-id';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem(ROLE_KEY);
    return stored === 'member' ? 'member' : 'manager';
  });

  const [memberEntityId, setMemberEntityIdState] = useState<string | null>(() => {
    return localStorage.getItem(ENTITY_KEY);
  });

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(ROLE_KEY, r);
  }, []);

  const setMemberEntityId = useCallback((id: string | null) => {
    setMemberEntityIdState(id);
    if (id) {
      localStorage.setItem(ENTITY_KEY, id);
    } else {
      localStorage.removeItem(ENTITY_KEY);
    }
  }, []);

  // Clear member entity if switching to manager
  useEffect(() => {
    if (role === 'manager') {
      setMemberEntityIdState(null);
      localStorage.removeItem(ENTITY_KEY);
    }
  }, [role]);

  const isOwnEntity = useCallback(
    (entityId: string) => role === 'member' && memberEntityId != null && entityId === memberEntityId,
    [role, memberEntityId],
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        memberEntityId,
        setMemberEntityId,
        isManager: role === 'manager',
        isMember: role === 'member',
        isOwnEntity,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
