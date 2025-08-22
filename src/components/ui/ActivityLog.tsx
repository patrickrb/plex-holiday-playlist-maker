'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  phase?: 'scanning' | 'creating' | 'adding';
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface ActivityLogProps {
  entries: ActivityLogEntry[];
  currentPhase?: 'scanning' | 'creating' | 'adding';
  overallProgress?: {
    current: number;
    total: number;
    percentage: number;
  };
  className?: string;
}

export function ActivityLog({ 
  entries, 
  currentPhase, 
  overallProgress,
  className = "" 
}: ActivityLogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries]);

  const getTypeIcon = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return '🔄';
      default: return '📝';
    }
  };

  const getPhaseLabel = (phase: string | undefined) => {
    switch (phase) {
      case 'scanning': return 'Scanning Episodes';
      case 'creating': return 'Creating Playlists';
      case 'adding': return 'Adding Episodes';
      default: return 'Processing';
    }
  };

  return (
    <div className={`border rounded-lg bg-card ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Activity Log</h3>
          {currentPhase && (
            <span className="text-xs text-muted-foreground">
              {getPhaseLabel(currentPhase)}
            </span>
          )}
        </div>
        
        {overallProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Overall Progress</span>
              <span>{overallProgress.current}/{overallProgress.total}</span>
            </div>
            <Progress value={overallProgress.percentage} className="h-2" />
          </div>
        )}
      </div>
      
      <ScrollArea className="h-64 p-4">
        <div className="space-y-1">
          {entries.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">
              No activity yet...
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 flex-shrink-0">
                  {getTypeIcon(entry.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    {entry.progress && (
                      <span className="text-muted-foreground">
                        ({entry.progress.current}/{entry.progress.total})
                      </span>
                    )}
                  </div>
                  <div className="break-words">{entry.message}</div>
                  {entry.progress && (
                    <Progress 
                      value={entry.progress.percentage} 
                      className="h-1 mt-1" 
                    />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  );
}