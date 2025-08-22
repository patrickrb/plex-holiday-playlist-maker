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
import { PlaylistPreview, PlexLibrary, PlexEpisode, Holiday } from '@/types';
import { DEFAULT_TV_LIBRARY } from '@/lib/holiday/config';

interface PlaylistCreatorProps {
  onPlaylistsCreated?: () => void;
}

export function PlaylistCreator({ onPlaylistsCreated }: PlaylistCreatorProps) {
  const { 
    getLibraries, getEpisodes, getPlaylists, getPlaylistItems, createPlaylist, updatePlaylist, isConnected,
    activityLog, currentPhase, overallProgress, addLogEntry, setCurrentPhase, setOverallProgress, clearActivityLog
  } = usePlex();
  console.log('🔄 PlaylistCreator: Component state', { isConnected });
  const { generatePlaylistPreviews, isAnalyzing, isScrapingWiki, error } = useHolidayPlaylists();
  
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<string>('');
  const [playlistPreviews, setPlaylistPreviews] = useState<PlaylistPreview[]>([]);
  const [useWikipedia, setUseWikipedia] = useState(true);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isCreatingPlaylists, setIsCreatingPlaylists] = useState(false);
  const [step, setStep] = useState<'holidays' | 'library' | 'analyze' | 'confirm' | 'create'>('holidays');
  const [selectedHolidays, setSelectedHolidays] = useState<Set<Holiday>>(new Set(['Halloween', 'Thanksgiving', 'Christmas', "Valentine's"]));
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<string, boolean>>(new Map());
  const [scanStatus, setScanStatus] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [totalEpisodes, setTotalEpisodes] = useState<number>(0);
  const [processedEpisodes, setProcessedEpisodes] = useState<number>(0);
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
      const tvLibraries = libs.filter(lib => lib.type === 'show');
      setLibraries(tvLibraries);
      
      // Auto-select default TV library if it exists
      const defaultLib = tvLibraries.find(lib => lib.title === DEFAULT_TV_LIBRARY);
      if (defaultLib) {
        setSelectedLibrary(defaultLib.key);
      } else if (tvLibraries.length === 1) {
        setSelectedLibrary(tvLibraries[0].key);
      }
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

  const analyzeLibrary = async () => {
    if (!selectedLibrary) return;
    
    setStep('analyze');
    setScanProgress(0);
    setScanStatus('Initializing scan...');
    clearActivityLog();
    setCurrentPhase('scanning');
    
    addLogEntry('info', `Starting episode analysis for ${Array.from(selectedHolidays).join(', ')}`, 'scanning');
    console.log('🔍 Starting episode analysis for selected holidays:', Array.from(selectedHolidays));
    
    try {
      // Phase 1: Load episodes from selected library
      setScanStatus('Loading episodes from Plex library...');
      setScanProgress(10);
      setOverallProgress({ current: 1, total: 5, percentage: 20 });
      addLogEntry('info', 'Loading episodes from Plex library...', 'scanning');
      console.log('📚 Loading episodes from library:', selectedLibrary);
      
      const episodes = await getEpisodes(selectedLibrary);
      setTotalEpisodes(episodes.length);
      addLogEntry('success', `Loaded ${episodes.length} episodes from library`, 'scanning');
      console.log(`📺 Loaded ${episodes.length} episodes from library`);
      
      // Phase 2: Get existing playlists
      setScanStatus('Checking existing holiday playlists...');
      setScanProgress(20);
      setOverallProgress({ current: 2, total: 5, percentage: 40 });
      addLogEntry('info', 'Checking for existing holiday playlists...', 'scanning');
      console.log('📋 Checking for existing holiday playlists');
      
      const existingPlaylists = await getPlaylists();
      const playlistMap = new Map<string, PlexEpisode[]>();
      
      let playlistCount = 0;
      for (const playlist of existingPlaylists) {
        if (playlist.title.startsWith('Holiday – ')) {
          console.log(`📝 Found existing playlist: ${playlist.title}`);
          const items = await getPlaylistItems(playlist.key);
          playlistMap.set(playlist.title, items);
          console.log(`  └── Contains ${items.length} episodes`);
          playlistCount++;
          addLogEntry('info', `Found playlist "${playlist.title}" with ${items.length} episodes`, 'scanning');
        }
      }
      addLogEntry('success', `Found ${playlistCount} existing holiday playlists`, 'scanning');
      console.log(`📊 Found ${playlistCount} existing holiday playlists`);
      
      // Phase 3: Wikipedia scraping (if enabled)
      if (useWikipedia) {
        setScanStatus('Scraping Wikipedia for holiday episodes...');
        setScanProgress(30);
        setOverallProgress({ current: 3, total: 5, percentage: 60 });
        addLogEntry('info', 'Scraping Wikipedia for holiday episodes...', 'scanning');
        console.log('🌐 Starting Wikipedia scraping for holiday episodes');
      } else {
        setScanProgress(40);
        setOverallProgress({ current: 3, total: 5, percentage: 60 });
        addLogEntry('info', 'Skipping Wikipedia scraping (disabled)', 'scanning');
        console.log('⏭️ Skipping Wikipedia scraping (disabled)');
      }
      
      // Phase 4: Episode analysis
      setScanStatus('Analyzing episodes for holiday matches...');
      setScanProgress(50);
      setOverallProgress({ current: 4, total: 5, percentage: 80 });
      addLogEntry('info', `Analyzing ${episodes.length} episodes for holiday matches...`, 'scanning');
      console.log('🔍 Starting episode analysis phase');
      console.log(`📺 Analyzing ${episodes.length} episodes for holidays:`, Array.from(selectedHolidays));
      
      // Generate previews for selected holidays only
      const previews = await generatePlaylistPreviews(episodes, playlistMap, useWikipedia, selectedHolidays, confidenceThreshold);
      
      // Phase 5: Complete
      setScanStatus('Analysis complete!');
      setScanProgress(100);
      setOverallProgress({ current: 5, total: 5, percentage: 100 });
      setCurrentPhase(null);
      
      console.log('✅ Analysis complete! Results:');
      let totalEpisodesFound = 0;
      previews.forEach(preview => {
        totalEpisodesFound += preview.episodes.length;
        addLogEntry('success', `${preview.holiday}: ${preview.episodes.length} episodes found (${preview.newCount} new)`, 'scanning');
        console.log(`🎭 ${preview.holiday}: ${preview.episodes.length} episodes found (${preview.newCount} new)`);
        preview.episodes.forEach(ep => {
          console.log(`  📺 ${ep.grandparentTitle} - S${ep.seasonNumber}E${ep.index}: ${ep.title}`);
        });
      });
      addLogEntry('success', `Analysis complete! Found ${totalEpisodesFound} holiday episodes total`, 'scanning');
      
      setPlaylistPreviews(previews);
      setStep('confirm');
    } catch (err) {
      console.error('❌ Failed to analyze library:', err);
      addLogEntry('error', `Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'scanning');
      setScanStatus('Analysis failed');
      setCurrentPhase(null);
    }
  };

  const createSelectedPlaylists = async () => {
    setIsCreatingPlaylists(true);
    setStep('create');
    setCurrentPhase('creating');
    
    const totalSelected = Array.from(selectedEpisodes.values()).filter(Boolean).length;
    addLogEntry('info', `Starting playlist creation with ${totalSelected} selected episodes`, 'creating');
    console.log(`🎵 Starting playlist creation with ${totalSelected} selected episodes`);
    
    try {
      const totalPlaylists = playlistPreviews.filter(preview => 
        preview.episodes.some(ep => selectedEpisodes.get(ep.guid) === true)
      ).length;
      
      let currentPlaylist = 0;
      
      for (const preview of playlistPreviews) {
        // Get only the selected episodes for this holiday
        const selectedEpisodesForHoliday = preview.episodes.filter(ep => 
          selectedEpisodes.get(ep.guid) === true
        );
        
        console.log(`🎭 Processing ${preview.holiday}: ${selectedEpisodesForHoliday.length} selected episodes`);
        
        if (selectedEpisodesForHoliday.length > 0) {
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
            console.log(`  └── Current playlist has ${existingItems.length} episodes`);
            
            await updatePlaylist(existing.key, selectedEpisodesForHoliday, existingItems);
            addLogEntry('success', `Updated playlist "${preview.name}" with ${selectedEpisodesForHoliday.length} episodes`, 'adding');
            console.log(`  ✅ Updated playlist with ${selectedEpisodesForHoliday.length} episodes`);
          } else {
            addLogEntry('info', `Creating new playlist: ${preview.name}`, 'creating');
            console.log(`🆕 Creating new playlist: ${preview.name}`);
            await createPlaylist(preview.name, selectedEpisodesForHoliday);
            addLogEntry('success', `Created playlist "${preview.name}" with ${selectedEpisodesForHoliday.length} episodes`, 'creating');
            console.log(`  ✅ Created playlist with ${selectedEpisodesForHoliday.length} episodes`);
          }
        } else {
          addLogEntry('info', `Skipping ${preview.holiday}: no episodes selected`, 'creating');
          console.log(`⏭️ Skipping ${preview.holiday}: no episodes selected`);
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
    setSelectedEpisodes(new Map());
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
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select TV Library</CardTitle>
          <CardDescription>
            Choose which TV library to scan for holiday episodes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingLibraries ? (
            <div>Loading libraries...</div>
          ) : libraries.length === 0 ? (
            <Alert>
              <AlertDescription>
                No TV libraries found. Make sure you have TV shows in your Plex server.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {libraries.map((library) => (
                <div key={library.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={library.key}
                    checked={selectedLibrary === library.key}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedLibrary(library.key);
                    }}
                  />
                  <Label htmlFor={library.key} className="flex-1">
                    {library.title}
                  </Label>
                </div>
              ))}
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
                Use Wikipedia scraping for better episode detection
              </Label>
            </div>

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
                Lower = more episodes (may include false positives) • Higher = fewer episodes (more accurate)
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
              onClick={analyzeLibrary} 
              disabled={!selectedLibrary || isAnalyzing || isScrapingWiki}
            >
              {isScrapingWiki ? 'Scraping Wikipedia...' : isAnalyzing ? 'Analyzing Episodes...' : 'Analyze Library'}
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
            
            {totalEpisodes > 0 && (
              <div className="text-sm text-gray-600">
                <p>📚 Library: {libraries.find(l => l.key === selectedLibrary)?.title}</p>
                <p>📺 Total episodes: {totalEpisodes.toLocaleString()}</p>
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

    // Initialize selected episodes if not already done
    if (selectedEpisodes.size === 0 && playlistPreviews.length > 0) {
      const newSelected = new Map<string, boolean>();
      playlistPreviews.forEach(preview => {
        preview.episodes.forEach(episode => {
          newSelected.set(episode.guid, true); // Default to selected
        });
      });
      setSelectedEpisodes(newSelected);
    }

    const getSelectedCount = (holiday: Holiday) => {
      const preview = playlistPreviews.find(p => p.holiday === holiday);
      if (!preview) return 0;
      return preview.episodes.filter(ep => selectedEpisodes.get(ep.guid) === true).length;
    };

    const toggleEpisode = (episodeGuid: string) => {
      const newSelected = new Map(selectedEpisodes);
      newSelected.set(episodeGuid, !newSelected.get(episodeGuid));
      setSelectedEpisodes(newSelected);
    };

    const toggleAllForHoliday = (holiday: Holiday, selectAll: boolean) => {
      const preview = playlistPreviews.find(p => p.holiday === holiday);
      if (!preview) return;
      
      const newSelected = new Map(selectedEpisodes);
      preview.episodes.forEach(episode => {
        newSelected.set(episode.guid, selectAll);
      });
      setSelectedEpisodes(newSelected);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Episodes</CardTitle>
          <CardDescription>
            Select which episodes to include in your holiday playlists
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {playlistPreviews.length === 0 ? (
            <Alert>
              <AlertDescription>
                No holiday episodes found in your library. Try enabling Wikipedia scraping or add more TV shows.
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
                    {preview.episodes.map((episode) => (
                      <div key={episode.guid} className="flex items-start space-x-3">
                        <Checkbox
                          id={episode.guid}
                          checked={selectedEpisodes.get(episode.guid) === true}
                          onCheckedChange={() => toggleEpisode(episode.guid)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={episode.guid} 
                            className="cursor-pointer block"
                          >
                            <div className="font-medium">{episode.grandparentTitle}</div>
                            <div className="text-sm text-gray-600">
                              S{episode.seasonNumber}E{episode.index}: {episode.title}
                            </div>
                            {episode.summary && (
                              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {episode.summary}
                              </div>
                            )}
                          </Label>
                        </div>
                      </div>
                    ))}
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
              disabled={Array.from(selectedEpisodes.values()).every(selected => !selected)}
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