'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlexOAuthLogin } from '@/components/plex/PlexOAuthLogin';
import { PlaylistCreator } from '@/components/playlist/PlaylistCreator';
import { MediaConfirmation } from '@/components/playlist/EpisodeConfirmation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePlex } from '@/contexts/PlexContext';
import { usePlexOAuth } from '@/contexts/PlexOAuthContext';
import { PlaylistPreview, PlexMedia } from '@/types';

export default function Home() {
  const { connect, isConnected, disconnect, isLoading: isConnecting, error: connectionError } = usePlex();
  const { session, getSelectedServerConnection } = usePlexOAuth();
  const [showMediaConfirmation, setShowMediaConfirmation] = useState(false);
  const [playlistPreviews, setPlaylistPreviews] = useState<PlaylistPreview[]>([]);
  const [isConnectingToServer, setIsConnectingToServer] = useState(false);
  const [connectionAttempted, setConnectionAttempted] = useState<string | null>(null);

  // Clear any stale localStorage data on initial load
  useEffect(() => {
    // Clear old connection data to prevent confusion
    localStorage.removeItem('plex-server');
  }, []);

  // Auto-connect when OAuth session has a selected server
  const connectToSelectedServer = useCallback(async () => {
    const serverConnection = getSelectedServerConnection();
    const serverIdentifier = session.selectedServer?.machineIdentifier;
    
    if (serverConnection && !isConnected && !isConnecting && !isConnectingToServer && 
        connectionAttempted !== serverIdentifier) {
      console.log('Attempting to connect to server:', serverConnection.name);
      setIsConnectingToServer(true);
      setConnectionAttempted(serverIdentifier || null);
      
      try {
        await connect(serverConnection);
        console.log('Connection attempt completed');
      } catch (error) {
        console.error('Failed to connect to server:', error);
      } finally {
        setIsConnectingToServer(false);
      }
    }
  }, [session.selectedServer, getSelectedServerConnection, isConnected, isConnecting, isConnectingToServer, connectionAttempted, connect]);

  useEffect(() => {
    // Only attempt connection once per server selection
    if (session.selectedServer) {
      connectToSelectedServer();
    }
  }, [session.selectedServer?.machineIdentifier, connectToSelectedServer, session.selectedServer]);

  // Reset connection attempt tracking when server changes
  useEffect(() => {
    if (session.selectedServer?.machineIdentifier !== connectionAttempted) {
      setConnectionAttempted(null);
    }
  }, [session.selectedServer?.machineIdentifier, connectionAttempted]);


  const handleConfirmMedia = async (selectedMedia: Map<string, PlexMedia[]>) => {
    // TODO: Implement actual playlist creation with selected media
    console.log('Creating playlists with:', selectedMedia);
    setShowMediaConfirmation(false);
  };

  const handleCancelConfirmation = () => {
    setShowMediaConfirmation(false);
    setPlaylistPreviews([]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">
              Plex Holiday Playlist Maker
            </h1>
            <p className="text-xl text-gray-600">
              Automatically create holiday-themed playlists from your Plex TV shows and movies
            </p>
          </div>

          {/* Connection Status */}
          {(isConnected || isConnectingToServer) && session.selectedServer && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {isConnectingToServer ? (
                      <>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">
                          Connecting to {session.selectedServer.name}...
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">
                          Connected to {session.selectedServer.name}
                        </span>
                      </>
                    )}
                  </div>
                  {!isConnectingToServer && (
                    <Button variant="outline" size="sm" onClick={disconnect}>
                      Disconnect
                    </Button>
                  )}
                </div>
                {connectionError && (
                  <div className="mt-2">
                    <Alert variant="destructive">
                      <AlertDescription>{connectionError}</AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          {!session.isAuthenticated || !session.selectedServer ? (
            <PlexOAuthLogin 
              isConnecting={isConnectingToServer}
              onSuccess={() => {
                // Server was selected, state should automatically trigger next step
              }}
            />
          ) : !isConnected && !isConnectingToServer ? (
            <Card>
              <CardHeader>
                <CardTitle>Connection Failed</CardTitle>
                <CardDescription>
                  Unable to connect to your Plex server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    The selected server ({session.selectedServer.name}) is not accessible. This could be due to:
                  </p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Server is offline or not running</li>
                    <li>Network connectivity issues</li>
                    <li>Firewall blocking access</li>
                    <li>Incorrect server configuration</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setConnectionAttempted(null)} 
                    variant="outline"
                  >
                    Retry Connection
                  </Button>
                  <Button 
                    onClick={() => {
                      setConnectionAttempted(null);
                      // This will trigger server re-selection
                      window.location.reload();
                    }}
                    variant="outline"
                  >
                    Choose Different Server
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : showMediaConfirmation ? (
            <MediaConfirmation
              playlistPreviews={playlistPreviews}
              onConfirm={handleConfirmMedia}
              onCancel={handleCancelConfirmation}
            />
          ) : isConnected ? (
            <PlaylistCreator onPlaylistsCreated={() => console.log('Playlists created!')} />
          ) : null}

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>
                What this app can do for your Plex server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium">🎃 Holiday Detection</h3>
                  <p className="text-sm text-gray-600">
                    Automatically identifies Halloween, Thanksgiving, Christmas, and Valentine&apos;s Day episodes using advanced pattern matching.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">📚 Wikipedia Integration</h3>
                  <p className="text-sm text-gray-600">
                    Optionally scrapes Wikipedia for comprehensive lists of holiday TV specials and episodes.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">✅ Episode Confirmation</h3>
                  <p className="text-sm text-gray-600">
                    Review and confirm which episodes to include before creating playlists.
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">🔄 Smart Updates</h3>
                  <p className="text-sm text-gray-600">
                    Updates existing playlists without duplicates and creates new ones as needed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          {(!session.isAuthenticated || !session.selectedServer) && (
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Follow these steps to create your holiday playlists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sign in with your Plex account</li>
                  <li>Select a Plex server from your available servers</li>
                  <li>Choose your TV Shows and/or Movie libraries to scan</li>
                  <li>Review the found episodes and movies and confirm which ones to include</li>
                  <li>Create your holiday playlists!</li>
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
