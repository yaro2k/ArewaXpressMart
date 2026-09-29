import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken, type User } from './api';
type AuthContextValue = { user: User | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (input: Record<string, string>) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) { const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = async () => { try { const result = await api.me(); setUser(result); } catch { setAccessToken(null); setUser(null); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, refresh, login: async (email, password) => { setError(null); const result = await api.login({ email, password }); setAccessToken(result.accessToken); try { await api.mergeCart(); } catch (mergeError) { setError(`Your account is signed in, but your previous cart could not be merged: ${(mergeError as Error).message}`); } setUser(result.user); }, register: async (input) => { setError(null); await api.register(input); }, logout: async () => { await api.logout().catch(() => undefined); setAccessToken(null); setUser(null); } }), [user, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
