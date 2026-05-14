"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Edit3, CheckCircle, FileText, Video as VideoIcon, ListVideo, PlayCircle, Download } from "lucide-react";
import YouTube from "react-youtube";


const getYouTubeID = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
};

const getDrivePreviewUrl = (url: string) => {
  if (!url) return "";
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return url;
};

// FORCE DIRECT DOWNLOAD FROM GOOGLE DRIVE INSTEAD OF OPENING NEW TAB
const getDriveDownloadUrl = (url: string) => {
  if (!url) return "";
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
};

export default function StudyRoom() {
  const { id } = useParams();
  const router = useRouter();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showSheets, setShowSheets] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  
  // Mobile Capsule & Playlist States
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [mobileTab, setMobileTab] = useState<'none' | 'notes' | 'sheets' | 'playlist'>('none');
  
  const playerRef = useRef<any>(null);
  const notesRef = useRef<string>("");

  useEffect(() => {
    async function fetchVideo() {
      const { data, error } = await supabase.from("videos").select("*").eq("id", id).single();
      if (!error && data) {
        // ALWAYS use the DB numeric ID to prevent Next.js URL array/object mismatches!
        const dbKey = String(data.id); 
        const stored = JSON.parse(localStorage.getItem("hsc_user_data") || "{}");
        const userV = stored[dbKey] || {};
        
        setVideo({ 
          ...data, 
          status: userV.status || "New",
          progress: userV.progress || 0,
          last_position: userV.last_position || 0
        });
        setNotes(userV.notes || "");
        
        if (data.sheets && data.sheets.length > 0) {
          setActiveSheet(data.sheets[0].url);
        }

        // Fetch all videos in this specific chapter for the Mobile Playlist
        const { data: related } = await supabase.from("videos")
          .select("id, title, duration, status, progress")
          .eq("subject", data.subject)
          .eq("chapter", data.chapter)
          .order("id", { ascending: true });
          
        if (related) setRelatedVideos(related);
      }
      setLoading(false);
    }
    fetchVideo();
  }, [id]);

  // Background Auto-Save Timer (Progress & Notes) to LOCAL STORAGE
  useEffect(() => {
    const interval = setInterval(() => {
      // Defensive check: Ensure player API is fully loaded before trying to read it
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && video && video.id) {
        try {
          // YouTube methods are synchronous! Removing 'await' stops the silent crashes.
          const currentTime = playerRef.current.getCurrentTime() || 0;
          const duration = playerRef.current.getDuration() || 0;
          
          const dbKey = String(video.id); // Bulletproof Save Key
          const currentData = JSON.parse(localStorage.getItem("hsc_user_data") || "{}");
          const currentV = currentData[dbKey] || {};
          
          let status = currentV.status || video.status || "New";
          let finalProgress = currentV.progress || video.progress || 0;

          if (duration > 0 && status !== "Watched") {
            const progressPct = Math.floor((currentTime / duration) * 100);
            finalProgress = Math.max(finalProgress, progressPct > 95 ? 100 : progressPct);
            status = finalProgress === 100 ? "Watched" : "Watching";
          }

          currentData[dbKey] = {
            ...currentV,
            last_position: Math.floor(currentTime),
            progress: status === "Watched" ? 100 : finalProgress,
            status: status,
            notes: notesRef.current
          };
          localStorage.setItem("hsc_user_data", JSON.stringify(currentData));
        } catch (e) {}
      }
    }, 5000); 

    return () => clearInterval(interval);
  }, [video]); // Safely depends only on video state

  // TOGGLE WATCHED STATUS MANUALLY
  function markWatched() {
    if (!video || !video.id) return;
    
    const dbKey = String(video.id); // Bulletproof Save Key
    const currentData = JSON.parse(localStorage.getItem("hsc_user_data") || "{}");
    const currentV = currentData[dbKey] || {};
    
    const isCurrentlyWatched = video.status === "Watched";
    const newStatus = isCurrentlyWatched ? "Watching" : "Watched";
    let newProgress = 100;

    if (isCurrentlyWatched) {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const currentTime = playerRef.current.getCurrentTime() || 0;
          const duration = playerRef.current.getDuration() || 0;
          newProgress = duration > 0 ? Math.floor((currentTime / duration) * 100) : 0;
        } catch(e) { newProgress = 0; }
      } else {
        newProgress = 0;
      }
    }

    currentData[dbKey] = { ...currentV, status: newStatus, progress: newProgress };
    localStorage.setItem("hsc_user_data", JSON.stringify(currentData));
    setVideo({ ...video, status: newStatus, progress: newProgress });
    
    if (!isCurrentlyWatched) {
      window.dispatchEvent(new CustomEvent("classWatched", { detail: { chapter: video.chapter || "this chapter" } }));
    }
  }

  const togglePanel = (panel: 'notes' | 'sheets') => {
    if (panel === 'notes') {
      setShowNotes(!showNotes);
      if (!showNotes) setShowSheets(false);
    } else {
      setShowSheets(!showSheets);
      if (!showSheets) setShowNotes(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-indigo-400 animate-pulse">Loading Study Room...</div>;
  if (!video) return <div className="h-screen flex items-center justify-center text-rose-400">Class not found!</div>;

  const ytId = getYouTubeID(video.url);
  const showSidebar = showNotes || showSheets;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col animate-fade-in">
      {/* Top Header */}
      <div className="h-16 border-b border-white/10 glass-panel flex justify-between items-center px-4 sm:px-6 shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/10 jelly flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h3 className="font-medium text-sm sm:text-lg truncate max-w-[150px] sm:max-w-md lg:max-w-xl text-gray-200">{video.title}</h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Smart Toggles (Hidden on Mobile, handled by Capsule below) */}
          <div className="hidden md:flex items-center gap-2 mr-2 bg-black/20 px-3 py-1.5 rounded-2xl border border-white/5">
            <button onClick={() => togglePanel('notes')} className={`p-2 rounded-xl border transition jelly ${showNotes ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-transparent text-gray-400 hover:text-white'}`} title="Notes">
              <Edit3 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/10"></div>
            <button onClick={() => togglePanel('sheets')} className={`p-2 rounded-xl border transition jelly ${showSheets ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300' : 'bg-transparent border-transparent text-gray-400 hover:text-white'}`} title="Lecture Sheets">
              <FileText className="w-4 h-4" />
            </button>
          </div>
          
          <button onClick={markWatched} className={`text-xs px-4 py-2 rounded-xl transition flex items-center gap-2 font-medium jelly ${video.status === 'Watched' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/10 hover:bg-emerald-500/20 border border-white/20 hover:border-emerald-500/50 text-gray-300'}`}>
            <CheckCircle className="w-4 h-4" /> <span className="hidden sm:inline">{video.status === 'Watched' ? 'Watched' : 'Mark Watched'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Lag Optimizer */}
      <style>{`
        @media (max-width: 768px) {
          .glass-panel { backdrop-filter: blur(8px) !important; background-color: rgba(15, 20, 30, 0.95) !important; }
        }
      `}</style>

      {/* Main Content Area (Conditional gap prevents spacing issues when closed) */}
      <div className={`flex-grow flex flex-col lg:flex-row p-2 sm:p-4 overflow-y-auto overflow-x-hidden relative z-10 w-full h-full ${showSidebar ? 'gap-4' : 'gap-0'}`}>
        
        {/* LEFT COLUMN: Video + Mobile Controls */}
        <div className={`flex flex-col gap-4 transition-all duration-300 ease-in-out ${showSidebar ? 'w-full lg:w-[60%] shrink-0' : 'w-full flex-grow'}`}>
          
          {/* VIDEO PLAYER (Dynamic: 16:9 on Mobile, Full Height Flex on PC) */}
          <div className={`w-full rounded-2xl overflow-hidden glass-panel border border-white/10 relative shadow-2xl bg-black transition-all duration-300 ${showSidebar ? 'max-lg:aspect-video lg:flex-grow' : 'flex-grow min-h-[40vh] max-lg:aspect-video'}`}>
            {ytId ? (
              <YouTube 
                videoId={ytId} 
                opts={{ width: '100%', height: '100%', playerVars: { autoplay: 1, modestbranding: 1, rel: 0, start: video.last_position || 0 } }}
                className="absolute inset-0 w-full h-full"
                onReady={(e) => { playerRef.current = e.target; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">Invalid Link</div>
            )}
          </div>

          {/* MOBILE ONLY: GLASS CAPSULE TAB BAR */}
          <div className="lg:hidden flex p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg shrink-0 gap-1">
            <button onClick={() => setMobileTab(mobileTab === 'playlist' ? 'none' : 'playlist')} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition jelly flex justify-center items-center gap-1.5 ${mobileTab === 'playlist' ? 'bg-white/15 text-white shadow-sm' : 'text-gray-400'}`}><ListVideo className="w-3.5 h-3.5"/> Chapter</button>
            <button onClick={() => setMobileTab(mobileTab === 'notes' ? 'none' : 'notes')} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition jelly flex justify-center items-center gap-1.5 ${mobileTab === 'notes' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-gray-400'}`}><Edit3 className="w-3.5 h-3.5"/> Notes</button>
            <button onClick={() => setMobileTab(mobileTab === 'sheets' ? 'none' : 'sheets')} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition jelly flex justify-center items-center gap-1.5 ${mobileTab === 'sheets' ? 'bg-fuchsia-500/20 text-fuchsia-300 shadow-sm' : 'text-gray-400'}`}><FileText className="w-3.5 h-3.5"/> Sheets</button>
          </div>

          {/* MOBILE ONLY: TAB CONTENT AREA (Always in DOM to preserve state) */}
          <div className={`lg:hidden flex flex-col glass-panel border-white/10 rounded-2xl shadow-xl overflow-hidden transition-all duration-300 shrink-0 ${mobileTab !== 'none' ? 'opacity-100 border min-h-[40vh] mt-2' : 'h-0 min-h-0 opacity-0 pointer-events-none border-0'}`}>
              
              {/* Playlist Tab */}
              <div className={`p-4 flex-col gap-3 overflow-y-auto max-h-[50vh] ${mobileTab === 'playlist' ? 'flex' : 'hidden'}`}>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{video.chapter} Videos</h4>
                {relatedVideos.map(v => (
                  <div key={v.id} onClick={() => router.push(`/study/${v.id}`)} className={`p-3 rounded-xl border flex items-center gap-3 transition jelly cursor-pointer ${v.id === video.id ? 'bg-white/10 border-white/20 shadow-md' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                    <PlayCircle className={`w-5 h-5 shrink-0 ${v.id === video.id ? 'text-indigo-400' : 'text-gray-500'}`} />
                    <div className="flex-grow overflow-hidden">
                      <p className={`text-sm font-medium truncate ${v.id === video.id ? 'text-white' : 'text-gray-300'}`}>{v.title}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Notes Tab */}
              <div className={`flex-col p-4 h-full ${mobileTab === 'notes' ? 'flex' : 'hidden'}`}>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Type notes here... (Auto-saves)" 
                  className="flex-grow w-full min-h-[30vh] bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition resize-none font-mono text-sm shadow-inner"
                ></textarea>
              </div>

             {/* Sheets Tab */}
              <div className={`flex-col p-4 h-full gap-3 ${mobileTab === 'sheets' ? 'flex' : 'hidden'}`}>
                {video.sheets && video.sheets.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center shrink-0">
                      <div className="flex flex-wrap gap-2">
                        {video.sheets.map((sheet: any, idx: number) => (
                          <button key={idx} onClick={() => setActiveSheet(sheet.url)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition jelly ${activeSheet === sheet.url ? 'bg-fuchsia-500 text-white border-fuchsia-400' : 'bg-black/40 text-gray-400 border-white/10'}`}>
                            {sheet.title || `Sheet ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                      {activeSheet && (
                        <a href={getDriveDownloadUrl(activeSheet)} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded-xl text-xs font-bold transition jelly flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-500/30" title="Direct Download">
                          <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Download</span>
                        </a>
                      )}
                    </div>
                    <div className="flex-grow w-full min-h-[40vh] rounded-xl overflow-hidden border border-white/10 bg-white relative">
                      {/* MAP ALL IFRAMES IN BACKGROUND TO PRESERVE SCROLL PROGRESS */}
                      {video.sheets.map((sheet: any, idx: number) => (
                        <iframe 
                          key={idx} 
                          className={`w-full h-full absolute inset-0 transition-opacity duration-300 ${activeSheet === sheet.url ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`} 
                          src={getDrivePreviewUrl(sheet.url)}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-gray-500 p-8"><p className="text-sm">No lecture sheets available.</p></div>
                )}
              </div>
          </div>
        </div>

        {/* RIGHT COLUMN (DESKTOP SIDEBAR - Always in DOM, transitions width to avoid bounce) */}
        <div className={`hidden lg:flex flex-col transition-all duration-300 ease-in-out shrink-0 border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel ${showSidebar ? 'w-[40%] opacity-100 border' : 'w-0 opacity-0 pointer-events-none border-0'}`}>
          
          {/* Notes Container */}
          <div className={`flex-1 flex-col p-4 h-full ${showNotes ? 'flex' : 'hidden'}`}>
            <div className="flex items-center gap-2 mb-3 text-indigo-400 font-medium text-sm"><Edit3 className="w-4 h-4" /> My Notes</div>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Type notes here... (Auto-saves automatically)" 
              className="flex-grow w-full h-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition resize-none font-mono text-sm shadow-inner"
            ></textarea>
          </div>

          {/* Sheets Container */}
          <div className={`flex-1 flex-col p-4 h-full gap-3 ${showSheets ? 'flex' : 'hidden'}`}>
            <div className="flex justify-between items-center shrink-0">
              <div className="flex flex-wrap gap-2">
                {video?.sheets?.map((sheet: any, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveSheet(sheet.url)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-300 jelly ${activeSheet === sheet.url ? 'bg-fuchsia-500 text-white shadow-[0_0_10px_rgba(217,70,239,0.5)] border-fuchsia-400' : 'bg-black/40 text-gray-400 hover:text-white border-white/10 hover:bg-white/10'}`}
                  >
                    <FileText className="w-3 h-3 inline mr-1" /> {sheet.title || `Sheet ${idx + 1}`}
                  </button>
                ))}
              </div>
              {activeSheet && (
                <a href={getDriveDownloadUrl(activeSheet)} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded-xl text-xs font-bold transition jelly flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:bg-indigo-500/30" title="Direct Download">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              )}
            </div>
            
            <div className="flex-grow w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-white shadow-inner relative">
              {/* MAP ALL IFRAMES IN BACKGROUND TO PRESERVE SCROLL PROGRESS */}
              {video?.sheets?.map((sheet: any, idx: number) => (
                <iframe 
                  key={idx} 
                  className={`w-full h-full absolute inset-0 transition-opacity duration-300 ${activeSheet === sheet.url ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`} 
                  src={getDrivePreviewUrl(sheet.url)}
                />
              ))}
              {!activeSheet && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900 z-0">Select a sheet to view</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}