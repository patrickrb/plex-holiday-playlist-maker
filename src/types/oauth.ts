export interface PlexOAuthClient {
  clientIdentifier: string;
  product: string;
  device: string;
  version: string;
  forwardUrl: string;
  platform: string;
  urlencode: boolean;
}

export interface PlexOAuthData {
  authToken: string;
  user: {
    id: number;
    username: string;
    email: string;
    title: string;
    thumb: string;
  };
  servers: PlexOAuthServer[];
}

export interface PlexOAuthServer {
  name: string;
  host: string;
  port: number;
  machineIdentifier: string;
  version: string;
  accessToken: string;
  local: boolean;
  owned: boolean;
  home: boolean;
  synced: boolean;
}

export interface PlexAuthSession {
  isAuthenticated: boolean;
  user?: PlexOAuthData['user'];
  authToken?: string;
  servers: PlexOAuthServer[];
  selectedServer?: PlexOAuthServer;
}