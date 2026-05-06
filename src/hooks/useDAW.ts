import React, { useState, useCallback, useEffect } from 'react';
import { Project, Track, NoteEvent, InstrumentType } from '../types';
import { INITIAL_PROJECT } from '../constants';
import { AudioManager } from '../lib/audio';
import { generateFullSong, generateTrack, generateSongExtension } from '../lib/gemini';
import { importMidi, exportMidi } from '../lib/midi';

export function useDAW() {
  const AUTOSAVE_KEY = 'retrolia_autosave';
  const MANUAL_SAVE_KEY = 'retrolia_user_save';
  const BACKUPS_KEY = 'retrolia_backups';

  const [project, setProject] = useState<Project>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_PROJECT;
  });
  
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(project.tracks[0]?.id || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Sync to AudioManager whenever project structure affecting sound changes
  // and auto-save
  useEffect(() => {
    AudioManager.syncProject(project);
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  }, [project]);

  // Periodic backup every 10 minutes
  useEffect(() => {
    const BACKUP_INTERVAL = 10 * 60 * 1000;
    const interval = setInterval(() => {
      try {
        const backupsStr = localStorage.getItem(BACKUPS_KEY) || '[]';
        let backups: any[] = JSON.parse(backupsStr);
        if (!Array.isArray(backups)) backups = [];
        
        backups.push({
          timestamp: Date.now(),
          project: project
        });
        
        // Keep up to 10 backups
        if (backups.length > 10) {
          backups = backups.slice(backups.length - 10);
        }
        
        localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
      } catch (e) {
        console.error('Failed to create backup', e);
      }
    }, BACKUP_INTERVAL);
    
    return () => clearInterval(interval);
  }, [project]);

  const saveManual = (name: string) => {
    try {
      const LOCAL_KEY = 'retrolia_local_projects';
      const existingStr = localStorage.getItem(LOCAL_KEY) || '[]';
      let existing: any[] = JSON.parse(existingStr);
      if (!Array.isArray(existing)) existing = [];
      
      const projectId = project.id || 'proj_' + Date.now();
      const updatedProject = { ...project, id: projectId, name: name };
      
      const index = existing.findIndex((p: any) => p.id === projectId);
      if (index >= 0) {
        existing[index] = { ...updatedProject, updatedAt: Date.now() };
      } else {
        existing.push({ ...updatedProject, updatedAt: Date.now() });
      }
      
      localStorage.setItem(LOCAL_KEY, JSON.stringify(existing));
      setProject(updatedProject); // Update current project with name/id
    } catch (e) {
      console.error(e);
      alert('Failed to save project locally');
    }
  };

  const getLocalProjects = useCallback(() => {
    try {
      const LOCAL_KEY = 'retrolia_local_projects';
      const existingStr = localStorage.getItem(LOCAL_KEY) || '[]';
      return JSON.parse(existingStr);
    } catch { return []; }
  }, []);

  const loadLocalProject = (id: string) => {
    try {
      const projects = getLocalProjects();
      const target = projects.find((p: any) => p.id === id);
      if (target) {
        stopPlayback();
        setProject(target);
        setSelectedTrackId(target.tracks[0]?.id || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteLocalProject = (id: string) => {
    try {
      const LOCAL_KEY = 'retrolia_local_projects';
      const projects = getLocalProjects();
      const updated = projects.filter((p: any) => p.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const newProject = () => {
    stopPlayback();
    const proj: Project = { tempo: 120, totalSteps: 64, tracks: [] };
    setProject(proj);
    setSelectedTrackId(null);
  };

  const getBackups = useCallback(() => {
    try {
      const backupsStr = localStorage.getItem(BACKUPS_KEY) || '[]';
      return JSON.parse(backupsStr);
    } catch { return []; }
  }, []);

  const restoreBackup = (backupId: number) => {
    const backups = getBackups();
    const target = backups.find((b: any) => b.timestamp === backupId);
    if (target) {
        stopPlayback();
        setProject(target.project);
        setSelectedTrackId(target.project.tracks[0]?.id || null);
    }
  };

  const saveToFile = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
      const el = document.createElement('a');
      el.setAttribute("href", dataStr);
      el.setAttribute("download", `retrolia_project_${Date.now()}.json`);
      document.body.appendChild(el);
      el.click();
      el.remove();
  };

  const loadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const res = e.target?.result as string;
              if (res) {
                  const proj = JSON.parse(res);
                  if (proj && proj.tracks) {
                      stopPlayback();
                      setProject(proj);
                      setSelectedTrackId(proj.tracks[0]?.id || null);
                  }
              }
          } catch(err) { alert('Invalid project file'); }
      };
      reader.readAsText(file);
      event.target.value = '';
  };

  const togglePlayback = async () => {
    await AudioManager.init(project);
    const state = AudioManager.togglePlayback();
    setIsPlaying(state === 'started');
  };

  const stopPlayback = () => {
    AudioManager.stopPlayback();
    setIsPlaying(false);
  };

  const seek = (step: number) => {
    AudioManager.seek(step);
  };

  const setTempo = (tempo: number) => {
    setProject(p => ({ ...p, tempo }));
    AudioManager.setTempo(tempo);
  };

  const setTotalSteps = (steps: number) => {
    setProject(p => ({ ...p, totalSteps: Math.max(16, steps) }));
  };

  const addTrack = () => {
    const newTrack: Track = {
      id: 'trk_new_' + Date.now(),
      name: 'New Track',
      instrument: 'square',
      color: '#4E4A42', // Editorial theme default color
      muted: false,
      solo: false,
      volume: -6,
      notes: []
    };
    setProject(p => ({ ...p, tracks: [...p.tracks, newTrack] }));
    setSelectedTrackId(newTrack.id);
  };

  const deleteTrack = (id: string) => {
    setProject(p => {
      const remaining = p.tracks.filter(t => t.id !== id);
      if (selectedTrackId === id) {
        setSelectedTrackId(remaining.length > 0 ? remaining[0].id : null);
      }
      return { ...p, tracks: remaining };
    });
  };
  
  const clearTrackNotes = (id: string) => {
    setProject(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === id ? { ...t, notes: [] } : t)
    }));
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setProject(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const addNote = (trackId: string, note: Omit<NoteEvent, 'id'>) => {
    setProject(p => ({
      ...p,
      tracks: p.tracks.map(t => {
        if (t.id === trackId) {
          return {
            ...t,
            notes: [...t.notes, { ...note, id: 'n_' + Date.now() + Math.random() }]
          };
        }
        return t;
      })
    }));
  };

  const toggleMute = (id: string) => {
    updateTrack(id, { muted: !project.tracks.find(t => t.id === id)?.muted });
  };

  const toggleSolo = (id: string) => {
    updateTrack(id, { solo: !project.tracks.find(t => t.id === id)?.solo });
  };

  const handleGenerateFullSong = async (prompt: string, steps: number = 384) => {
    try {
      setIsGenerating(true);
      stopPlayback();
      const newProj = await generateFullSong(prompt, steps, project.tempo);
      setProject(newProj);
      if (newProj.tracks.length > 0) setSelectedTrackId(newProj.tracks[0].id);
    } catch (e) {
      console.error(e);
      alert('Failed to generate full song. See console.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtendSong = async (prompt: string, numBars: number = 8) => {
    try {
      setIsGenerating(true);
      stopPlayback();
      const addedSteps = numBars * 16;
      const newProj = await generateSongExtension(prompt, project, addedSteps);
      setProject(newProj);
    } catch(e) {
      console.error(e);
      alert('Failed to extend song.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTrack = async (prompt: string) => {
    try {
      setIsGenerating(true);
      const newTrack = await generateTrack(prompt, project.totalSteps, project);
      setProject(p => ({ ...p, tracks: [...p.tracks, newTrack] }));
      setSelectedTrackId(newTrack.id);
    } catch (e) {
      console.error(e);
      alert('Failed to generate track.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    exportMidi(project);
  };

  const handleImport = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      stopPlayback();
      const proj = await importMidi(file);
      setProject(proj);
      setSelectedTrackId(proj.tracks[0]?.id || null);
    } catch (err) {
      console.error(err);
      alert('Failed to import MIDI');
    }
    e.target.value = ''; // clear input
  };

  return {
    project,
    setProject,
    selectedTrackId,
    setSelectedTrackId,
    isPlaying,
    isGenerating,
    autoScroll,
    setAutoScroll,
    togglePlayback,
    stopPlayback,
    seek,
    setTempo,
    setTotalSteps,
    newProject,
    saveManual,
    getLocalProjects,
    loadLocalProject,
    deleteLocalProject,
    saveToFile,
    loadFromFile,
    getBackups,
    restoreBackup,
    addTrack,
    deleteTrack,
    clearTrackNotes,
    updateTrack,
    addNote,
    toggleMute,
    toggleSolo,
    handleGenerateFullSong,
    handleExtendSong,
    handleGenerateTrack,
    handleExport,
    handleImport
  };
}
