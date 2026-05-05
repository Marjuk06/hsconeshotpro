"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { 
  Play, Clock, Sparkles, CheckCircle, Heart, MonitorPlay, 
  ArrowRight, Library, Target, FolderOpen, ChevronRight, Share2, BookOpen, Search
} from "lucide-react";

const getYouTubeID = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function VideoGrid() {
  const router = useRouter();
  const [videos, setVideos] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [navLoaded, setNavLoaded] = useState(false);
  
  // Navigation & Search State
  const [viewLevel, setViewLevel] = useState<"subjects" | "papers" | "chapters" | "videos">("subjects");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [activePaper, setActivePaper] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchVideos = async () => {
    const { data, error } = await supabase.from("videos").select("*").order("id", { ascending: false });
    if (!error && data) setVideos(data);
    setLoading(false);
  };

 useEffect(() => {
    fetchVideos();
    
    // Fetch the standardized hierarchy layout globally from the cloud config table
    const loadCloudHierarchy = async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("config_json")
        .eq("id", "global_hierarchy")
        .single();
      
      if (!error && data?.config_json) {
        setHierarchy(data.config_json);
      }
    };
    loadCloudHierarchy();
    // Restore Navigation State (Permanent Local Memory)
    const savedState = JSON.parse(localStorage.getItem("hsc_nav_state") || "null");
    if (savedState) {
      setViewLevel(savedState.viewLevel || "subjects");
      setActiveSubject(savedState.activeSubject);
      setActivePaper(savedState.activePaper);
      setActiveChapter(savedState.activeChapter);
    }
    setNavLoaded(true);

    // Global Search Interceptor
    const handleSearch = (e: any) => setSearchQuery(e.detail || "");
    window.addEventListener("globalSearch", handleSearch as EventListener);
    window.addEventListener("classAdded", fetchVideos);

    return () => {
      window.removeEventListener("classAdded", fetchVideos);
      window.removeEventListener("globalSearch", handleSearch as EventListener);
    };
  }, []);

  // Save State Automatically
  useEffect(() => {
    if (navLoaded) {
      localStorage.setItem("hsc_nav_state", JSON.stringify({viewLevel, activeSubject, activePaper, activeChapter}));
    }
  }, [viewLevel, activeSubject, activePaper, activeChapter, navLoaded]);

  const toggleFavorite = async (e: React.MouseEvent, video: any) => {
    e.stopPropagation();
    const newStatus = !video.is_favorite;
    setVideos(videos.map(v => v.id === video.id ? { ...v, is_favorite: newStatus } : v));
    await supabase.from("videos").update({ is_favorite: newStatus }).eq("id", video.id);
    toast.success(newStatus ? "Added to Favorites ❤️" : "Removed from Favorites");
  };

  const handleShare = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/study/${id}`);
    toast.success("Class link copied to clipboard! 🔗");
  };

  if (loading || !navLoaded) return <div className="text-center text-indigo-400 py-20 animate-pulse">Loading Hub...</div>;

  const total = videos.length;
  const watched = videos.filter(v => v.status === "Watched").length;
  const pct = total === 0 ? 0 : Math.round((watched / total) * 100);

  // --- HIERARCHY EXTRACTION (Sorted by Admin Sequence) ---
  const subjects = Array.from(new Set(videos.map(v => v.subject || "Uncategorized"))).sort((a, b) => {
    const seqA = hierarchy[a]?.seq ?? 999;
    const seqB = hierarchy[b]?.seq ?? 999;
    return seqA - seqB || a.localeCompare(b);
  });
  const papers = activeSubject ? Array.from(new Set(videos.filter(v => (v.subject || "Uncategorized") === activeSubject).map(v => v.paper || "General"))).sort((a, b) => {
    const seqA = hierarchy[activeSubject]?.papers?.[a]?.seq ?? 999;
    const seqB = hierarchy[activeSubject]?.papers?.[b]?.seq ?? 999;
    return seqA - seqB || a.localeCompare(b);
  }) : [];
  const chapters = activePaper ? Array.from(new Set(videos.filter(v => (v.subject || "Uncategorized") === activeSubject && (v.paper || "General") === activePaper).map(v => v.chapter || "Misc"))).sort((a, b) => {
    const seqA = hierarchy[activeSubject!]?.papers?.[activePaper]?.chapters?.[a]?.seq ?? 999;
    const seqB = hierarchy[activeSubject!]?.papers?.[activePaper]?.chapters?.[b]?.seq ?? 999;
    return seqA - seqB || a.localeCompare(b);
  }) : [];
  const finalVideos = activeChapter ? videos.filter(v => (v.subject || "Uncategorized") === activeSubject && (v.paper || "General") === activePaper && (v.chapter || "Misc") === activeChapter) : [];

  const continueWatchingVideo = videos.find(v => v.status === "Watching");

  // Premium Fallback Gradients
  const getGradient = (name: string) => {
    const s = name.toLowerCase();
    if (s.includes("bio")) return "from-emerald-900 to-green-950";
    if (s.includes("chem")) return "from-purple-900 to-fuchsia-950";
    if (s.includes("math")) return "from-cyan-900 to-blue-950";
    if (s.includes("phy")) return "from-blue-900 to-indigo-950";
    return "from-gray-800 to-gray-950";
  };

  // --- SEARCH ENGINE ---
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching ? videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (v.subject && v.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.chapter && v.chapter.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.tags && v.tags.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.teacher && v.teacher.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  // --- REUSABLE VIDEO CARD COMPONENT ---
  const renderVideoCard = (video: any) => {
    const vSub = video.subject || "Uncategorized";
    const vPap = video.paper || "General";
    const vChap = video.chapter || "Misc";
    
    const customThumb = 
      hierarchy[vSub]?.papers?.[vPap]?.chapters?.[vChap]?.img || 
      hierarchy[vSub]?.papers?.[vPap]?.img || 
      hierarchy[vSub]?.img;

    const ytId = getYouTubeID(video.url);
    const thumbUrl = customThumb || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://via.placeholder.com/640x360?text=Invalid+Link");

    return (
      <div key={video.id} className="glass-card tilt-card rounded-3xl group flex flex-col h-full relative border border-white/10 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] transition-all duration-300" onClick={() => router.push(`/study/${video.id}`)}>
        <div className="relative aspect-video bg-black/50 cursor-pointer rounded-t-3xl overflow-hidden border-b border-white/10">
          <img src={thumbUrl} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-110 group-hover:opacity-40 transition-all duration-700 z-10" />
          
          <div className="absolute top-3 right-3 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={(e) => handleShare(e, video.id)} className="p-2.5 rounded-xl bg-black/60 backdrop-blur border border-white/10 hover:bg-white/10 transition jelly">
              <Share2 className="w-4 h-4 text-white" />
            </button>
            <button onClick={(e) => toggleFavorite(e, video)} className="p-2.5 rounded-xl bg-black/60 backdrop-blur border border-white/10 hover:bg-white/10 transition jelly">
              <Heart className={`w-4 h-4 ${video.is_favorite ? "fill-pink-500 text-pink-500" : "text-white"}`} />
            </button>
          </div>

          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 z-20 shadow-lg">
            {video.status === "New" && <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            {video.status === "Watching" && <Clock className="w-3.5 h-3.5 text-amber-400" />}
            {video.status === "Watched" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-200">{video.status === "Watching" ? `${video.progress}%` : video.status}</span>
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900/30 z-20 backdrop-blur-[2px]">
            <div className="w-16 h-16 rounded-full glass-panel flex items-center justify-center text-white shadow-[0_0_30px_rgba(99,102,241,0.6)] jelly-hover"><Play className="w-7 h-7 ml-1 text-indigo-300" /></div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/80 z-30 pointer-events-none">
            <div className={`h-full bg-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]`} style={{ width: `${video.progress || 0}%` }}></div>
          </div>
        </div>

        <div className="p-5 flex flex-col flex-grow relative z-20 bg-gradient-to-t from-black/60 to-transparent rounded-b-3xl">
          <h3 className="font-bold text-gray-100 line-clamp-2 leading-snug group-hover:text-indigo-400 transition text-sm mb-2">{video.title}</h3>
          <p className="text-[11px] text-indigo-300/80 flex items-center gap-1.5 mb-4"><MonitorPlay className="w-3 h-3" /> {video.teacher || "Unknown Platform"}</p>

          <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/10">
            <div className="text-[11px] text-indigo-400/60 font-mono truncate w-24">{video.tags || ""}</div>
            <button className="text-xs flex items-center gap-1.5 text-white bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg jelly font-bold hover:bg-indigo-500/40 transition">
              Study Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      
      {/* 🚀 SMART SEARCH RESULTS OVERRIDE */}
      {isSearching ? (
        <div className="animate-fade-in pb-12">
          <h2 className="text-2xl font-bold mb-6 text-indigo-100 flex items-center gap-3">
            <Search className="w-6 h-6 text-indigo-400" /> Search Results for "{searchQuery}"
          </h2>
          {searchResults.length === 0 ? (
            <div className="text-center text-gray-500 py-16 flex flex-col items-center">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p>No classes found matching your search. Try different keywords!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResults.map((video) => renderVideoCard(video))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* STANDARD DASHBOARD VIEW */}
          {continueWatchingVideo && viewLevel === "subjects" && (
            <div className="mb-6 animate-fade-in cursor-pointer jelly" onClick={() => router.push(`/study/${continueWatchingVideo.id}`)}>
              <div className="glass-panel p-4 rounded-2xl border-indigo-500/30 bg-indigo-900/10 flex items-center gap-4 hover:bg-indigo-900/20 transition">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0"><Play className="w-6 h-6 text-indigo-400" /></div>
                <div className="flex-grow">
                  <p className="text-xs text-indigo-300 uppercase tracking-wider font-bold mb-0.5">Continue Watching</p>
                  <h3 className="font-medium text-white truncate max-w-md">{continueWatchingVideo.title}</h3>
                </div>
                <button className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium hidden sm:block">Resume</button>
              </div>
            </div>
          )}
          
          {viewLevel === "subjects" && (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide text-sm text-gray-300 mb-8">
              <div className="glass-panel px-4 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2.5 self-center">
                <Library className="w-4 h-4 text-indigo-400" /> Total: <span className="text-white font-bold">{total}</span>
              </div>
              <div className="glass-panel px-5 py-2.5 rounded-xl flex flex-col justify-center min-w-[200px] sm:min-w-[250px] gap-2 shrink-0">
                <div className="flex justify-between items-center text-xs w-full">
                  <span className="flex items-center gap-1.5 text-gray-300 font-medium"><Target className="w-3.5 h-3.5 text-indigo-400" /> Completion</span>
                  <span className="text-white font-bold">{watched}/{total} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
                  <div className={`absolute top-0 left-0 h-full bg-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-700 ease-out`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            </div>
          )}

          {viewLevel !== "subjects" && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-8 animate-fade-in bg-black/40 p-3 rounded-xl border border-white/5 w-max backdrop-blur-md shadow-lg">
              <button onClick={() => setViewLevel("subjects")} className="hover:text-white flex items-center gap-1 transition"><Library className="w-4 h-4"/> Subjects</button>
              <ChevronRight className="w-4 h-4 opacity-50" />
              <button onClick={() => setViewLevel("papers")} className={`transition ${viewLevel === "papers" ? "text-indigo-400 font-bold" : "hover:text-white"}`}>{activeSubject}</button>
              
              {(viewLevel === "chapters" || viewLevel === "videos") && (
                <>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                  <button onClick={() => setViewLevel("chapters")} className={`transition ${viewLevel === "chapters" ? "text-fuchsia-400 font-bold" : "hover:text-white"}`}>{activePaper}</button>
                </>
              )}

              {viewLevel === "videos" && (
                <>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                  <span className="text-emerald-400 font-bold">{activeChapter}</span>
                </>
              )}
            </div>
          )}

          {/* TIER 1: SUBJECTS */}
          {viewLevel === "subjects" && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-center text-indigo-100 tracking-wide">Subjects</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {subjects.map((subject, idx) => {
                  const count = videos.filter(v => (v.subject || "Uncategorized") === subject).length;
                  const bgImg = hierarchy[subject]?.img;
                  const customLabel = hierarchy[subject]?.label || "SUBJECT";

                  return (
                    <div key={idx} onClick={() => { setActiveSubject(subject); setViewLevel("papers"); }} className="rounded-2xl overflow-hidden cursor-pointer group glass-card hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:-translate-y-1 transition-all duration-300 relative shadow-lg">
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2.5 border-b border-white/10 flex justify-between items-center z-20 relative">
                        <p className="text-[10px] font-bold text-indigo-300 tracking-wider uppercase">{customLabel}</p>
                        <FolderOpen className="w-4 h-4 text-indigo-400 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      </div>
                      <div className={`h-32 bg-gradient-to-br ${getGradient(subject)} flex items-center justify-center relative overflow-hidden`}>
                        {bgImg && <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-[1px] group-hover:scale-110 group-hover:blur-none group-hover:opacity-80 transition-all duration-700" style={{backgroundImage: `url(${bgImg})`}}></div>}
                        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-all duration-500"></div>
                        <h3 className="text-3xl font-extrabold text-white text-center drop-shadow-[0_5px_5px_rgba(0,0,0,0.9)] z-10 group-hover:scale-110 transition-transform duration-500">{subject}</h3>
                      </div>
                      <div className="bg-black/60 backdrop-blur-md p-3 text-center border-t border-white/10 relative z-20">
                        <p className="text-xs font-bold text-gray-400 group-hover:text-indigo-300 transition-colors">{count} Classes Total</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TIER 2: PAPERS */}
          {viewLevel === "papers" && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 text-center text-blue-300 tracking-wide">{activeSubject}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {papers.map((paper, idx) => {
                  const count = videos.filter(v => (v.subject || "Uncategorized") === activeSubject && (v.paper || "General") === paper).length;
                  const bgImg = hierarchy[activeSubject!]?.papers?.[paper]?.img || hierarchy[activeSubject!]?.img;
                  const customLabel = hierarchy[activeSubject!]?.papers?.[paper]?.label || "PAPER";

                  return (
                    <div key={idx} onClick={() => { setActivePaper(paper); setViewLevel("chapters"); }} className="rounded-2xl overflow-hidden cursor-pointer group glass-card hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:-translate-y-1 transition-all duration-300 relative shadow-lg">
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2.5 border-b border-white/10 flex justify-between items-center z-20 relative">
                        <p className="text-[10px] font-bold text-blue-300 tracking-wider uppercase">{customLabel}</p>
                        <FolderOpen className="w-4 h-4 text-blue-400 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      </div>
                      <div className={`h-32 bg-gradient-to-br ${getGradient(activeSubject!)} flex items-center justify-center relative overflow-hidden`}>
                        {bgImg && <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-[1px] group-hover:scale-110 group-hover:blur-none group-hover:opacity-80 transition-all duration-700" style={{backgroundImage: `url(${bgImg})`}}></div>}
                        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-all duration-500"></div>
                        <h3 className="text-3xl font-extrabold text-white text-center drop-shadow-[0_5px_5px_rgba(0,0,0,0.9)] z-10 group-hover:scale-110 transition-transform duration-500">{paper}</h3>
                      </div>
                      <div className="bg-black/60 backdrop-blur-md p-3 text-center border-t border-white/10 relative z-20">
                        <p className="text-xs font-bold text-gray-400 group-hover:text-blue-300 transition-colors">{count} Classes Available</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TIER 3: CHAPTERS */}
          {viewLevel === "chapters" && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 text-center text-fuchsia-300 tracking-wide">{activeSubject} • {activePaper} <br/><span className="text-sm text-gray-400">Select Chapter</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {chapters.map((chapter, idx) => {
                  const count = videos.filter(v => (v.subject || "Uncategorized") === activeSubject && (v.paper || "General") === activePaper && (v.chapter || "Misc") === chapter).length;
                  const bgImg = hierarchy[activeSubject!]?.papers?.[activePaper!]?.chapters?.[chapter]?.img || hierarchy[activeSubject!]?.papers?.[activePaper!]?.img || hierarchy[activeSubject!]?.img;
                  const customLabel = hierarchy[activeSubject!]?.papers?.[activePaper!]?.chapters?.[chapter]?.label || `Chapter ${idx + 1}`;

                  return (
                    <div key={idx} onClick={() => { setActiveChapter(chapter); setViewLevel("videos"); }} className="rounded-2xl overflow-hidden cursor-pointer group glass-card hover:border-fuchsia-500/50 hover:shadow-[0_0_30px_rgba(217,70,239,0.3)] hover:-translate-y-1 transition-all duration-300 relative shadow-lg">
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2.5 border-b border-white/10 flex justify-between items-center z-20 relative">
                        <p className="text-[10px] font-bold text-gray-300 tracking-wider uppercase">{customLabel}</p>
                        <FolderOpen className="w-4 h-4 text-fuchsia-400 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      </div>
                      <div className={`h-32 bg-gradient-to-br ${getGradient(activeSubject!)} flex items-center justify-center p-4 relative overflow-hidden`}>
                        {bgImg && <div className="absolute inset-0 bg-cover bg-center opacity-40 blur-[1px] group-hover:scale-110 group-hover:blur-none group-hover:opacity-80 transition-all duration-700" style={{backgroundImage: `url(${bgImg})`}}></div>}
                        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/20 transition-all duration-500"></div>
                        <h3 className="text-xl font-bold text-white text-center drop-shadow-[0_5px_5px_rgba(0,0,0,0.9)] z-10 line-clamp-2 group-hover:scale-110 transition-transform duration-500">{chapter}</h3>
                      </div>
                      <div className="bg-black/60 backdrop-blur-md p-3 text-center border-t border-white/10 relative z-20">
                        <p className="text-xs font-bold text-gray-400 group-hover:text-fuchsia-300 transition-colors">{count} Videos</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TIER 4: VIDEOS GRID */}
          {viewLevel === "videos" && (
            <div className="animate-fade-in pb-12">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <h2 className="text-2xl font-bold tracking-wider text-gray-100 flex items-center gap-2"><BookOpen className="text-emerald-400 w-6 h-6"/> {activeChapter}</h2>
                <button onClick={() => handleShare({stopPropagation: ()=>{}} as any, 0)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 transition flex items-center gap-2 jelly"><Share2 className="w-3.5 h-3.5" /> Share Chapter</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {finalVideos.map((video) => renderVideoCard(video))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



