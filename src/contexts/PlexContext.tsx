'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { PlexClient } from '@/lib/plex/client';
import { PlexServer, PlexConnection, PlexLibrary, PlexEpisode, PlexMovie, PlexMedia, PlexPlaylist } from '@/types';
import { ActivityLogEntry } from '@/components/ui/ActivityLog';

interface PlexContextType {
  client: PlexClient | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: (server: PlexServer | PlexConnection) => Promise<void>;
  disconnect: () => void;
  getLibraries: () => Promise<PlexLibrary[]>;
  getEpisodes: (libraryKey: string) => Promise<PlexEpisode[]>;
  getMovies: (libraryKey: string) => Promise<PlexMovie[]>;
  getPlaylists: () => Promise<PlexPlaylist[]>;
  getPlaylistItems: (playlistKey: string) => Promise<PlexMedia[]>;
  createPlaylist: (name: string, media: PlexMedia[]) => Promise<boolean>;
  updatePlaylist: (playlistKey: string, newMedia: PlexMedia[], existingMedia: PlexMedia[]) => Promise<boolean>;
  getCollections: () => Promise<PlexPlaylist[]>;
  createCollection: (title: string, media: PlexMedia[]) => Promise<boolean>;
  addToCollection: (collectionTitle: string, media: PlexMedia[]) => Promise<boolean>;
  getServerInfo: () => Promise<{ name: string; version: string } | null>;
  restoreConnection: () => Promise<void>;
  // Activity logging
  activityLog: ActivityLogEntry[];
  currentPhase: 'scanning' | 'creating' | 'adding' | null;
  overallProgress: { current: number; total: number; percentage: number } | null;
  addLogEntry: (type: ActivityLogEntry['type'], message: string, phase?: ActivityLogEntry['phase'], progress?: ActivityLogEntry['progress']) => void;
  setCurrentPhase: (phase: 'scanning' | 'creating' | 'adding' | null) => void;
  setOverallProgress: (progress: { current: number; total: number; percentage: number } | null) => void;
  clearActivityLog: () => void;
}

const PlexContext = createContext<PlexContextType | undefined>(undefined);

export function PlexProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<PlexClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Activity logging state
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'scanning' | 'creating' | 'adding' | null>(null);
  const [overallProgress, setOverallProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);

  const connect = useCallback(async (server: PlexServer | PlexConnection) => {
    console.log('🔄 PlexContext: Starting connection attempt', { server });
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 PlexContext: Creating PlexClient');
      const newClient = new PlexClient(server);
      
      console.log('🔄 PlexContext: Testing connection');
      const connectionSuccess = await newClient.testConnection();
      console.log('🔄 PlexContext: Connection test result:', connectionSuccess);
      
      if (connectionSuccess) {
        console.log('✅ PlexContext: Connection successful, updating state');
        setClient(newClient);
        setIsConnected(true);
        
        // Store connection in localStorage for persistence
        localStorage.setItem('plex-server', JSON.stringify(server));
        console.log('✅ PlexContext: State updated, connection complete');
      } else {
        console.log('❌ PlexContext: Connection failed');
        throw new Error('Failed to connect to Plex server');
      }
    } catch (err) {
      console.log('❌ PlexContext: Connection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsConnected(false);
      setClient(null);
    } finally {
      console.log('🔄 PlexContext: Setting loading to false');
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('🔄 PlexContext: Disconnecting');
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

  const getEpisodes = useCallback(async (libraryKey: string): Promise<PlexEpisode[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getEpisodes(libraryKey);
  }, [client, isConnected]);

  const getMovies = useCallback(async (libraryKey: string): Promise<PlexMovie[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getMovies(libraryKey);
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

  const getCollections = useCallback(async (): Promise<PlexPlaylist[]> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getCollections();
  }, [client, isConnected]);

  const createCollection = useCallback(async (title: string, media: PlexMedia[]): Promise<boolean> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.createCollection(title, media);
  }, [client, isConnected]);

  const addToCollection = useCallback(async (collectionTitle: string, media: PlexMedia[]): Promise<boolean> => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.addToCollection(collectionTitle, media);
  }, [client, isConnected]);

  const getServerInfo = useCallback(async () => {
    if (!client || !isConnected) {
      throw new Error('Not connected to Plex server');
    }
    return client.getServerInfo();
  }, [client, isConnected]);

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

  // Activity logging functions
  const addLogEntry = useCallback((
    type: ActivityLogEntry['type'], 
    message: string, 
    phase?: ActivityLogEntry['phase'],
    progress?: ActivityLogEntry['progress']
  ) => {
    const entry: ActivityLogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      message,
      phase,
      progress
    };
    
    setActivityLog(prev => [...prev, entry]);
  }, []);

  const clearActivityLog = useCallback(() => {
    setActivityLog([]);
    setCurrentPhase(null);
    setOverallProgress(null);
  }, []);

  const value: PlexContextType = {
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
    getCollections,
    createCollection,
    addToCollection,
    getServerInfo,
    restoreConnection,
    // Activity logging
    activityLog,
    currentPhase,
    overallProgress,
    addLogEntry,
    setCurrentPhase,
    setOverallProgress,
    clearActivityLog,
  };

  return (
    <PlexContext.Provider value={value}>
      {children}
    </PlexContext.Provider>
  );
}

export function usePlex() {
  const context = useContext(PlexContext);
  if (context === undefined) {
    throw new Error('usePlex must be used within a PlexProvider');
  }
  return context;
}