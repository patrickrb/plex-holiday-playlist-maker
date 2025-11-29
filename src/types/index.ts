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

export interface PlexMovie {
  guid: string;
  key: string;
  title: string;
  summary?: string;
  year?: number;
  thumb?: string;
  addedAt?: number;
}

// Union type for content that can be in playlists
export type PlexMedia = PlexEpisode | PlexMovie;

export interface PlexPlaylist {
  key: string;
  title: string;
  summary?: string;
  leafCount: number;
  items?: PlexMedia[];
}

export type Holiday =
  | 'Christmas'
  | 'Thanksgiving'
  | 'Halloween'
  | 'New Years'
  | 'Hanukkah'
  | 'Kwanzaa'
  | 'Easter'
  | 'Valentine\'s Day'
  | 'Independence Day'
  | 'St. Patrick\'s Day'
  | 'April Fools'
  | 'Mother\'s Day'
  | 'Father\'s Day'
  | 'Labor Day'
  | 'Memorial Day'
  | 'Veterans Day'
  | 'Mardi Gras'
  | 'Dia de los Muertos'
  | 'Chinese New Year'
  | 'Diwali'
  | 'Ramadan'
  | 'Winter Holiday'
  | 'Generic Holiday';

export interface HolidayMatch {
  holiday: Holiday;
  episodes: PlexEpisode[];
  movies: PlexMovie[];
}

export interface PlaylistPreview {
  holiday: Holiday;
  name: string;
  episodes: PlexEpisode[];
  movies: PlexMovie[];
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

// Type guards for distinguishing between episodes and movies
export function isPlexEpisode(media: PlexMedia): media is PlexEpisode {
  return 'grandparentTitle' in media && 'seasonNumber' in media && 'index' in media;
}

export function isPlexMovie(media: PlexMedia): media is PlexMovie {
  return !isPlexEpisode(media);
}