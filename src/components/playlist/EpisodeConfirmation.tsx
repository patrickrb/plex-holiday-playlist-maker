'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlaylistPreview, PlexMedia, isPlexEpisode } from '@/types';

interface MediaConfirmationProps {
  playlistPreviews: PlaylistPreview[];
  onConfirm: (selectedMedia: Map<string, PlexMedia[]>) => void;
  onCancel: () => void;
}

export function MediaConfirmation({ 
  playlistPreviews, 
  onConfirm, 
  onCancel 
}: MediaConfirmationProps) {
  const [selectedMedia, setSelectedMedia] = useState<Map<string, Set<string>>>(
    new Map(playlistPreviews.map(preview => [
      preview.holiday,
      new Set([...preview.episodes, ...preview.movies].map(item => item.guid))
    ]))
  );

  const toggleMedia = (holiday: string, mediaGuid: string) => {
    setSelectedMedia(prev => {
      const newMap = new Map(prev);
      const holidaySet = new Set(newMap.get(holiday) || []);
      
      if (holidaySet.has(mediaGuid)) {
        holidaySet.delete(mediaGuid);
      } else {
        holidaySet.add(mediaGuid);
      }
      
      newMap.set(holiday, holidaySet);
      return newMap;
    });
  };

  const toggleAllForHoliday = (holiday: string, allMedia: PlexMedia[]) => {
    setSelectedMedia(prev => {
      const newMap = new Map(prev);
      const holidaySet = new Set(newMap.get(holiday) || []);
      const allSelected = allMedia.every(item => holidaySet.has(item.guid));
      
      if (allSelected) {
        // Deselect all
        newMap.set(holiday, new Set());
      } else {
        // Select all
        newMap.set(holiday, new Set(allMedia.map(item => item.guid)));
      }
      
      return newMap;
    });
  };

  const handleConfirm = () => {
    const result = new Map<string, PlexMedia[]>();
    
    for (const preview of playlistPreviews) {
      const selected = selectedMedia.get(preview.holiday) || new Set();
      const allMedia = [...preview.episodes, ...preview.movies];
      const filteredMedia = allMedia.filter(item => selected.has(item.guid));
      if (filteredMedia.length > 0) {
        result.set(preview.holiday, filteredMedia);
      }
    }
    
    onConfirm(result);
  };

  const formatMedia = (media: PlexMedia) => {
    if (isPlexEpisode(media)) {
      return `${media.grandparentTitle} – S${media.seasonNumber.toString().padStart(2, '0')}E${media.index.toString().padStart(2, '0')} – ${media.title}`;
    } else {
      return `${media.title}${media.year ? ` (${media.year})` : ''}`;
    }
  };

  const getTotalSelected = () => {
    return Array.from(selectedMedia.values())
      .reduce((total, set) => total + set.size, 0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Holiday Media</CardTitle>
          <CardDescription>
            Review and select which episodes and movies to include in your holiday playlists.
            Uncheck any items you don&apos;t want to include.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Badge variant="outline">
              {getTotalSelected()} items selected
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
        const holidaySelected = selectedMedia.get(preview.holiday) || new Set();
        const allMedia = [...preview.episodes, ...preview.movies];
        const allSelected = allMedia.every(item => holidaySelected.has(item.guid));
        const someSelected = allMedia.some(item => holidaySelected.has(item.guid));

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
                    onCheckedChange={() => toggleAllForHoliday(preview.holiday, allMedia)}
                  />
                  {preview.name}
                </CardTitle>
                <Badge variant={holidaySelected.size > 0 ? "default" : "secondary"}>
                  {holidaySelected.size}/{allMedia.length} selected
                </Badge>
              </div>
              <CardDescription>
                {(preview.existingCount || 0) > 0 && (
                  <span className="text-blue-600">
                    {preview.existingCount} items already in playlist. 
                  </span>
                )}{' '}
                Found {preview.episodes.length} episodes and {preview.movies.length} movies for {preview.holiday}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-16">Type</TableHead>
                      <TableHead className="w-20">Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMedia.map((item) => (
                      <TableRow key={item.guid}>
                        <TableCell>
                          <Checkbox
                            checked={holidaySelected.has(item.guid)}
                            onCheckedChange={() => toggleMedia(preview.holiday, item.guid)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {formatMedia(item)}
                            </div>
                            {item.summary && (
                              <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {item.summary}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {isPlexEpisode(item) ? '📺 TV' : '🎬 Movie'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {item.year || 'N/A'}
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
          Create {getTotalSelected()} Selected Items in Playlists
        </Button>
      </div>
    </div>
  );
}