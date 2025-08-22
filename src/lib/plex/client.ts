import { PlexServer, PlexConnection, PlexLibrary, PlexEpisode, PlexPlaylist } from '@/types';

// Create a global activity logger that can be used by PlexClient
interface ActivityLogger {
  addLogEntry?: (type: 'info' | 'success' | 'warning' | 'error', message: string, phase?: 'scanning' | 'creating' | 'adding', progress?: { current: number; total: number; percentage: number }) => void;
  setOverallProgress?: (progress: { current: number; total: number; percentage: number } | null) => void;
  setCurrentPhase?: (phase: 'scanning' | 'creating' | 'adding' | null) => void;
}

let globalActivityLogger: ActivityLogger = {};

export class PlexClient {
  private server: PlexServer;

  constructor(server: PlexServer | PlexConnection) {
    this.server = server;
  }

  static setActivityLogger(logger: ActivityLogger) {
    globalActivityLogger = logger;
  }

  private async getRealMachineIdentifier(): Promise<string> {
    try {
      // Get the actual machine identifier from the server
      const data = await this.makeRequest('/');
      const machineIdentifier = data?.MediaContainer?.machineIdentifier;
      if (machineIdentifier) {
        console.log(`🏷️ PlexClient: Server machine identifier: ${machineIdentifier}`);
        return machineIdentifier;
      }
    } catch (error) {
      console.warn('⚠️ PlexClient: Failed to get server machine identifier:', error);
    }
    
    // Fallback to URL-based identifier
    const url = new URL(this.server.url);
    const fallback = `${url.hostname}:${url.port}`;
    console.log(`🏷️ PlexClient: Using fallback machine identifier: ${fallback}`);
    return fallback;
  }

  private getMachineIdentifier(): string {
    // Synchronous version for backward compatibility
    const url = new URL(this.server.url);
    return `${url.hostname}:${url.port}`;
  }

  private async makeRequest(path: string, method = 'GET', params?: Record<string, unknown>, data?: Record<string, unknown>) {
    console.log(`🔄 PlexClient.makeRequest: ${method} ${path}`, { params, data });
    const response = await fetch('/api/plex/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: this.server.url,
        token: this.server.token,
        path,
        method,
        params,
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🔄 PlexClient: Starting connection test', { url: this.server.url });
      // Use API route to avoid CORS issues
      const response = await fetch('/api/plex/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: this.server.url,
          token: this.server.token,
        }),
      });

      console.log('🔄 PlexClient: Response received', { 
        ok: response.ok, 
        status: response.status, 
        statusText: response.statusText 
      });

      const result = await response.json();
      console.log('🔄 PlexClient: Response body', result);
      
      const success = response.ok && result.success;
      console.log('🔄 PlexClient: Final result', success);
      return success;
    } catch (error) {
      console.error('❌ PlexClient: Connection test failed:', error);
      return false;
    }
  }

  async getServerInfo(): Promise<{ name: string; version: string } | null> {
    try {
      const data = await this.makeRequest('/');
      const server = data?.MediaContainer;
      return {
        name: server?.friendlyName || 'Unknown Server',
        version: server?.version || 'Unknown Version'
      };
    } catch (error) {
      console.error('Failed to get server info:', error);
      return null;
    }
  }

  async getLibraries(): Promise<PlexLibrary[]> {
    try {
      const data = await this.makeRequest('/library/sections');
      const sections = data?.MediaContainer?.Directory || [];
      
      return sections.map((section: { key: string; title: string; type: string }) => ({
        key: section.key,
        title: section.title,
        type: section.type,
      }));
    } catch (error) {
      console.error('Failed to get libraries:', error);
      return [];
    }
  }

  async getEpisodes(libraryKey: string): Promise<PlexEpisode[]> {
    try {
      const data = await this.makeRequest(`/library/sections/${libraryKey}/all`, 'GET', {
        type: 4, // Episodes
        includeGuids: 1,
      });

      const episodes = data?.MediaContainer?.Metadata || [];
      
      return episodes
        .filter((ep: { guid: string }) => ep.guid) // Only episodes with GUIDs
        .map((ep: { guid: string; key: string; title?: string; summary?: string; grandparentTitle?: string; parentIndex?: string; index?: string; thumb?: string; year?: number; addedAt?: number }) => ({
          guid: ep.guid,
          key: ep.key,
          title: ep.title || '',
          summary: ep.summary || '',
          grandparentTitle: ep.grandparentTitle || '',
          seasonNumber: parseInt(ep.parentIndex || '0') || 0,
          index: parseInt(ep.index || '0') || 0,
          thumb: ep.thumb,
          year: ep.year,
          addedAt: ep.addedAt,
        }));
    } catch (error) {
      console.error('Failed to get episodes:', error);
      return [];
    }
  }

  async getPlaylists(): Promise<PlexPlaylist[]> {
    try {
      const data = await this.makeRequest('/playlists');
      const playlists = data?.MediaContainer?.Metadata || [];
      
      const validPlaylists = playlists.map((playlist: { key: string; title: string; summary?: string; leafCount?: number }) => {
        // Extract just the ID from the key path
        const keyParts = playlist.key.split('/').filter((part: string) => part.length > 0);
        
        let cleanKey = '';
        if (keyParts.length >= 2 && keyParts[0] === 'playlists') {
          // Path like "/playlists/71567/items" or "/playlists/71567"
          cleanKey = keyParts[1]; // Get the ID part
        } else if (keyParts.length === 1 && keyParts[0].match(/^\d+$/)) {
          // Just the ID like "71567"
          cleanKey = keyParts[0];
        }
        
        if (!cleanKey || !cleanKey.match(/^\d+$/)) {
          console.error(`❌ PlexClient: Invalid playlist key for "${playlist.title}": "${cleanKey}" from raw: "${playlist.key}"`);
          console.error(`❌ PlexClient: keyParts:`, keyParts);
          // Skip this playlist if we can't get a valid key
          return null;
        }
        
        console.log(`📋 PlexClient: Playlist "${playlist.title}" key: "${cleanKey}" (from raw: "${playlist.key}")`);
        
        return {
          key: cleanKey,
          title: playlist.title,
          summary: playlist.summary,
          leafCount: playlist.leafCount || 0,
        };
      }).filter(Boolean); // Remove null entries
      
      return validPlaylists;
    } catch (error) {
      console.error('Failed to get playlists:', error);
      return [];
    }
  }

  async getPlaylistItems(playlistKey: string): Promise<PlexEpisode[]> {
    try {
      console.log(`📋 PlexClient: Getting playlist items for key: "${playlistKey}"`);
      
      // Validate playlist key format
      if (!playlistKey || !playlistKey.match(/^\d+$/)) {
        console.error(`❌ PlexClient: Invalid playlist key format: "${playlistKey}"`);
        throw new Error(`Invalid playlist key: ${playlistKey}`);
      }
      
      const data = await this.makeRequest(`/playlists/${playlistKey}/items`);
      const items = data?.MediaContainer?.Metadata || [];
      
      return items
        .filter((item: { guid: string }) => item.guid)
        .map((item: { guid: string; key: string; title?: string; summary?: string; grandparentTitle?: string; parentIndex?: string; index?: string; thumb?: string; year?: number; addedAt?: number }) => ({
          guid: item.guid,
          key: item.key,
          title: item.title || '',
          summary: item.summary || '',
          grandparentTitle: item.grandparentTitle || '',
          seasonNumber: parseInt(item.parentIndex || '0') || 0,
          index: parseInt(item.index || '0') || 0,
          thumb: item.thumb,
          year: item.year,
          addedAt: item.addedAt,
        }));
    } catch (error) {
      console.error('Failed to get playlist items:', error);
      return [];
    }
  }

  async createPlaylist(name: string, episodes: PlexEpisode[]): Promise<boolean> {
    try {
      console.log(`🎵 PlexClient: Creating playlist "${name}" with ${episodes.length} episodes`);
      
      if (episodes.length === 0) {
        throw new Error('Cannot create playlist with no episodes');
      }

      const firstEpisodeKey = episodes[0].key.split('/').pop();
      if (!firstEpisodeKey) {
        console.error(`❌ PlexClient: Invalid first episode key:`, episodes[0].key);
        throw new Error(`Invalid episode key: ${episodes[0].key}`);
      }
      // Use the metadata key directly as the URI
      const uri = `/library/metadata/${firstEpisodeKey}`;
      
      console.log('📝 PlexClient: Playlist creation parameters:', {
        name,
        episodeCount: episodes.length,
        firstEpisode: `${episodes[0].grandparentTitle} - ${episodes[0].title}`,
        firstEpisodeKey,
        uri
      });

      // Create the playlist
      const data = await this.makeRequest('/playlists', 'POST', {
        type: 'video',
        title: name,
        smart: 0,
        uri: uri,
      });

      console.log('📋 PlexClient: Playlist creation response:', data);
      
      const rawPlaylistKey = data?.MediaContainer?.Metadata?.[0]?.key;
      if (!rawPlaylistKey) {
        console.error('❌ PlexClient: No playlist key in response:', data);
        throw new Error('Failed to get playlist key from creation response');
      }

      // Extract just the playlist ID from the full path
      // rawPlaylistKey might be like "/playlists/71567/items" or "/playlists/71567" or just "71567"
      const keyParts = rawPlaylistKey.split('/').filter((part: string) => part.length > 0);
      
      let playlistKey = '';
      if (keyParts.length >= 2 && keyParts[0] === 'playlists') {
        // Path like "/playlists/71567/items" or "/playlists/71567"
        playlistKey = keyParts[1]; // Get the ID part
      } else if (keyParts.length === 1 && keyParts[0].match(/^\d+$/)) {
        // Just the ID like "71567"
        playlistKey = keyParts[0];
      }
      
      if (!playlistKey || !playlistKey.match(/^\d+$/)) {
        console.error(`❌ PlexClient: Invalid playlist key extracted: "${playlistKey}" from raw: "${rawPlaylistKey}"`);
        console.error(`❌ PlexClient: keyParts:`, keyParts);
        throw new Error(`Invalid playlist key: ${rawPlaylistKey}`);
      }
      
      console.log(`✅ PlexClient: Playlist created with key: "${playlistKey}" (from raw: "${rawPlaylistKey}")`);

      // Add remaining episodes if there are more than one
      if (episodes.length > 1) {
        console.log(`➕ PlexClient: Adding ${episodes.length - 1} remaining episodes to playlist`);
        const remainingEpisodes = episodes.slice(1);
        await this.addToPlaylist(playlistKey, remainingEpisodes);
      }

      console.log(`🎉 PlexClient: Successfully created playlist "${name}" with ${episodes.length} episodes`);
      return true;
    } catch (error) {
      console.error('❌ PlexClient: Failed to create playlist:', error);
      return false;
    }
  }

  async addSingleEpisodeToPlaylist(playlistKey: string, episode: PlexEpisode): Promise<boolean> {
    try {
      console.log(`🧪 PlexClient: Testing single episode add: ${episode.grandparentTitle} - ${episode.title}`);
      console.log(`📝 PlexClient: Episode details:`, {
        guid: episode.guid,
        key: episode.key,
        title: episode.title,
        grandparentTitle: episode.grandparentTitle,
        seasonNumber: episode.seasonNumber,
        index: episode.index
      });
      
      const key = episode.key.split('/').pop();
      if (!key) {
        console.error(`❌ PlexClient: Invalid episode key for test:`, episode.key);
        return false;
      }
      
      // Get the real machine identifier from the server
      const realMachineId = await this.getRealMachineIdentifier();
      
      // Use proper server URI format as per Plex API documentation
      const serverUri = `server://${realMachineId}/com.plexapp.plugins.library/library/metadata/${key}`;
      console.log(`📝 PlexClient: Test episode server URI: ${serverUri}`);
      
      console.log(`🔄 PlexClient: Using correct server URI format per Plex API docs...`);
      const response = await this.makeRequest(`/playlists/${playlistKey}/items`, 'PUT', {
        uri: serverUri,
      });
      
      console.log(`📋 PlexClient: Test episode response:`, response);
      
      // Log detailed response analysis
      if (response?.MediaContainer) {
        console.log(`📊 PlexClient: MediaContainer details:`, {
          size: response.MediaContainer.size,
          totalSize: response.MediaContainer.totalSize,
          allowSync: response.MediaContainer.allowSync,
          identifier: response.MediaContainer.identifier,
          librarySectionID: response.MediaContainer.librarySectionID,
          mediaTagPrefix: response.MediaContainer.mediaTagPrefix,
          mediaTagVersion: response.MediaContainer.mediaTagVersion
        });
      }
      
      // Verify the episode was added
      const playlistItems = await this.getPlaylistItems(playlistKey);
      const found = playlistItems.some(ep => ep.guid === episode.guid);
      console.log(`🔍 PlexClient: Test episode verification: ${found ? 'FOUND' : 'NOT FOUND'} in playlist`);
      
      if (!found) {
        console.warn(`❌ PlexClient: Server URI format failed to add episode to playlist`);
        console.warn(`📊 PlexClient: Debug info - Machine ID: ${this.getMachineIdentifier()}`);
        console.warn(`📊 PlexClient: Debug info - Server URL: ${this.server.url}`);
        console.warn(`📊 PlexClient: Debug info - Episode key: ${episode.key}`);
      }
      
      return found;
    } catch (error) {
      console.error('❌ PlexClient: Single episode test failed:', error);
      return false;
    }
  }

  async addToPlaylist(playlistKey: string, episodes: PlexEpisode[]): Promise<boolean> {
    try {
      console.log(`➕ PlexClient: Adding ${episodes.length} episodes to playlist`, {
        playlistKey,
        fullPath: `/playlists/${playlistKey}/items`
      });
      
      // Validate playlist key format
      if (!playlistKey || !playlistKey.match(/^\d+$/)) {
        console.error(`❌ PlexClient: Invalid playlist key format for addToPlaylist: "${playlistKey}"`);
        throw new Error(`Invalid playlist key: ${playlistKey}`);
      }
      
      if (episodes.length === 0) {
        console.log('⏭️ PlexClient: No episodes to add, skipping');
        return true;
      }

      // Test with single episode first to isolate issues
      if (episodes.length > 1) {
        console.log(`🧪 PlexClient: Testing with single episode first...`);
        const testResult = await this.addSingleEpisodeToPlaylist(playlistKey, episodes[0]);
        if (!testResult) {
          console.error(`❌ PlexClient: Single episode test failed, aborting batch operation`);
          return false;
        }
        console.log(`✅ PlexClient: Single episode test passed, proceeding with remaining ${episodes.length - 1} episodes`);
        // Continue with remaining episodes
        episodes = episodes.slice(1);
        if (episodes.length === 0) return true;
      }

      // Get real machine identifier for server URIs
      const realMachineId = await this.getRealMachineIdentifier();
      
      const uris = episodes.map(ep => {
        const key = ep.key.split('/').pop();
        if (!key) {
          console.error(`❌ PlexClient: Invalid episode key for ${ep.grandparentTitle} - ${ep.title}:`, ep.key);
          throw new Error(`Invalid episode key: ${ep.key}`);
        }
        const serverUri = `server://${realMachineId}/com.plexapp.plugins.library/library/metadata/${key}`;
        console.log(`📺 PlexClient: Episode Server URI: ${ep.grandparentTitle} - ${ep.title} -> ${serverUri}`);
        return serverUri;
      });

      // Add episodes one by one since batch requests seem to be overwriting
      console.log(`📝 PlexClient: Adding ${episodes.length} episodes individually to avoid batch issues`);
      globalActivityLogger.addLogEntry?.('info', `Adding ${episodes.length} episodes individually to playlist`, 'adding');

      let successCount = 0;
      for (let i = 0; i < episodes.length; i++) {
        const episode = episodes[i];
        const uri = uris[i];
        
        const currentProgress = {
          current: i + 1,
          total: episodes.length,
          percentage: Math.round(((i + 1) / episodes.length) * 100)
        };
        
        globalActivityLogger.addLogEntry?.('info', 
          `Adding episode ${i + 1}/${episodes.length}: ${episode.grandparentTitle} - ${episode.title}`, 
          'adding', 
          currentProgress
        );
        console.log(`📦 PlexClient: Adding episode ${i + 1}/${episodes.length}: ${episode.grandparentTitle} - ${episode.title}`);
        
        try {
          const response = await this.makeRequest(`/playlists/${playlistKey}/items`, 'PUT', {
            uri: uri,
          });
          
          console.log(`📋 PlexClient: Episode ${i + 1} response:`, response);
          
          // Check response for success indicators
          if (response?.MediaContainer) {
            const leafCountAdded = response.MediaContainer.leafCountAdded || 0;
            const leafCountRequested = response.MediaContainer.leafCountRequested || 0;
            
            if (leafCountAdded > 0 || leafCountRequested > 0) {
              successCount++;
              globalActivityLogger.addLogEntry?.('success', 
                `Added "${episode.title}" from ${episode.grandparentTitle}`, 
                'adding'
              );
              console.log(`✅ PlexClient: Episode ${i + 1} added successfully (leafCountAdded: ${leafCountAdded}, leafCountRequested: ${leafCountRequested})`);
            } else {
              globalActivityLogger.addLogEntry?.('warning', 
                `May have failed to add "${episode.title}" from ${episode.grandparentTitle}`, 
                'adding'
              );
              console.warn(`⚠️ PlexClient: Episode ${i + 1} may not have been added (leafCountAdded: ${leafCountAdded}, leafCountRequested: ${leafCountRequested})`);
            }
          }
        } catch (error) {
          globalActivityLogger.addLogEntry?.('error', 
            `Failed to add "${episode.title}" from ${episode.grandparentTitle}: ${error}`, 
            'adding'
          );
          console.error(`❌ PlexClient: Failed to add episode ${i + 1}:`, error);
        }
      }
      
      globalActivityLogger.addLogEntry?.('success', 
        `Individual additions complete. ${successCount}/${episodes.length} episodes processed successfully`, 
        'adding'
      );
      console.log(`📊 PlexClient: Individual additions complete. ${successCount}/${episodes.length} episodes processed successfully.`);

      // Verify episodes were actually added by reading the playlist back
      console.log(`🔍 PlexClient: Verifying episodes were added to playlist...`);
      const updatedPlaylistItems = await this.getPlaylistItems(playlistKey);
      console.log(`📊 PlexClient: Playlist now contains ${updatedPlaylistItems.length} total episodes`);
      
      // Check if our episodes are in the playlist
      const addedGuids = new Set(episodes.map(ep => ep.guid));
      const foundEpisodes = updatedPlaylistItems.filter(ep => addedGuids.has(ep.guid));
      console.log(`✅ PlexClient: ${foundEpisodes.length}/${episodes.length} episodes verified in playlist`);
      
      if (foundEpisodes.length < episodes.length) {
        console.warn(`⚠️ PlexClient: ${episodes.length - foundEpisodes.length} episodes missing from playlist after add operation`);
        
        // Log which episodes are missing
        const foundGuids = new Set(foundEpisodes.map(ep => ep.guid));
        const missingEpisodes = episodes.filter(ep => !foundGuids.has(ep.guid));
        console.warn(`❌ PlexClient: Missing episodes:`, missingEpisodes.map(ep => ({
          title: ep.title,
          show: ep.grandparentTitle,
          guid: ep.guid,
          key: ep.key
        })));
      }
      
      console.log(`🎉 PlexClient: Successfully added ${foundEpisodes.length} episodes to playlist (${episodes.length} requested)`);
      return foundEpisodes.length > 0;
    } catch (error) {
      console.error('❌ PlexClient: Failed to add to playlist:', error);
      return false;
    }
  }

  async updatePlaylist(playlistKey: string, newEpisodes: PlexEpisode[], existingEpisodes: PlexEpisode[]): Promise<boolean> {
    try {
      // Find episodes to add (not already in playlist)
      const existingGuids = new Set(existingEpisodes.map(ep => ep.guid));
      const episodesToAdd = newEpisodes.filter(ep => !existingGuids.has(ep.guid));

      if (episodesToAdd.length === 0) {
        return true; // Nothing to add
      }

      return await this.addToPlaylist(playlistKey, episodesToAdd);
    } catch (error) {
      console.error('Failed to update playlist:', error);
      return false;
    }
  }
}