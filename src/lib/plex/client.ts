import { PlexServer, PlexConnection, PlexLibrary, PlexEpisode, PlexMovie, PlexMedia, PlexPlaylist } from '@/types';

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
    const requestStart = Date.now();

    try {
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

      const requestDuration = ((Date.now() - requestStart) / 1000).toFixed(1);

      if (!response.ok) {
        const error = await response.json();
        console.error(`❌ PlexClient.makeRequest: ${method} ${path} failed in ${requestDuration}s:`, error);
        throw new Error(error.error || 'Request failed');
      }

      const result = await response.json();
      console.log(`✅ PlexClient.makeRequest: ${method} ${path} completed in ${requestDuration}s`);
      return result;
    } catch (error) {
      const requestDuration = ((Date.now() - requestStart) / 1000).toFixed(1);
      console.error(`❌ PlexClient.makeRequest: ${method} ${path} threw exception after ${requestDuration}s:`, error);
      throw error;
    }
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

  async getMovies(libraryKey: string): Promise<PlexMovie[]> {
    try {
      console.log(`📡 PlexClient.getMovies: Starting request for library ${libraryKey}...`);
      const startTime = Date.now();

      const data = await this.makeRequest(`/library/sections/${libraryKey}/all`, 'GET', {
        type: 1, // Movies
        includeGuids: 1,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const rawMovies = data?.MediaContainer?.Metadata || [];
      console.log(`📡 PlexClient.getMovies: Received ${rawMovies.length} movies in ${duration}s`);

      const movies = rawMovies
        .filter((movie: { guid: string }) => movie.guid) // Only movies with GUIDs
        .map((movie: { guid: string; key: string; title?: string; summary?: string; year?: number; thumb?: string; addedAt?: number }) => ({
          guid: movie.guid,
          key: movie.key,
          title: movie.title || '',
          summary: movie.summary || '',
          year: movie.year,
          thumb: movie.thumb,
          addedAt: movie.addedAt,
        }));

      console.log(`✅ PlexClient.getMovies: Processed ${movies.length} movies with GUIDs`);
      return movies;
    } catch (error) {
      console.error('❌ PlexClient.getMovies: Failed to get movies:', error);
      return [];
    }
  }

  async getEpisodes(libraryKey: string): Promise<PlexEpisode[]> {
    try {
      console.log(`📡 PlexClient.getEpisodes: Starting request for library ${libraryKey}...`);
      const startTime = Date.now();

      const data = await this.makeRequest(`/library/sections/${libraryKey}/all`, 'GET', {
        type: 4, // Episodes
        includeGuids: 1,
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const rawEpisodes = data?.MediaContainer?.Metadata || [];
      console.log(`📡 PlexClient.getEpisodes: Received ${rawEpisodes.length} episodes in ${duration}s`);

      const episodes = rawEpisodes
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

      console.log(`✅ PlexClient.getEpisodes: Processed ${episodes.length} episodes with GUIDs`);
      return episodes;
    } catch (error) {
      console.error('❌ PlexClient.getEpisodes: Failed to get episodes:', error);
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

  async getPlaylistItems(playlistKey: string): Promise<PlexMedia[]> {
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
        .map((item: { guid: string; key: string; title?: string; summary?: string; grandparentTitle?: string; parentIndex?: string; index?: string; thumb?: string; year?: number; addedAt?: number }) => {
          // Check if this is an episode (has grandparentTitle) or a movie
          if (item.grandparentTitle) {
            // This is an episode
            return {
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
            } as PlexEpisode;
          } else {
            // This is a movie
            return {
              guid: item.guid,
              key: item.key,
              title: item.title || '',
              summary: item.summary || '',
              year: item.year,
              thumb: item.thumb,
              addedAt: item.addedAt,
            } as PlexMovie;
          }
        });
    } catch (error) {
      console.error('Failed to get playlist items:', error);
      return [];
    }
  }

  async createPlaylist(name: string, media: PlexMedia[]): Promise<boolean> {
    try {
      console.log(`🎵 PlexClient: Creating playlist "${name}" with ${media.length} items`);
      
      if (media.length === 0) {
        throw new Error('Cannot create playlist with no media');
      }

      const firstMediaKey = media[0].key.split('/').pop();
      if (!firstMediaKey) {
        console.error(`❌ PlexClient: Invalid first media key:`, media[0].key);
        throw new Error(`Invalid media key: ${media[0].key}`);
      }
      // Use the metadata key directly as the URI
      const uri = `/library/metadata/${firstMediaKey}`;
      
      console.log('📝 PlexClient: Playlist creation parameters:', {
        name,
        mediaCount: media.length,
        firstMedia: media[0].title,
        firstMediaKey,
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

      // Add remaining media if there are more than one
      if (media.length > 1) {
        console.log(`➕ PlexClient: Adding ${media.length - 1} remaining items to playlist`);
        const remainingMedia = media.slice(1);
        await this.addToPlaylist(playlistKey, remainingMedia);
      }

      console.log(`🎉 PlexClient: Successfully created playlist "${name}" with ${media.length} items`);
      return true;
    } catch (error) {
      console.error('❌ PlexClient: Failed to create playlist:', error);
      return false;
    }
  }

  async addSingleMediaToPlaylist(playlistKey: string, media: PlexMedia): Promise<boolean> {
    try {
      console.log(`🧪 PlexClient: Testing single media add: ${media.title}`);
      console.log(`📝 PlexClient: Media details:`, {
        guid: media.guid,
        key: media.key,
        title: media.title,
      });
      
      const key = media.key.split('/').pop();
      if (!key) {
        console.error(`❌ PlexClient: Invalid media key for test:`, media.key);
        return false;
      }
      
      // Get the real machine identifier from the server
      const realMachineId = await this.getRealMachineIdentifier();
      
      // Use proper server URI format as per Plex API documentation
      const serverUri = `server://${realMachineId}/com.plexapp.plugins.library/library/metadata/${key}`;
      console.log(`📝 PlexClient: Test media server URI: ${serverUri}`);
      
      console.log(`🔄 PlexClient: Using correct server URI format per Plex API docs...`);
      const response = await this.makeRequest(`/playlists/${playlistKey}/items`, 'PUT', {
        uri: serverUri,
      });
      
      console.log(`📋 PlexClient: Test media response:`, response);
      
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
      
      // Verify the media was added
      const playlistItems = await this.getPlaylistItems(playlistKey);
      const found = playlistItems.some(item => item.guid === media.guid);
      console.log(`🔍 PlexClient: Test media verification: ${found ? 'FOUND' : 'NOT FOUND'} in playlist`);
      
      if (!found) {
        console.warn(`❌ PlexClient: Server URI format failed to add media to playlist`);
        console.warn(`📊 PlexClient: Debug info - Machine ID: ${this.getMachineIdentifier()}`);
        console.warn(`📊 PlexClient: Debug info - Server URL: ${this.server.url}`);
        console.warn(`📊 PlexClient: Debug info - Media key: ${media.key}`);
      }
      
      return found;
    } catch (error) {
      console.error('❌ PlexClient: Single media test failed:', error);
      return false;
    }
  }

  async addToPlaylist(playlistKey: string, media: PlexMedia[]): Promise<boolean> {
    try {
      console.log(`➕ PlexClient: Adding ${media.length} items to playlist`, {
        playlistKey,
        fullPath: `/playlists/${playlistKey}/items`
      });
      
      // Validate playlist key format
      if (!playlistKey || !playlistKey.match(/^\d+$/)) {
        console.error(`❌ PlexClient: Invalid playlist key format for addToPlaylist: "${playlistKey}"`);
        throw new Error(`Invalid playlist key: ${playlistKey}`);
      }
      
      if (media.length === 0) {
        console.log('⏭️ PlexClient: No media to add, skipping');
        return true;
      }

      // Test with single media first to isolate issues
      if (media.length > 1) {
        console.log(`🧪 PlexClient: Testing with single media first...`);
        const testResult = await this.addSingleMediaToPlaylist(playlistKey, media[0]);
        if (!testResult) {
          console.error(`❌ PlexClient: Single media test failed, aborting batch operation`);
          return false;
        }
        console.log(`✅ PlexClient: Single media test passed, proceeding with remaining ${media.length - 1} items`);
        // Continue with remaining media
        media = media.slice(1);
        if (media.length === 0) return true;
      }

      // Get real machine identifier for server URIs
      const realMachineId = await this.getRealMachineIdentifier();
      
      const uris = media.map(item => {
        const key = item.key.split('/').pop();
        if (!key) {
          console.error(`❌ PlexClient: Invalid media key for ${item.title}:`, item.key);
          throw new Error(`Invalid media key: ${item.key}`);
        }
        const serverUri = `server://${realMachineId}/com.plexapp.plugins.library/library/metadata/${key}`;
        console.log(`📺 PlexClient: Media Server URI: ${item.title} -> ${serverUri}`);
        return serverUri;
      });

      // Add media one by one since batch requests seem to be overwriting
      console.log(`📝 PlexClient: Adding ${media.length} items individually to avoid batch issues`);
      globalActivityLogger.addLogEntry?.('info', `Adding ${media.length} items individually to playlist`, 'adding');

      let successCount = 0;
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const uri = uris[i];
        
        const currentProgress = {
          current: i + 1,
          total: media.length,
          percentage: Math.round(((i + 1) / media.length) * 100)
        };
        
        globalActivityLogger.addLogEntry?.('info', 
          `Adding item ${i + 1}/${media.length}: ${item.title}`, 
          'adding', 
          currentProgress
        );
        console.log(`📦 PlexClient: Adding item ${i + 1}/${media.length}: ${item.title}`);
        
        try {
          const response = await this.makeRequest(`/playlists/${playlistKey}/items`, 'PUT', {
            uri: uri,
          });
          
          console.log(`📋 PlexClient: Item ${i + 1} response:`, response);
          
          // Check response for success indicators
          if (response?.MediaContainer) {
            const leafCountAdded = response.MediaContainer.leafCountAdded || 0;
            const leafCountRequested = response.MediaContainer.leafCountRequested || 0;
            
            if (leafCountAdded > 0 || leafCountRequested > 0) {
              successCount++;
              globalActivityLogger.addLogEntry?.('success', 
                `Added "${item.title}"`, 
                'adding'
              );
              console.log(`✅ PlexClient: Item ${i + 1} added successfully (leafCountAdded: ${leafCountAdded}, leafCountRequested: ${leafCountRequested})`);
            } else {
              globalActivityLogger.addLogEntry?.('warning', 
                `May have failed to add "${item.title}"`, 
                'adding'
              );
              console.warn(`⚠️ PlexClient: Item ${i + 1} may not have been added (leafCountAdded: ${leafCountAdded}, leafCountRequested: ${leafCountRequested})`);
            }
          }
        } catch (error) {
          globalActivityLogger.addLogEntry?.('error', 
            `Failed to add "${item.title}": ${error}`, 
            'adding'
          );
          console.error(`❌ PlexClient: Failed to add item ${i + 1}:`, error);
        }
      }
      
      globalActivityLogger.addLogEntry?.('success', 
        `Individual additions complete. ${successCount}/${media.length} items processed successfully`, 
        'adding'
      );
      console.log(`📊 PlexClient: Individual additions complete. ${successCount}/${media.length} items processed successfully.`);

      // Verify media were actually added by reading the playlist back
      console.log(`🔍 PlexClient: Verifying items were added to playlist...`);
      const updatedPlaylistItems = await this.getPlaylistItems(playlistKey);
      console.log(`📊 PlexClient: Playlist now contains ${updatedPlaylistItems.length} total items`);
      
      // Check if our media are in the playlist
      const addedGuids = new Set(media.map(item => item.guid));
      const foundItems = updatedPlaylistItems.filter(item => addedGuids.has(item.guid));
      console.log(`✅ PlexClient: ${foundItems.length}/${media.length} items verified in playlist`);
      
      if (foundItems.length < media.length) {
        console.warn(`⚠️ PlexClient: ${media.length - foundItems.length} items missing from playlist after add operation`);
        
        // Log which items are missing
        const foundGuids = new Set(foundItems.map(item => item.guid));
        const missingItems = media.filter(item => !foundGuids.has(item.guid));
        console.warn(`❌ PlexClient: Missing items:`, missingItems.map(item => ({
          title: item.title,
          guid: item.guid,
          key: item.key
        })));
      }
      
      console.log(`🎉 PlexClient: Successfully added ${foundItems.length} items to playlist (${media.length} requested)`);
      return foundItems.length > 0;
    } catch (error) {
      console.error('❌ PlexClient: Failed to add to playlist:', error);
      return false;
    }
  }

  async updatePlaylist(playlistKey: string, newMedia: PlexMedia[], existingMedia: PlexMedia[]): Promise<boolean> {
    try {
      // Find media to add (not already in playlist)
      const existingGuids = new Set(existingMedia.map(item => item.guid));
      const mediaToAdd = newMedia.filter(item => !existingGuids.has(item.guid));

      if (mediaToAdd.length === 0) {
        return true; // Nothing to add
      }

      return await this.addToPlaylist(playlistKey, mediaToAdd);
    } catch (error) {
      console.error('Failed to update playlist:', error);
      return false;
    }
  }

  async createCollection(title: string, media: PlexMedia[]): Promise<boolean> {
    try {
      console.log(`📚 PlexClient: Creating collection "${title}" with ${media.length} items`);

      if (media.length === 0) {
        throw new Error('Cannot create collection with no media');
      }

      // Collections need section ID - get it from the first media item
      const sectionId = await this.getSectionIdFromMedia(media[0]);
      if (!sectionId) {
        throw new Error('Could not determine library section ID');
      }

      // Determine collection type based on media content
      const isShowCollection = 'grandparentTitle' in media[0] && 'seasonNumber' in media[0];
      const collectionType = isShowCollection ? 2 : 1; // 1 for movies, 2 for shows

      console.log('📝 PlexClient: Creating empty collection first:', {
        title,
        sectionId,
        type: collectionType,
        contentType: isShowCollection ? 'TV Shows' : 'Movies',
      });

      // Create empty collection first (without uri parameter)
      const data = await this.makeRequest('/library/collections', 'POST', {
        type: collectionType,
        title: title,
        smart: 0,
        sectionId: sectionId,
      });

      console.log('📋 PlexClient: Collection creation response:', data);

      const collectionKey = data?.MediaContainer?.Metadata?.[0]?.ratingKey;
      if (!collectionKey) {
        console.error('❌ PlexClient: No collection key in response:', data);
        throw new Error('Failed to get collection key from creation response');
      }

      console.log(`✅ PlexClient: Empty collection created with key: "${collectionKey}"`);
      console.log(`📦 PlexClient: Now adding ${media.length} items to collection...`);

      // Add all media items to the collection using the collection title
      const success = await this.addToCollection(title, media);

      if (!success) {
        throw new Error('Failed to add items to collection');
      }

      console.log(`🎉 PlexClient: Successfully created collection "${title}" with ${media.length} items`);
      return true;
    } catch (error) {
      console.error('❌ PlexClient: Failed to create collection:', error);
      return false;
    }
  }

  async getSectionIdFromMedia(media: PlexMedia): Promise<string | null> {
    try {
      // Make a request to get full metadata including section ID
      const data = await this.makeRequest(media.key);
      const sectionId = data?.MediaContainer?.librarySectionID;

      if (sectionId) {
        console.log(`🏷️ PlexClient: Found section ID ${sectionId} for ${media.title}`);
        return sectionId;
      }

      console.warn('⚠️ PlexClient: No section ID found in media metadata');
      return null;
    } catch (error) {
      console.error('❌ PlexClient: Failed to get section ID:', error);
      return null;
    }
  }

  async getCollections(): Promise<PlexPlaylist[]> {
    try {
      console.log('📋 PlexClient: Fetching collections');

      // Get all library sections and fetch collections from each
      const libraries = await this.getLibraries();
      const allCollections: PlexPlaylist[] = [];

      for (const library of libraries) {
        try {
          const data = await this.makeRequest(`/library/sections/${library.key}/collections`);

          if (!data?.MediaContainer?.Metadata) {
            continue;
          }

          const collections = data.MediaContainer.Metadata.map((item: { ratingKey?: string; key?: string; title?: string; summary?: string; childCount?: number }) => ({
            key: item.ratingKey || item.key,
            title: item.title || '',
            summary: item.summary || '',
            leafCount: item.childCount || 0,
          }));

          allCollections.push(...collections);
        } catch (error) {
          console.warn(`⚠️ PlexClient: Failed to get collections from library ${library.title}:`, error);
        }
      }

      console.log(`✅ PlexClient: Found ${allCollections.length} total collections`);
      return allCollections;
    } catch (error) {
      console.error('❌ PlexClient: Failed to get collections:', error);
      return [];
    }
  }

  async addToCollection(collectionTitle: string, media: PlexMedia[]): Promise<boolean> {
    try {
      console.log(`➕ PlexClient: Adding ${media.length} items to collection "${collectionTitle}"`);

      if (media.length === 0) {
        console.log('⏭️ PlexClient: No media to add, skipping');
        return true;
      }

      let successCount = 0;
      let failCount = 0;

      // Collections in Plex work by setting metadata fields on items
      // The correct endpoint is PUT /library/sections/{sectionId}/all
      // with parameters: type={type}, id={ratingKey}, collection[0].tag.tag={collectionName}
      
      // We need the section ID from the first item
      const sectionId = await this.getSectionIdFromMedia(media[0]);
      if (!sectionId) {
        throw new Error('Could not determine library section ID');
      }

      // Determine the type (1 for movies, 4 for episodes, 2 for shows)
      const isEpisode = 'grandparentTitle' in media[0] && 'seasonNumber' in media[0];
      const itemType = isEpisode ? 4 : 1;

      console.log(`📝 PlexClient: Using section ${sectionId}, type ${itemType} for collection "${collectionTitle}"`);

      // Add media to collection one by one
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const ratingKey = item.key.split('/').pop();

        if (!ratingKey) {
          console.error(`❌ PlexClient: Invalid media key for ${item.title}:`, item.key);
          failCount++;
          continue;
        }

        if (i % 50 === 0 || i === 0) {
          globalActivityLogger.addLogEntry?.('info',
            `Adding items to collection: ${i + 1}/${media.length}`,
            'adding'
          );
        }
        console.log(`📦 PlexClient: Adding item ${i + 1}/${media.length} to collection: ${item.title} (key: ${ratingKey})`);

        try {
          // Use the correct Plex API endpoint for setting collection tags
          // PUT /library/sections/{sectionId}/all?type={type}&id={ratingKey}&collection[0].tag.tag={collectionName}
          await this.makeRequest(`/library/sections/${sectionId}/all`, 'PUT', {
            type: itemType,
            id: ratingKey,
            'collection[0].tag.tag': collectionTitle,
            'collection.locked': 1,
          });

          successCount++;
          if (successCount % 10 === 0) {
            console.log(`✅ PlexClient: ${successCount} items added successfully so far...`);
          }
        } catch (error) {
          failCount++;
          // Only log first few failures to avoid spam
          if (failCount <= 5) {
            console.error(`⚠️ PlexClient: Failed to add "${item.title}":`, error);
          } else if (failCount === 6) {
            console.warn(`⚠️ PlexClient: Suppressing further failure logs... (${failCount} failures so far)`);
          }
        }
      }

      console.log(`🎉 PlexClient: Finished adding items to collection - ${successCount} succeeded, ${failCount} failed/skipped`);
      globalActivityLogger.addLogEntry?.('success',
        `Added ${successCount} items to collection (${failCount} items skipped)`,
        'adding'
      );

      return successCount > 0; // Return true if at least some items were added
    } catch (error) {
      console.error('❌ PlexClient: Failed to add to collection:', error);
      return false;
    }
  }
}