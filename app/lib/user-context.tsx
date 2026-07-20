'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface GitHubUser {
  id: string;
  login: string;
  avatar_url: string;
  name: string;
}

interface UserContextType {
  user: GitHubUser | null;
  isLoading: boolean;
  isAuthReady: boolean;
  login: () => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  isAuthReady: false,
  login: () => {},
  logout: () => {},
});

const STORAGE_KEY = 'github-user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Restore user from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  // Handle OAuth redirect: check for ?code=xxx in URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Clean up the URL (remove the code param)
      window.history.replaceState({}, '', window.location.pathname);

      // Exchange the code for user info
      setIsLoading(true);
      fetch('/auth/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
          } else if (data.error) {
            console.error('GitHub OAuth error:', data.error);
          }
        })
        .catch((err) => console.error('GitHub OAuth fetch error:', err))
        .finally(() => {
          setIsLoading(false);
          setIsAuthReady(true);
        });
    } else {
      setIsAuthReady(true);
    }
  }, []);

  const login = useCallback(() => {
    const redirectUri = window.location.origin;
    fetch('/auth/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getClientId' }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.client_id) {
          const githubUrl = `https://github.com/login/oauth/authorize?client_id=${data.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
          window.location.href = githubUrl;
        } else {
          console.error('Failed to get GitHub client ID');
        }
      })
      .catch((err) => console.error('Failed to get GitHub client ID:', err));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, isAuthReady, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}