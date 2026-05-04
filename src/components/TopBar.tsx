import React, { useState } from 'react';
import { useDAWContext } from '../context/DAWContext';
import { Play, Square, Download, Upload, Cpu, Music, ChevronDown, X, Search, Trash2, Edit2 } from 'lucide-react';

export function TopBar() {
  const { project, setProject, isPlaying, togglePlayback, stopPlayback, setTempo, setTotalSteps, handleGenerateFullSong, handleExtendSong, handleExport, handleImport, newProject, saveManual, getLocalProjects, loadLocalProject, deleteLocalProject, saveToFile, loadFromFile, getBackups, restoreBackup, autoScroll, setAutoScroll } = useDAWContext();
  const [prompt, setPrompt] = useState('A melancholic chiptune song in the style of NieR Automata');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState(project.name || 'Untitled Project');

  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localProjectsData, setLocalProjectsData] = useState<any[]>([]);

  const openLoadModal = () => {
    setLocalProjectsData(getLocalProjects());
    setLoadModalOpen(true);
    setFileMenuOpen(false);
  };

  const handleDeleteLocalProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this project?')) {
      deleteLocalProject(id);
      setLocalProjectsData(getLocalProjects()); // refresh
    }
  };

  const handleSave = () => {
    saveManual(saveName);
    setSaveModalOpen(false);
  };

  return (
    <div className="flex-none h-16 bg-[#D1CEC1] border-b border-[#4E4A42] flex items-center px-6 gap-6 text-[#4E4A42] font-sans shadow-sm select-none">
      {/* branding */}
      <div className="flex items-center gap-4 border-r border-[#4E4A42] pr-6">
        <Music size={24} className="text-[#4E4A42] opacity-80" />
        <div className="flex flex-col justify-center">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase opacity-60 italic leading-none mb-1">Automata System v2.04</span>
          <h1 className="text-2xl font-light tracking-tighter uppercase leading-none">RETROLIA.mid</h1>
        </div>
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button 
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className="flex items-center gap-1 px-3 py-1 bg-transparent border border-[#4E4A42] text-[10px] font-bold tracking-widest uppercase hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
          >
            File <ChevronDown size={10} />
          </button>
          {fileMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#D1CEC1] border border-[#4E4A42] shadow-sm flex flex-col z-50 py-1 text-[10px] font-bold tracking-widest uppercase">
              <button onClick={() => { newProject(); setFileMenuOpen(false); }} className="px-4 py-2 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors">New Project</button>
              <div className="h-px bg-[#4E4A42] opacity-20 my-1" />
              <button onClick={() => { setSaveName(project.name || 'Untitled Project'); setSaveModalOpen(true); setFileMenuOpen(false); }} className="px-4 py-2 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors">Save Locally</button>
              <button onClick={openLoadModal} className="px-4 py-2 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors">Load Locally</button>
              <div className="h-px bg-[#4E4A42] opacity-20 my-1" />
              <button onClick={() => { saveToFile(); setFileMenuOpen(false); }} className="px-4 py-2 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors">Save to File (.json)</button>
              <label className="px-4 py-2 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left cursor-pointer transition-colors block">
                Load from File
                <input type="file" accept=".json" className="hidden" onChange={(e) => { loadFromFile(e); setFileMenuOpen(false); }} />
              </label>
              <div className="h-px bg-[#4E4A42] opacity-20 my-1" />
              <button onClick={() => { setBackupsOpen(!backupsOpen); }} className="px-4 py-2 flex items-center justify-between hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors">
                Restore Backup <ChevronDown size={10} />
              </button>
              {backupsOpen && (
                <div className="bg-[#BAB5A1] flex flex-col border-y border-[#4E4A42]">
                  {getBackups().map((b: any, i: number) => (
                      <button key={b.timestamp} onClick={() => { restoreBackup(b.timestamp); setFileMenuOpen(false); setBackupsOpen(false); }} className="px-4 py-1 hover:bg-[#4E4A42] hover:text-[#D1CEC1] text-left transition-colors border-b border-[#4E4A42]/10 last:border-0 opacity-80">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </button>
                  ))}
                  {getBackups().length === 0 && <span className="px-4 py-1 opacity-50">No backups</span>}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-[#4E4A42] opacity-20 mx-2" />
        <button 
          onClick={togglePlayback}
          className={`w-8 h-8 flex items-center justify-center border border-[#4E4A42] transition-colors ${isPlaying ? 'bg-[#4E4A42] text-[#D1CEC1]' : 'hover:bg-[#4E4A42] hover:text-[#D1CEC1]'}`}
        >
          <Play size={14} fill={isPlaying ? 'currentColor' : 'none'} />
        </button>
        <button 
          onClick={stopPlayback}
          className="w-8 h-8 flex items-center justify-center border border-[#4E4A42] hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
        >
          <Square size={14} fill="currentColor" />
        </button>
        <div className="w-px h-6 bg-[#4E4A42] opacity-20 mx-2" />
        <button 
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-3 py-1 border border-[#4E4A42] text-[10px] font-bold tracking-widest uppercase transition-colors ${autoScroll ? 'bg-[#4E4A42] text-[#D1CEC1]' : 'bg-transparent hover:bg-[#4E4A42] hover:text-[#D1CEC1]'}`}
          title="Toggle Auto-Scroll"
        >
          Snap
        </button>
      </div>

      {/* Tempo & Info */}
      <div className="flex gap-6 text-[11px] font-bold tracking-widest uppercase items-center">
        <div className="flex flex-col items-end">
          <span className="opacity-50">BPM</span>
          <input 
            type="number" 
            value={project.tempo}
            onChange={(e) => setTempo(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
            className="w-12 bg-transparent text-[#4E4A42] text-right outline-none hover:opacity-80 transition-opacity"
          />
        </div>
        <div className="w-px h-8 bg-[#4E4A42] opacity-20" />
        <div className="flex flex-col items-center">
          <span className="opacity-50">Length (Bars)</span>
          <div className="flex items-center gap-2 mt-[2px]">
            <button onClick={() => setTotalSteps(Math.max(16, project.totalSteps - 16))} className="w-4 flex items-center justify-center hover:bg-[#4E4A42] hover:text-[#D1CEC1]">-</button>
            <span>{project.totalSteps / 16}</span>
            <button onClick={() => setTotalSteps(project.totalSteps + 16)} className="w-4 flex items-center justify-center hover:bg-[#4E4A42] hover:text-[#D1CEC1]">+</button>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Generation */}
      <div className="flex items-center gap-3">
        <input 
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe a melancholic song..."
          className="bg-transparent border-b border-[#4E4A42] border-opacity-30 text-[#4E4A42] px-2 py-1 w-64 text-[11px] font-medium tracking-wide outline-none placeholder-[#4E4A42] placeholder-opacity-50 focus:border-opacity-100 transition-colors"
        />
        <button
          onClick={() => handleGenerateFullSong(prompt, 384)}
          className="flex items-center gap-2 bg-[#4E4A42] text-[#D1CEC1] px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-opacity-80 transition-colors whitespace-nowrap shadow-sm"
          title="Generate 24 bars (384 steps) of new song"
        >
          <Cpu size={14} />
          Gen
        </button>
        <button
          onClick={() => handleExtendSong(prompt, 8)}
          className="flex items-center gap-2 bg-[#BAB5A1] border border-[#4E4A42] text-[#4E4A42] px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors whitespace-nowrap shadow-sm"
          title="Extend the current song by 8 bars using AI"
        >
          <Cpu size={14} />
          Extend
        </button>
      </div>

      <div className="h-8 w-px bg-[#4E4A42] opacity-20 mx-2" />

      {/* IO */}
      <div className="flex items-center gap-2">
        <button 
          onClick={handleExport}
          className="bg-[#BAB5A1] border border-[#4E4A42] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
        >
          Export
        </button>
        <label className="bg-[#BAB5A1] border border-[#4E4A42] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase cursor-pointer hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors">
          Import
          <input type="file" accept=".mid,.midi" className="hidden" onChange={handleImport} />
        </label>
      </div>

      {/* Save Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#D1CEC1] border border-[#4E4A42] p-6 shadow-xl w-96 flex flex-col gap-4">
            <h2 className="text-xl font-light tracking-tighter uppercase">Save Project</h2>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold tracking-widest uppercase opacity-70">Project Name</label>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                className="bg-transparent border-b border-[#4E4A42] outline-none py-1 font-bold text-lg"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 border border-[#4E4A42] text-[10px] font-bold tracking-widest uppercase hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-[#4E4A42] text-[#D1CEC1] text-[10px] font-bold tracking-widest uppercase hover:opacity-80 transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {loadModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#D1CEC1] border border-[#4E4A42] p-6 shadow-xl w-[500px] max-h-[80vh] flex flex-col gap-4 flex-shrink">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-light tracking-tighter uppercase">Load Project</h2>
              <button onClick={() => setLoadModalOpen(false)} className="hover:opacity-50"><X size={20} /></button>
            </div>
            
            <div className="flex items-center gap-2 border-b border-[#4E4A42] pb-1 opacity-70 focus-within:opacity-100">
              <Search size={14} />
              <input
                type="text"
                placeholder="SEARCH PROJECTS..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none flex-1 text-[11px] font-bold tracking-widest uppercase"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-[50px]">
              {localProjectsData
                .filter(p => (p.name || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase()))
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-3 border border-[#4E4A42] bg-[#BAB5A1] group hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors cursor-pointer" onClick={() => { loadLocalProject(p.id); setLoadModalOpen(false); }}>
                    <div className="flex flex-col">
                      <span className="font-bold tracking-wider">{p.name || 'Untitled'}</span>
                      <span className="text-[10px] opacity-70 font-mono mt-1">{new Date(p.updatedAt).toLocaleString()} • {p.tracks?.length || 0} Tracks</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteLocalProject(e, p.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 text-[#D1CEC1] transition-all rounded"
                      title="Delete Project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              {localProjectsData.length === 0 && (
                 <div className="text-center py-8 opacity-50 text-[10px] font-bold tracking-widest uppercase">No projects found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
