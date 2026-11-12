// @ts-nocheck
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getCurrentSession, loginWithPin, logoutCurrentSession } from '../lib/auth.functions';
import { User, Role, DEFAULT_PERMISSIONS } from '../constants/permissions';
import { db } from '../lib/db';
import { derivePasswordHash } from '../lib/authCrypto';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => void;
  hasPermission: (view: string) => boolean;
  isExecutive: () => boolean;
  users: User[];
  addUser: (u: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const getSession = useServerFn(getCurrentSession);
  const loginServer = useServerFn(loginWithPin);
  const logoutServer = useServerFn(logoutCurrentSession);

  useEffect(() => {
    let active = true;
    async function initAuth() {
      try {
        const [session, dbUsers] = await Promise.all([getSession(), db.users.toArray()]);
        if (!active) return;
        const safeUsers: User[] = dbUsers.map((u) => ({
          id: u.id, name: u.name, email: u.email, role: u.role as Role,
          permissions: u.permissions || { views: DEFAULT_PERMISSIONS[u.role] || [] },
          assignedExecutiveName: u.assignedExecutiveName,
          maintenanceMode: u.maintenanceMode,
        }));
        setUsers(safeUsers);
        if (session) {
          const role: Role = session.role === 'Admin' ? 'ADMIN' : 'EXECUTIVE';
          const local = safeUsers.find((u) => u.name.toLowerCase() === session.name.toLowerCase());
          setUser({
            id: local?.id || `session:${session.name}`,
            name: session.name,
            email: local?.email,
            role,
            permissions: { views: DEFAULT_PERMISSIONS[role] || [] },
            assignedExecutiveName: local?.assignedExecutiveName || session.name,
            maintenanceMode: local?.maintenanceMode,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to restore authenticated session', err);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void initAuth();
    return () => { active = false; };
  }, [getSession]);

  const login = async (identifier: string, pin: string): Promise<User> => {
    const result = await loginServer({ data: { executiveName: identifier.trim(), pin } });
    const role: Role = result.role === 'Admin' ? 'ADMIN' : 'EXECUTIVE';
    const local = (await db.users.toArray()).find(
      (u) => u.name.trim().toLowerCase() === result.name.toLowerCase(),
    );
    const safeUser: User = {
      id: local?.id || `session:${result.name}`,
      name: result.name,
      email: local?.email,
      role,
      permissions: local?.permissions || { views: DEFAULT_PERMISSIONS[role] || [] },
      assignedExecutiveName: local?.assignedExecutiveName || result.name,
      maintenanceMode: local?.maintenanceMode,
    };
    setUser(safeUser);
    return safeUser;
  };

  const logout = async () => {
    try {
      await logoutServer();
    } finally {
      setUser(null);
    }
  };

  const hasPermission = (view: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN' || view === 'connectivity_hub') return true;
    return user.permissions?.views?.includes(view) ?? false;
  };

  const isExecutive = () => user?.role === 'EXECUTIVE';

  const addUser = async (u: Omit<User, 'id'> & { password?: string }) => {
    const id = crypto.randomUUID();
    const pw = u.password || 'Admin@123';
    const derived = await derivePasswordHash(pw);
    const { password, ...userWithoutPassword } = u;
    
    const newUser = { 
      ...userWithoutPassword, 
      id, 
      passwordHash: derived.hash,
      salt: derived.salt,
      iterations: derived.iterations,
      createdAt: new Date().toISOString(),
    };
    
    setUsers(prev => [...prev, { ...userWithoutPassword, id }]);
    await db.users.put(newUser as import('../types/domain').User);
  };

  const updateUser = async (id: string, data: Partial<User> & { password?: string }) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    const existing = await db.users.get(id);
    if (existing) {
      const updatePayload: Partial<import('../types/domain').User> = { ...existing, ...data };
      if (data.password) {
        const derived = await derivePasswordHash(data.password);
        updatePayload.passwordHash = derived.hash;
        updatePayload.salt = derived.salt;
        updatePayload.iterations = derived.iterations;
        delete updatePayload.password;
      }
      
      await db.users.update(id, updatePayload);

      // If name changed, ripple it through the database
      if (data.name && data.name !== existing.name) {
          const oldName = existing.name;
          const newName = data.name;

          // 1. Update loan_records
          const recordsToUpdate = await db.loan_records.filter(r => r.executive_name === oldName || r['Executive Name'] === oldName).toArray();
          if (recordsToUpdate.length > 0) {
              const updatedRecords = recordsToUpdate.map(r => ({ ...r, executive_name: newName, ['Executive Name']: newName }));
              await db.loan_records.bulkPut(updatedRecords);
          }

          // 2. Update customer_feedbacks
          const feedbacksToUpdate = await db.customer_feedbacks.where('agentId').equals(id).toArray();
          if (feedbacksToUpdate.length > 0) {
              const updatedFeedbacks = feedbacksToUpdate.map(f => ({ ...f, agentName: newName }));
              await db.customer_feedbacks.bulkPut(updatedFeedbacks);
          }

          // 3. Update attendance_logs
          const attendanceToUpdate = await db.attendance_logs.where('userId').equals(id).toArray();
          if (attendanceToUpdate.length > 0) {
              const updatedAttendance = attendanceToUpdate.map(a => ({ ...a, userName: newName }));
              await db.attendance_logs.bulkPut(updatedAttendance);
          }
      }
    }
  };

  const deleteUser = async (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    await db.users.delete(id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, isExecutive, users, addUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
