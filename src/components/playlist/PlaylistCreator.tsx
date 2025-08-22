'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePlex } from '@/contexts/PlexContext';
import { useHolidayPlaylists } from '@/hooks/useHolidayPlaylists';
import { ActivityLog } from '@/components/ui/ActivityLog';
import { PlexClient } from '@/lib/plex/client';
import { PlaylistPreview, PlexLibrary, PlexMedia, Holiday, isPlexEpisode } from '@/types';
import { DEFAULT_TV_LIBRARY, DEFAULT_MOVIE_LIBRARY } from '@/lib/holiday/config';

interface PlaylistCreatorProps {
  onPlaylistsCreated?: () => void;
}

export function PlaylistCreator({ onPlaylistsCreated }: PlaylistCreatorProps) {
  const { 
    getLibraries, getEpisodes, getMovies, getPlaylists, getPlaylistItems, createPlaylist, updatePlaylist, isConnected,
    activityLog, currentPhase, overallProgress, addLogEntry, setCurrentPhase, setOverallProgress, clearActivityLog
  } = usePlex();
  console.log('🔄 PlaylistCreator: Component state', { isConnected });
  const { generatePlaylistPreviews, isAnalyzing, isScrapingWiki, error } = useHolidayPlaylists();
  
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(new Set());
  const [playlistPreviews, setPlaylistPreviews] = useState<PlaylistPreview[]>([]);
  const [useWikipedia, setUseWikipedia] = useState(true);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isCreatingPlaylists, setIsCreatingPlaylists] = useState(false);
  const [step, setStep] = useState<'holidays' | 'library' | 'analyze' | 'confirm' | 'create'>('holidays');
  const [selectedHolidays, setSelectedHolidays] = useState<Set<Holiday>>(new Set(['Halloween', 'Thanksgiving', 'Christmas', "Valentine's"]));
  const [selectedMedia, setSelectedMedia] = useState<Map<string, boolean>>(new Map());
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [totalMedia, setTotalMedia] = useState<number>(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(8);

  // Set up activity logger for PlexClient
  useEffect(() => {
    PlexClient.setActivityLogger({
      addLogEntry,
      setOverallProgress,
      setCurrentPhase
    });
  }, [addLogEntry, setOverallProgress, setCurrentPhase]);

  const loadLibraries = useCallback(async () => {
    setIsLoadingLibraries(true);
    try {
      const libs = await getLibraries();
      const mediaLibraries = libs.filter(lib => lib.type === 'show' || lib.type === 'movie');
      setLibraries(mediaLibraries);
      
      const selectedSet = new Set<string>();
      
      // Auto-select default TV library if it exists
      const defaultTvLib = mediaLibraries.find(lib => lib.title === DEFAULT_TV_LIBRARY);
      if (defaultTvLib) {
        selectedSet.add(defaultTvLib.key);
      }
      
      // Auto-select default movie library if it exists
      const defaultMovieLib = mediaLibraries.find(lib => lib.title === DEFAULT_MOVIE_LIBRARY);
      if (defaultMovieLib) {
        selectedSet.add(defaultMovieLib.key);
      }
      
      // If no defaults found, auto-select single libraries of each type
      if (selectedSet.size === 0) {
        const tvLibraries = mediaLibraries.filter(lib => lib.type === 'show');
        const movieLibraries = mediaLibraries.filter(lib => lib.type === 'movie');
        
        if (tvLibraries.length === 1) {
          selectedSet.add(tvLibraries[0].key);
        }
        if (movieLibraries.length === 1) {
          selectedSet.add(movieLibraries[0].key);
        }
      }
      
      setSelectedLibraries(selectedSet);
    } catch (err) {
      console.error('Failed to load libraries:', err);
      // Don't crash the component, just log the error
      setLibraries([]);
    } finally {
      setIsLoadingLibraries(false);
    }
  }, [getLibraries]);

  useEffect(() => {
    if (isConnected) {
      loadLibraries();
    }
  }, [loadLibraries, isConnected]);

  const analyzeLibraries = async () => {
    if (selectedLibraries.size === 0) return;
    
    setStep('analyze');
    setScanProgress(0);
    setScanStatus('Initializing scan...');
    clearActivityLog();
    setCurrentPhase('scanning');
    
    const holidayList = Array.from(selectedHolidays).join(', ');
    addLogEntry('info', `Starting media analysis for ${holidayList}`, 'scanning');
    console.log('🔍 Starting media analysis for selected holidays:', Array.from(selectedHolidays));
    
    try {
      // Phase 1: Load media from selected libraries
      setScanStatus('Loading media from Plex libraries...');
      setScanProgress(10);
      setOverallProgress({ current: 1, total: 5, percentage: 20 });
      addLogEntry('info', 'Loading media from Plex libraries...', 'scanning');
      console.log('📚 Loading media from libraries:', Array.from(selectedLibraries));
      
      const allMedia: PlexMedia[] = [];
      const libraryKeys = Array.from(selectedLibraries);
      
      for (const libraryKey of libraryKeys) {
        const library = libraries.find(lib => lib.key === libraryKey);
        if (!library) continue;
        
        if (library.type === 'show') {
          console.log(`📺 Loading episodes from TV library: ${library.title}`);
          const episodes = await getEpisodes(libraryKey);
          allMedia.push(...episodes);
          addLogEntry('info', `Loaded ${episodes.length} episodes from "${library.title}"`, 'scanning');
        } else if (library.type === 'movie') {
          console.log(`🎬 Loading movies from movie library: ${library.title}`);
          const movies = await getMovies(libraryKey);
          allMedia.push(...movies);
          addLogEntry('info', `Loaded ${movies.length} movies from "${library.title}"`, 'scanning');
        }
      }
      
      setTotalMedia(allMedia.length);
      addLogEntry('success', `Loaded ${allMedia.length} total media items from ${libraryKeys.length} libraries`, 'scanning');
      console.log(`📊 Loaded ${allMedia.length} total media items from ${libraryKeys.length} libraries`);
      
      // Phase 2: Get existing playlists
      setScanStatus('Checking existing holiday playlists...');
      setScanProgress(20);
      setOverallProgress({ current: 2, total: 5, percentage: 40 });
      addLogEntry('info', 'Checking for existing holiday playlists...', 'scanning');
      console.log('📋 Checking for existing holiday playlists');
      
      const existingPlaylists = await getPlaylists();
      const playlistMap = new Map<string, PlexMedia[]>();
      
      let playlistCount = 0;
      for (const playlist of existingPlaylists) {
        if (playlist.title.startsWith('Holiday – ')) {
          console.log(`📝 Found existing playlist: ${playlist.title}`);
          const items = await getPlaylistItems(playlist.key);
          playlistMap.set(playlist.title, items);
          console.log(`  └── Contains ${items.length} items`);
          playlistCount++;
          addLogEntry('info', `Found playlist "${playlist.title}" with ${items.length} items`, 'scanning');
        }
      }
      addLogEntry('success', `Found ${playlistCount} existing holiday playlists`, 'scanning');
      console.log(`📊 Found ${playlistCount} existing holiday playlists`);
      
      // Phase 3: Wikipedia scraping (if enabled)
      if (useWikipedia) {
        setScanStatus('Scraping Wikipedia for holiday content...');
        setScanProgress(30);
        setOverallProgress({ current: 3, total: 5, percentage: 60 });
        addLogEntry('info', 'Scraping Wikipedia for holiday content...', 'scanning');
        console.log('🌐 Starting Wikipedia scraping for holiday content');
      } else {
        setScanProgress(40);
        setOverallProgress({ current: 3, total: 5, percentage: 60 });
        addLogEntry('info', 'Skipping Wikipedia scraping (disabled)', 'scanning');
        console.log('⏭️ Skipping Wikipedia scraping (disabled)');
      }
      
      // Phase 4: Media analysis
      setScanStatus('Analyzing media for holiday matches...');
      setScanProgress(50);
      setOverallProgress({ current: 4, total: 5, percentage: 80 });
      addLogEntry('info', `Analyzing ${allMedia.length} media items for holiday matches...`, 'scanning');
      console.log('🔍 Starting media analysis phase');
      console.log(`📊 Analyzing ${allMedia.length} media items for holidays:`, Array.from(selectedHolidays));
      
      // Generate previews for selected holidays only
      const previews = await generatePlaylistPreviews(allMedia, playlistMap, useWikipedia, selectedHolidays, confidenceThreshold);
      
      // Phase 5: Complete
      setScanStatus('Analysis complete!');
      setScanProgress(100);
      setOverallProgress({ current: 5, total: 5, percentage: 100 });
      setCurrentPhase(null);
      
      console.log('✅ Analysis complete! Results:');
      let totalItemsFound = 0;
      previews.forEach(preview => {
        const itemCount = preview.episodes.length + preview.movies.length;
        totalItemsFound += itemCount;
        addLogEntry('success', `${preview.holiday}: ${itemCount} items found (${preview.episodes.length} episodes, ${preview.movies.length} movies, ${preview.newCount} new)`, 'scanning');
        console.log(`🎭 ${preview.holiday}: ${itemCount} items found (${preview.episodes.length} episodes, ${preview.movies.length} movies, ${preview.newCount} new)`);
        
        preview.episodes.forEach(ep => {
          console.log(`  📺 ${ep.grandparentTitle} - S${ep.seasonNumber}E${ep.index}: ${ep.title}`);
        });
        preview.movies.forEach(movie => {
          console.log(`  🎬 ${movie.title} (${movie.year || 'N/A'})`);
        });
      });
      addLogEntry('success', `Analysis complete! Found ${totalItemsFound} holiday media items total`, 'scanning');
      
      setPlaylistPreviews(previews);
      setStep('confirm');
    } catch (err) {
      console.error('❌ Failed to analyze libraries:', err);
      addLogEntry('error', `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'scanning');
      setScanStatus('Analysis failed');
      setCurrentPhase(null);
    }
  };

  const createSelectedPlaylists = async () => {
    setIsCreatingPlaylists(true);
    setStep('create');
    setCurrentPhase('creating');
    
    const totalSelected = Array.from(selectedMedia.values()).filter(Boolean).length;
    addLogEntry('info', `Starting playlist creation with ${totalSelected} selected items`, 'creating');
    console.log(`🎵 Starting playlist creation with ${totalSelected} selected items`);
    
    try {
      const totalPlaylists = playlistPreviews.filter(preview => {
        const allMedia = [...preview.episodes, ...preview.movies];
        return allMedia.some(item => selectedMedia.get(item.guid) === true);
      }).length;
      
      let currentPlaylist = 0;
      
      for (const preview of playlistPreviews) {
        // Get only the selected media for this holiday
        const selectedEpisodesForHoliday = preview.episodes.filter(ep => 
          selectedMedia.get(ep.guid) === true
        );
        const selectedMoviesForHoliday = preview.movies.filter(movie => 
          selectedMedia.get(movie.guid) === true
        );
        const selectedMediaForHoliday = [...selectedEpisodesForHoliday, ...selectedMoviesForHoliday];
        
        console.log(`🎭 Processing ${preview.holiday}: ${selectedMediaForHoliday.length} selected items (${selectedEpisodesForHoliday.length} episodes, ${selectedMoviesForHoliday.length} movies)`);
        
        if (selectedMediaForHoliday.length > 0) {
          currentPlaylist++;
          setOverallProgress({ 
            current: currentPlaylist, 
            total: totalPlaylists, 
            percentage: Math.round((currentPlaylist / totalPlaylists) * 100) 
          });
          setCurrentPhase('adding');
          
          // Check if playlist already exists
          const existingPlaylists = await getPlaylists();
          const existing = existingPlaylists.find(p => p.title === preview.name);
          
          if (existing) {
            addLogEntry('info', `Updating existing playlist: ${preview.name}`, 'adding');
            console.log(`📝 Updating existing playlist: ${preview.name}`);
            const existingItems = await getPlaylistItems(existing.key);
            console.log(`  └── Current playlist has ${existingItems.length} items`);
            
            await updatePlaylist(existing.key, selectedMediaForHoliday, existingItems);
            addLogEntry('success', `Updated playlist "${preview.name}" with ${selectedMediaForHoliday.length} items`, 'adding');
            console.log(`  ✅ Updated playlist with ${selectedMediaForHoliday.length} items`);
          } else {
            addLogEntry('info', `Creating new playlist: ${preview.name}`, 'creating');
            console.log(`🆕 Creating new playlist: ${preview.name}`);
            await createPlaylist(preview.name, selectedMediaForHoliday);
            addLogEntry('success', `Created playlist "${preview.name}" with ${selectedMediaForHoliday.length} items`, 'creating');
            console.log(`  ✅ Created playlist with ${selectedMediaForHoliday.length} items`);
          }
        } else {
          addLogEntry('info', `Skipping ${preview.holiday}: no items selected`, 'creating');
          console.log(`⏭️ Skipping ${preview.holiday}: no items selected`);
        }
      }
      
      setOverallProgress({ current: totalPlaylists, total: totalPlaylists, percentage: 100 });
      setCurrentPhase(null);
      addLogEntry('success', 'Playlist creation complete!', 'creating');
      console.log('🎉 Playlist creation complete!');
      onPlaylistsCreated?.();
    } catch (err) {
      addLogEntry('error', `Failed to create playlists: ${err instanceof Error ? err.message : 'Unknown error'}`, 'creating');
      console.error('❌ Failed to create playlists:', err);
      setCurrentPhase(null);
    } finally {
      setIsCreatingPlaylists(false);
    }
  };

  const resetAnalysis = () => {
    setStep('holidays');
    setPlaylistPreviews([]);
    setSelectedMedia(new Map());
  };

  // Don't render if not connected to Plex
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connecting to Plex</CardTitle>
          <CardDescription>
            Please wait while we establish a connection to your Plex server...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'holidays') {
    const holidays: Holiday[] = ['Halloween', 'Thanksgiving', 'Christmas', "Valentine's"];
    const holidayEmojis: Record<Holiday, string> = {
      'Halloween': '🎃',
      'Thanksgiving': '🦃', 
      'Christmas': '🎄',
      "Valentine's": '💝'
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Holidays</CardTitle>
          <CardDescription>
            Choose which holidays you want to create playlists for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {holidays.map((holiday) => (
              <div key={holiday} className="flex items-center space-x-3">
                <Checkbox
                  id={holiday}
                  checked={selectedHolidays.has(holiday)}
                  onCheckedChange={(checked) => {
                    const newSelected = new Set(selectedHolidays);
                    if (checked) {
                      newSelected.add(holiday);
                    } else {
                      newSelected.delete(holiday);
                    }
                    setSelectedHolidays(newSelected);
                  }}
                />
                <Label htmlFor={holiday} className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-2xl">{holidayEmojis[holiday]}</span>
                  <span className="font-medium">{holiday}</span>
                </Label>
              </div>
            ))}
          </div>
          
          {selectedHolidays.size === 0 && (
            <Alert>
              <AlertDescription>
                Please select at least one holiday to continue.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button variant="outline" disabled>
              Back
            </Button>
            <Button 
              onClick={() => setStep('library')}
              disabled={selectedHolidays.size === 0}
            >
              Continue to Library Selection
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'library') {
    const tvLibraries = libraries.filter(lib => lib.type === 'show');
    const movieLibraries = libraries.filter(lib => lib.type === 'movie');
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Media Libraries</CardTitle>
          <CardDescription>
            Choose which TV and movie libraries to scan for holiday content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingLibraries ? (
            <div>Loading libraries...</div>
          ) : libraries.length === 0 ? (
            <Alert>
              <AlertDescription>
                No media libraries found. Make sure you have TV shows or movies in your Plex server.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {tvLibraries.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">📺 TV Show Libraries</h3>
                  <div className="space-y-2">
                    {tvLibraries.map((library) => (
                      <div key={library.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={library.key}
                          checked={selectedLibraries.has(library.key)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedLibraries);
                            if (checked) {
                              newSelected.add(library.key);
                            } else {
                              newSelected.delete(library.key);
                            }
                            setSelectedLibraries(newSelected);
                          }}
                        />
                        <Label htmlFor={library.key} className="flex-1">
                          {library.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {movieLibraries.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">🎬 Movie Libraries</h3>
                  <div className="space-y-2">
                    {movieLibraries.map((library) => (
                      <div key={library.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={library.key}
                          checked={selectedLibraries.has(library.key)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedLibraries);
                            if (checked) {
                              newSelected.add(library.key);
                            } else {
                              newSelected.delete(library.key);
                            }
                            setSelectedLibraries(newSelected);
                          }}
                        />
                        <Label htmlFor={library.key} className="flex-1">
                          {library.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useWikipedia"
                checked={useWikipedia}
                onCheckedChange={(checked) => setUseWikipedia(!!checked)}
              />
              <Label htmlFor="useWikipedia">
                Use Wikipedia scraping for enhanced content detection
              </Label>
            </div>
            {useWikipedia && (
              <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium">📚 Enhanced Detection Active</p>
                <p>Wikipedia scraping will supplement curated keywords with comprehensive movie and TV show databases from Wikipedia, significantly improving holiday content detection.</p>
                <p className="mt-1 text-xs text-blue-500">
                  Note: If network restrictions prevent Wikipedia access, the system will automatically fall back to curated keyword matching.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confidence">
                Match Confidence Threshold: {confidenceThreshold}
              </Label>
              <input
                id="confidence"
                type="range"
                min="1"
                max="20"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-600">
                Lower = more items (may include false positives) • Higher = fewer items (more accurate)
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button 
              variant="outline"
              onClick={() => setStep('holidays')}
            >
              Back to Holiday Selection
            </Button>
            <Button 
              onClick={analyzeLibraries} 
              disabled={selectedLibraries.size === 0 || isAnalyzing || isScrapingWiki}
            >
              {isScrapingWiki ? 'Scraping Wikipedia...' : isAnalyzing ? 'Analyzing Media...' : 'Analyze Libraries'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'analyze') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Analyzing Episodes</CardTitle>
            <CardDescription>
              Scanning your library for holiday episodes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{scanStatus}</span>
                <span>{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} className="w-full" />
            </div>
            
            {totalMedia > 0 && (
              <div className="text-sm text-gray-600">
                <p>📚 Libraries: {Array.from(selectedLibraries).map(key => libraries.find(l => l.key === key)?.title).filter(Boolean).join(', ')}</p>
                <p>📊 Total media items: {totalMedia.toLocaleString()}</p>
                <p>🎭 Selected holidays: {Array.from(selectedHolidays).join(', ')}</p>
                {useWikipedia && <p>🌐 Wikipedia scraping: Enabled</p>}
              </div>
            )}

            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>

        <ActivityLog 
          entries={activityLog}
          currentPhase={currentPhase}
          overallProgress={overallProgress}
          className="w-full"
        />
      </div>
    );
  }

  if (step === 'confirm') {
    const holidayEmojis: Record<Holiday, string> = {
      'Halloween': '🎃',
      'Thanksgiving': '🦃', 
      'Christmas': '🎄',
      "Valentine's": '💝'
    };

    // Initialize selected media if not already done
    if (selectedMedia.size === 0 && playlistPreviews.length > 0) {
      const newSelected = new Map<string, boolean>();
      playlistPreviews.forEach(preview => {
        [...preview.episodes, ...preview.movies].forEach(item => {
          newSelected.set(item.guid, true); // Default to selected
        });
      });
      setSelectedMedia(newSelected);
    }

    const getSelectedCount = (holiday: Holiday) => {
      const preview = playlistPreviews.find(p => p.holiday === holiday);
      if (!preview) return 0;
      const allMedia = [...preview.episodes, ...preview.movies];
      return allMedia.filter(item => selectedMedia.get(item.guid) === true).length;
    };

    const toggleMedia = (mediaGuid: string) => {
      const newSelected = new Map(selectedMedia);
      newSelected.set(mediaGuid, !newSelected.get(mediaGuid));
      setSelectedMedia(newSelected);
    };

    const toggleAllForHoliday = (holiday: Holiday, selectAll: boolean) => {
      const preview = playlistPreviews.find(p => p.holiday === holiday);
      if (!preview) return;
      
      const newSelected = new Map(selectedMedia);
      const allMedia = [...preview.episodes, ...preview.movies];
      allMedia.forEach(item => {
        newSelected.set(item.guid, selectAll);
      });
      setSelectedMedia(newSelected);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Media</CardTitle>
          <CardDescription>
            Select which episodes and movies to include in your holiday playlists
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {playlistPreviews.length === 0 ? (
            <Alert>
              <AlertDescription>
                No holiday content found in your libraries. Try enabling Wikipedia scraping or add more content.
              </AlertDescription>
            </Alert>
          ) : (
            playlistPreviews.map((preview) => {
              const selectedCount = getSelectedCount(preview.holiday);
              return (
                <div key={preview.holiday} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{holidayEmojis[preview.holiday]}</span>
                      <h3 className="font-medium">{preview.name}</h3>
                      <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                        {selectedCount} selected
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAllForHoliday(preview.holiday, true)}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAllForHoliday(preview.holiday, false)}
                      >
                        Select None
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[...preview.episodes, ...preview.movies].map((item) => {
                      return (
                        <div key={item.guid} className="flex items-start space-x-3">
                          <Checkbox
                            id={item.guid}
                            checked={selectedMedia.get(item.guid) === true}
                            onCheckedChange={() => toggleMedia(item.guid)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label 
                              htmlFor={item.guid} 
                              className="cursor-pointer block"
                            >
                              {isPlexEpisode(item) ? (
                                <>
                                  <div className="font-medium">📺 {item.grandparentTitle}</div>
                                  <div className="text-sm text-gray-600">
                                    S{item.seasonNumber}E{item.index}: {item.title}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-medium">🎬 {item.title}</div>
                                  <div className="text-sm text-gray-600">
                                    Movie{item.year ? ` (${item.year})` : ''}
                                  </div>
                                </>
                              )}
                              {item.summary && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {item.summary}
                                </div>
                              )}
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div className="flex justify-between">
            <Button onClick={resetAnalysis} variant="outline">
              Back to Analysis
            </Button>
            <Button 
              onClick={createSelectedPlaylists}
              disabled={Array.from(selectedMedia.values()).every(selected => !selected)}
              className="flex-1"
            >
              Create/Update Playlists
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'create') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Creating Playlists</CardTitle>
            <CardDescription>
              {isCreatingPlaylists ? 'Creating your holiday playlists...' : 'Playlists created successfully!'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isCreatingPlaylists ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentPhase === 'creating' ? 'Creating playlists...' : currentPhase === 'adding' ? 'Adding episodes...' : 'Processing...'}</span>
                  <span>{overallProgress ? `${overallProgress.current}/${overallProgress.total}` : ''}</span>
                </div>
                <Progress value={overallProgress?.percentage || 0} className="w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Your holiday playlists have been created/updated successfully!
                  </AlertDescription>
                </Alert>
                <Button onClick={resetAnalysis} className="w-full">
                  Create More Playlists
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <ActivityLog 
          entries={activityLog}
          currentPhase={currentPhase}
          overallProgress={overallProgress}
          className="w-full"
        />
      </div>
    );
  }

  return null;
}