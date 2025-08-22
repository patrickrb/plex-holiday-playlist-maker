import { useState, useCallback, useEffect } from 'react';
import { PlexOAuthManager } from '@/lib/plex/oauth';
import { PlexAuthSession, PlexOAuthServer } from '@/types/oauth';

export function usePlexOAuth() {
  const [oauthManager] = useState(() => new PlexOAuthManager());
  const [session, setSession] = useState<PlexAuthSession>({
    isAuthenticated: false,
    servers: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedSession = useCallback(() => {
    try {
      const saved = localStorage.getItem('plex-auth-session');
      if (saved) {
        const parsedSession = JSON.parse(saved) as PlexAuthSession;
        setSession(parsedSession);
      }
    } catch (error) {
      console.warn('Failed to load saved session:', error);
      localStorage.removeItem('plex-auth-session');
    }
  }, []);

  // Load saved session on mount
  useEffect(() => {
    loadSavedSession();
  }, [loadSavedSession]);

  const saveSession = useCallback((sessionData: PlexAuthSession) => {
    try {
      localStorage.setItem('plex-auth-session', JSON.stringify(sessionData));
      setSession(sessionData);
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  }, []);

  const initiateLogin = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const [hostedUILink, pinId] = await oauthManager.getHostedLoginURL();
      
      // Store pinId for polling
      sessionStorage.setItem('plex-pin-id', pinId);
      
      return hostedUILink;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate login';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [oauthManager]);

  const pollForToken = useCallback(async (): Promise<boolean> => {
    const pinId = sessionStorage.getItem('plex-pin-id');
    if (!pinId) {
      setError('No authentication session found');
      return false;
    }

    setIsLoading(true);
    
    try {
      const authToken = await oauthManager.checkForAuthToken(pinId);
      
      if (authToken) {
        // Clear the pin ID as we no longer need it
        sessionStorage.removeItem('plex-pin-id');
        
        // Get user data and servers
        const userData = await oauthManager.getUserData(authToken);
        
        if (userData) {
          const newSession: PlexAuthSession = {
            isAuthenticated: true,
            user: userData.user,
            authToken: userData.authToken,
            servers: userData.servers,
          };
          
          saveSession(newSession);
          return true;
        } else {
          setError('Failed to fetch user data');
          return false;
        }
      }
      
      return false; // No token yet, continue polling
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [oauthManager, saveSession]);

  const selectServer = useCallback((server: PlexOAuthServer) => {
    const updatedSession = {
      ...session,
      selectedServer: server,
    };
    saveSession(updatedSession);
  }, [session, saveSession]);

  const logout = useCallback(() => {
    localStorage.removeItem('plex-auth-session');
    sessionStorage.removeItem('plex-pin-id');
    setSession({
      isAuthenticated: false,
      servers: [],
    });
    setError(null);
  }, []);

  const getServerUrl = useCallback((server: PlexOAuthServer): string => {
    // Use HTTP for local servers and servers on private networks
    // Use HTTPS for remote servers only if they're properly configured
    const isPrivateNetwork = server.host.startsWith('192.168.') || 
                             server.host.startsWith('10.') || 
                             server.host.startsWith('172.') ||
                             server.host === 'localhost' ||
                             server.host.endsWith('.local');
    
    const protocol = (server.local || isPrivateNetwork) ? 'http' : 'https';
    return `${protocol}://${server.host}:${server.port}`;
  }, []);

  const getSelectedServerConnection = useCallback(() => {
    if (!session.selectedServer || !session.authToken) {
      return null;
    }

    return {
      url: getServerUrl(session.selectedServer),
      token: session.selectedServer.accessToken || session.authToken,
      name: session.selectedServer.name,
    };
  }, [session, getServerUrl]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!session.authToken) {
      return false;
    }

    try {
      setIsLoading(true);
      const userData = await oauthManager.getUserData(session.authToken);
      
      if (userData) {
        const newSession: PlexAuthSession = {
          ...session,
          user: userData.user,
          servers: userData.servers,
        };
        
        // Preserve selected server if it still exists
        const selectedServer = session.selectedServer;
        if (selectedServer) {
          const stillExists = userData.servers.find(
            s => s.machineIdentifier === selectedServer.machineIdentifier
          );
          if (stillExists) {
            newSession.selectedServer = stillExists;
          } else {
            newSession.selectedServer = undefined;
          }
        }
        
        saveSession(newSession);
        return true;
      } else {
        // Token is invalid, log out
        logout();
        return false;
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      logout();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session, oauthManager, saveSession, logout]);

  return {
    session,
    isLoading,
    error,
    initiateLogin,
    pollForToken,
    selectServer,
    logout,
    getServerUrl,
    getSelectedServerConnection,
    loadSavedSession,
    refreshSession,
  };
}