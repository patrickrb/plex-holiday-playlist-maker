'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlaylistPreview, PlexEpisode } from '@/types';

interface EpisodeConfirmationProps {
  playlistPreviews: PlaylistPreview[];
  onConfirm: (selectedEpisodes: Map<string, PlexEpisode[]>) => void;
  onCancel: () => void;
}

export function EpisodeConfirmation({ 
  playlistPreviews, 
  onConfirm, 
  onCancel 
}: EpisodeConfirmationProps) {
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<string, Set<string>>>(
    new Map(playlistPreviews.map(preview => [
      preview.holiday,
      new Set(preview.episodes.map(ep => ep.guid))
    ]))
  );

  const toggleEpisode = (holiday: string, episodeGuid: string) => {
    setSelectedEpisodes(prev => {
      const newMap = new Map(prev);
      const holidaySet = new Set(newMap.get(holiday) || []);
      
      if (holidaySet.has(episodeGuid)) {
        holidaySet.delete(episodeGuid);
      } else {
        holidaySet.add(episodeGuid);
      }
      
      newMap.set(holiday, holidaySet);
      return newMap;
    });
  };

  const toggleAllForHoliday = (holiday: string, episodes: PlexEpisode[]) => {
    setSelectedEpisodes(prev => {
      const newMap = new Map(prev);
      const holidaySet = new Set(newMap.get(holiday) || []);
      const allSelected = episodes.every(ep => holidaySet.has(ep.guid));
      
      if (allSelected) {
        // Deselect all
        newMap.set(holiday, new Set());
      } else {
        // Select all
        newMap.set(holiday, new Set(episodes.map(ep => ep.guid)));
      }
      
      return newMap;
    });
  };

  const handleConfirm = () => {
    const result = new Map<string, PlexEpisode[]>();
    
    for (const preview of playlistPreviews) {
      const selected = selectedEpisodes.get(preview.holiday) || new Set();
      const filteredEpisodes = preview.episodes.filter(ep => selected.has(ep.guid));
      if (filteredEpisodes.length > 0) {
        result.set(preview.holiday, filteredEpisodes);
      }
    }
    
    onConfirm(result);
  };

  const formatEpisode = (episode: PlexEpisode) => {
    return `${episode.grandparentTitle} – S${episode.seasonNumber.toString().padStart(2, '0')}E${episode.index.toString().padStart(2, '0')} – ${episode.title}`;
  };

  const getTotalSelected = () => {
    return Array.from(selectedEpisodes.values())
      .reduce((total, set) => total + set.size, 0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Holiday Episodes</CardTitle>
          <CardDescription>
            Review and select which episodes to include in your holiday playlists.
            Uncheck any episodes you don&apos;t want to include.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Badge variant="outline">
              {getTotalSelected()} episodes selected
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={getTotalSelected() === 0}
              >
                Create Playlists
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {playlistPreviews.map((preview) => {
        const holidaySelected = selectedEpisodes.get(preview.holiday) || new Set();
        const allSelected = preview.episodes.every(ep => holidaySelected.has(ep.guid));
        const someSelected = preview.episodes.some(ep => holidaySelected.has(ep.guid));

        return (
          <Card key={preview.holiday}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    ref={(ref) => {
                      if (ref && 'indeterminate' in ref) {
                        (ref as HTMLInputElement).indeterminate = someSelected && !allSelected;
                      }
                    }}
                    onCheckedChange={() => toggleAllForHoliday(preview.holiday, preview.episodes)}
                  />
                  {preview.name}
                </CardTitle>
                <Badge variant={holidaySelected.size > 0 ? "default" : "secondary"}>
                  {holidaySelected.size}/{preview.episodes.length} selected
                </Badge>
              </div>
              <CardDescription>
                {(preview.existingCount || 0) > 0 && (
                  <span className="text-blue-600">
                    {preview.existingCount} episodes already in playlist. 
                  </span>
                )}{' '}
                Found {preview.episodes.length} total episodes for {preview.holiday}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Episode</TableHead>
                      <TableHead className="w-20">Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.episodes.map((episode) => (
                      <TableRow key={episode.guid}>
                        <TableCell>
                          <Checkbox
                            checked={holidaySelected.has(episode.guid)}
                            onCheckedChange={() => toggleEpisode(preview.holiday, episode.guid)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {formatEpisode(episode)}
                            </div>
                            {episode.summary && (
                              <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {episode.summary}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {episode.year || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-center">
        <Button 
          onClick={handleConfirm}
          disabled={getTotalSelected() === 0}
          size="lg"
        >
          Create {getTotalSelected()} Selected Episodes in Playlists
        </Button>
      </div>
    </div>
  );
}