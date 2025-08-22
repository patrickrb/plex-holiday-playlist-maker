import { useState, useCallback } from 'react';
import { PlexClient } from '@/lib/plex/client';
import { PlexServer, PlexConnection, PlexLibrary, PlexEpisode, PlexMovie, PlexMedia, PlexPlaylist } from '@/types';

export function usePlex() {
  const [client, setClient] = useState<PlexClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (server: PlexServer | PlexConnection) => {
    console.log('🔄 usePlex: Starting connection attempt', { server });
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 usePlex: Creating PlexClient');
      const newClient = new PlexClient(server);
      
      console.log('🔄 usePlex: Testing connection');
      const connectionSuccess = await newClient.testConnection();
      console.log('🔄 usePlex: Connection test result:', connectionSuccess);
      
      if (connectionSuccess) {
        console.log('✅ usePlex: Connection successful, updating state');
        setClient(newClient);
        setIsConnected(true);
        
        // Store connection in localStorage for persistence
        localStorage.setItem('plex-server', JSON.stringify(server));
        console.log('✅ usePlex: State updated, connection complete');
      } else {
        console.log('❌ usePlex: Connection failed');
        throw new Error('Failed to connect to Plex server');
      }
    } catch (err) {
      console.log('❌ usePlex: Connection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsConnected(false);
      setClient(null);
    } finally {
      console.log('🔄 usePlex: Setting loading to false');
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setClient(null);
    setIsConnected(false);
    setError(null);
    localStorage.removeItem('plex-server');
  }, []);

  const getLibraries = useCallback(async (): Promise<PlexLibrary[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getLibraries();
  }, [client, isConnected]);

  const getMovies = useCallback(async (libraryKey: string): Promise<PlexMovie[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getMovies(libraryKey);
  }, [client, isConnected]);

  const getEpisodes = useCallback(async (libraryKey: string): Promise<PlexEpisode[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getEpisodes(libraryKey);
  }, [client, isConnected]);

  const getPlaylists = useCallback(async (): Promise<PlexPlaylist[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getPlaylists();
  }, [client, isConnected]);

  const getPlaylistItems = useCallback(async (playlistKey: string): Promise<PlexMedia[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getPlaylistItems(playlistKey);
  }, [client, isConnected]);

  const createPlaylist = useCallback(async (name: string, media: PlexMedia[]): Promise<boolean> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.createPlaylist(name, media);
  }, [client, isConnected]);

  const updatePlaylist = useCallback(async (
    playlistKey: string, 
    newMedia: PlexMedia[], 
    existingMedia: PlexMedia[]
  ): Promise<boolean> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.updatePlaylist(playlistKey, newMedia, existingMedia);
  }, [client, isConnected]);

  const getServerInfo = useCallback(async () => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getServerInfo();
  }, [client, isConnected]);

  // Try to restore connection from localStorage on hook initialization
  const restoreConnection = useCallback(async () => {
    try {
      const stored = localStorage.getItem('plex-server');
      if (stored) {
        const server = JSON.parse(stored) as PlexServer | PlexConnection;
        await connect(server);
      }
    } catch (err) {
      console.warn('Failed to restore Plex connection:', err);
      localStorage.removeItem('plex-server');
    }
  }, [connect]);

  return {
    client,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    getLibraries,
    getEpisodes,
    getMovies,
    getPlaylists,
    getPlaylistItems,
    createPlaylist,
    updatePlaylist,
    getServerInfo,
    restoreConnection,
  };
}