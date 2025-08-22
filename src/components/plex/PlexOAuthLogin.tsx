'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePlexOAuth } from '@/hooks/usePlexOAuth';
import { PlexOAuthServer } from '@/types/oauth';

interface PlexOAuthLoginProps {
  onSuccess?: () => void;
  isConnecting?: boolean;
}

export function PlexOAuthLogin({ onSuccess, isConnecting }: PlexOAuthLoginProps) {
  const {
    session,
    isLoading,
    error,
    initiateLogin,
    pollForToken,
    selectServer,
    logout,
    getServerUrl,
  } = usePlexOAuth();

  const [isPolling, setIsPolling] = useState(false);
  const [pollProgress, setPollProgress] = useState(0);

  useEffect(() => {
    if (session.isAuthenticated && session.selectedServer) {
      onSuccess?.();
    }
  }, [session.isAuthenticated, session.selectedServer, onSuccess]);

  const handleLogin = async () => {
    const loginUrl = await initiateLogin();
    
    if (loginUrl) {
      // Open Plex login in new window
      window.open(loginUrl, 'plexLogin', 'width=600,height=700,scrollbars=yes');
      
      // Start polling for auth token
      startPolling();
    }
  };

  const startPolling = () => {
    setIsPolling(true);
    setPollProgress(0);
    
    const maxAttempts = 60; // 5 minutes at 5-second intervals
    let attempts = 0;
    
    const pollInterval = setInterval(async () => {
      attempts++;
      setPollProgress((attempts / maxAttempts) * 100);
      
      const success = await pollForToken();
      
      if (success) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setPollProgress(100);
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setPollProgress(0);
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleServerSelect = (server: PlexOAuthServer) => {
    selectServer(server);
  };

  if (session.isAuthenticated && session.user) {
    return (
      <div className="space-y-4">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Logged in as {session.user.username}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </CardTitle>
            <CardDescription>
              Choose a Plex server to connect to
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Server Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Available Servers</CardTitle>
            <CardDescription>
              Select which Plex server to use for creating holiday playlists
              {isConnecting && <span className="text-blue-600"> • Connecting...</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session.servers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No Plex servers found. Make sure you have access to at least one Plex server.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {session.servers.map((server) => (
                  <div
                    key={server.machineIdentifier}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      session.selectedServer?.machineIdentifier === server.machineIdentifier
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleServerSelect(server)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{server.name}</h3>
                        <p className="text-sm text-gray-600">
                          {getServerUrl(server)} • Version {server.version}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {server.owned && <Badge variant="default">Owned</Badge>}
                        {server.local && <Badge variant="secondary">Local</Badge>}
                        {session.selectedServer?.machineIdentifier === server.machineIdentifier && (
                          <Badge variant="outline">Selected</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect with Plex</CardTitle>
        <CardDescription>
          Sign in with your Plex account to access your servers and create holiday playlists
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPolling ? (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium mb-2">Waiting for authentication...</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please complete the login process in the popup window
              </p>
              <Progress value={pollProgress} className="w-full" />
            </div>
            <Alert>
              <AlertDescription>
                If the popup was blocked, please allow popups for this site and try again.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleLogin} disabled={isLoading} className="w-full">
              {isLoading ? 'Preparing login...' : 'Sign in with Plex'}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-gray-600 space-y-2">
              <h4 className="font-medium">What happens when you sign in:</h4>
              <ul className="space-y-1 list-disc list-inside">
                <li>You&apos;ll be redirected to Plex&apos;s secure login page</li>
                <li>After authentication, you&apos;ll see your available servers</li>
                <li>Select a server to start creating holiday playlists</li>
                <li>Your login will be remembered for future visits</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}