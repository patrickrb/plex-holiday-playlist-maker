import { v4 as uuidv4 } from 'uuid';
import { PlexOAuthClient, PlexOAuthData, PlexOAuthServer } from '@/types/oauth';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PlexOauth } = require('plex-oauth');

export class PlexOAuthManager {
  private clientInfo: PlexOAuthClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private oauth: any;

  constructor() {
    // Generate or get stored client identifier
    const storedClientId = typeof window !== 'undefined' 
      ? localStorage.getItem('plex-client-identifier') 
      : null;
    
    const clientIdentifier = storedClientId || uuidv4();
    
    if (typeof window !== 'undefined' && !storedClientId) {
      localStorage.setItem('plex-client-identifier', clientIdentifier);
    }

    this.clientInfo = {
      clientIdentifier,
      product: 'Plex Holiday Playlist Maker',
      device: 'Web Browser',
      version: '1.0.0',
      forwardUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth/callback`,
      platform: 'Web',
      urlencode: true
    };

    this.oauth = new PlexOauth(this.clientInfo);
  }

  async getHostedLoginURL(): Promise<[string, string]> {
    try {
      return await this.oauth.requestHostedLoginURL();
    } catch (error) {
      console.error('Failed to get hosted login URL:', error);
      throw new Error('Failed to initiate Plex authentication');
    }
  }

  async checkForAuthToken(pinId: string): Promise<string | null> {
    try {
      return await this.oauth.checkForAuthToken(pinId);
    } catch (error) {
      console.error('Failed to check for auth token:', error);
      return null;
    }
  }

  async getUserData(authToken: string): Promise<PlexOAuthData | null> {
    try {
      const response = await fetch('https://plex.tv/users/account.json', {
        headers: {
          'X-Plex-Token': authToken,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      const user = data.user;

      // Get user's servers
      const servers = await this.getUserServers(authToken);

      return {
        authToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          title: user.title,
          thumb: user.thumb
        },
        servers
      };
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  private async getUserServers(authToken: string): Promise<PlexOAuthServer[]> {
    try {
      const response = await fetch('https://plex.tv/pms/servers.xml', {
        headers: {
          'X-Plex-Token': authToken,
          'Accept': 'application/xml'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch servers');
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const serverElements = xmlDoc.getElementsByTagName('Server');

      const servers: PlexOAuthServer[] = [];
      
      for (let i = 0; i < serverElements.length; i++) {
        const server = serverElements[i];
        servers.push({
          name: server.getAttribute('name') || '',
          host: server.getAttribute('host') || '',
          port: parseInt(server.getAttribute('port') || '32400'),
          machineIdentifier: server.getAttribute('machineIdentifier') || '',
          version: server.getAttribute('version') || '',
          accessToken: server.getAttribute('accessToken') || authToken,
          local: server.getAttribute('local') === '1',
          owned: server.getAttribute('owned') === '1',
          home: server.getAttribute('home') === '1',
          synced: server.getAttribute('synced') === '1'
        });
      }

      return servers;
    } catch (error) {
      console.error('Failed to get user servers:', error);
      return [];
    }
  }

  getClientInfo(): PlexOAuthClient {
    return this.clientInfo;
  }
}