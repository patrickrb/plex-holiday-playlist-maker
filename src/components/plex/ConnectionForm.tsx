'use client';

import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePlex } from '@/contexts/PlexContext';

const connectionSchema = z.object({
  url: z.string().url('Please enter a valid URL (e.g., http://192.168.1.100:32400)'),
  token: z.string().min(1, 'Plex token is required'),
});

type ConnectionForm = z.infer<typeof connectionSchema>;

interface ConnectionFormProps {
  onSuccess?: () => void;
}

export function ConnectionForm({ onSuccess }: ConnectionFormProps) {
  const { connect, isLoading, error, isConnected } = usePlex();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectionForm>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      url: 'http://192.168.86.35:32400',
      token: '',
    },
  });

  const onSubmit = async (data: ConnectionForm) => {
    console.log('🔄 ConnectionForm: Form submitted', { data });
    try {
      await connect(data);
      console.log('🔄 ConnectionForm: Connect function completed');
      // The connect function will update isConnected state
      // onSuccess will be called when the component re-renders
    } catch (error) {
      console.log('❌ ConnectionForm: Connect function error:', error);
      // Error is already handled in the usePlex hook
    }
  };

  useEffect(() => {
    console.log('🔄 ConnectionForm: State changed', { isConnected, isLoading, error });
    if (isConnected) {
      console.log('✅ ConnectionForm: Connected! Calling onSuccess');
      onSuccess?.();
    }
  }, [isConnected, isLoading, error, onSuccess]);

  if (isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-600">Connected to Plex Server</CardTitle>
          <CardDescription>
            Successfully connected to your Plex server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Ready to create holiday playlists!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect to Plex Server</CardTitle>
        <CardDescription>
          Enter your Plex server URL and authentication token to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="url">Plex Server URL</Label>
            <div className="space-y-2">
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  onClick={() => {
                    const urlInput = document.getElementById('url') as HTMLInputElement;
                    if (urlInput) urlInput.value = 'http://192.168.86.35:32400';
                  }}
                >
                  Local Network
                </button>
                <button
                  type="button"
                  className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                  onClick={() => {
                    const urlInput = document.getElementById('url') as HTMLInputElement;
                    if (urlInput) urlInput.value = 'http://136.33.5.162:23602';
                  }}
                >
                  Remote Access
                </button>
              </div>
              <Input
                id="url"
                placeholder="http://192.168.86.35:32400"
                {...register('url')}
              />
            </div>
            {errors.url && (
              <p className="text-sm text-red-600 mt-1">{errors.url.message}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Use Local Network when on the same WiFi, Remote Access from outside your network
            </p>
          </div>

          <div>
            <Label htmlFor="token">Plex Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Your Plex authentication token"
              {...register('token')}
            />
            {errors.token && (
              <p className="text-sm text-red-600 mt-1">{errors.token.message}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">
              Find your token in Plex Settings → Network → Show Advanced
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Connecting...' : 'Connect to Plex'}
          </Button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">How to find your Plex Token:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Open Plex Web App in your browser</li>
            <li>Go to Settings → Network</li>
            <li>Click &quot;Show Advanced&quot; at the top right</li>
            <li>Copy the token from the &quot;X-Plex-Token&quot; field</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}