'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    // This page is displayed after Plex OAuth redirect
    // The actual token polling happens in the parent window
    
    const handleAuth = () => {
      try {
        // Check if this is a successful auth callback
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
          setStatus('error');
          setMessage(`Authentication failed: ${error}`);
          return;
        }

        // Success - the token will be picked up by polling in the parent window
        setStatus('success');
        setMessage('Authentication successful! You can close this window.');
        
        // Try to close the popup after a short delay
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // If we can't close the window, that's okay
            console.log('Could not auto-close window');
          }
        }, 2000);
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An error occurred during authentication.');
      }
    };

    handleAuth();
  }, []);

  const handleCloseWindow = () => {
    try {
      window.close();
    } catch {
      // Fallback - redirect to main app
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {status === 'processing' && '🔄 Processing...'}
            {status === 'success' && '✅ Success!'}
            {status === 'error' && '❌ Error'}
          </CardTitle>
          <CardDescription>
            Plex Authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>

          {status === 'success' && (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Return to the main application to continue.
              </p>
              <Button onClick={handleCloseWindow} variant="outline">
                Close Window
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <Button onClick={handleCloseWindow} variant="outline">
                Close and Retry
              </Button>
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">
                Please wait while we complete your authentication...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}