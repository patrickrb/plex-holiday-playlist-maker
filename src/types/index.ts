export interface PlexServer {
  url: string;
  token: string;
  name?: string;
}

export interface PlexConnection {
  url: string;
  token: string;
  name: string;
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: string;
}

export interface PlexEpisode {
  guid: string;
  key: string;
  title: string;
  summary?: string;
  grandparentTitle: string; // Show title
  seasonNumber: number;
  index: number; // Episode number
  thumb?: string;
  year?: number;
  addedAt?: number;
}

export interface PlexPlaylist {
  key: string;
  title: string;
  summary?: string;
  leafCount: number;
  items?: PlexEpisode[];
}

export type Holiday = 'Halloween' | 'Thanksgiving' | 'Christmas' | "Valentine's";

export interface HolidayMatch {
  holiday: Holiday;
  episodes: PlexEpisode[];
}

export interface PlaylistPreview {
  holiday: Holiday;
  name: string;
  episodes: PlexEpisode[];
  existingCount?: number;
  newCount: number;
}

export interface WikiTitle {
  title: string;
  holiday: Holiday;
}

export interface HolidayConfig {
  keywords: string[];
  wikiSources: string[];
  excludePatterns: string[];
}