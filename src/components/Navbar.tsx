"use client";

import { GraduationCap, Target, Moon, Search, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [isExamMode, setIsExamMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  
  // Notification States
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const fetchNewClasses = async () => {
      const { data } = await supabase.from("videos").select("*").order("id", { ascending: false }).limit(10);
      if (data) {
        // Grab the exact timestamp of when the user last clicked "Clear All"
        const clearedAt = parseInt(localStorage.getItem("hsc_notifs_cleared_at") || "0");
        
        const recent24h = data.filter(n => {
          if (!n.created_at) return false; 
          const dbTime = new Date(n.created_at).getTime();
          const hours = Math.abs(Date.now() - dbTime) / (1000 * 60 * 60);
          
          // Show ONLY if it's less than 24h old AND it was uploaded AFTER they last clicked "Clear All"
          return hours <= 24 && dbTime > clearedAt;
        });
        setNotifications(recent24h);
      }
    };
    fetchNewClasses();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifs(false);
    };

    window.addEventListener("classAdded", fetchNewClasses);
    document.addEventListener("mousedown", handleClickOutside);

    const realtimeChannel = supabase
      .channel('navbar-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, (payload) => {
        fetchNewClasses(); 
        
        if (payload.eventType === 'INSERT') {
          // INFINITE JIGGLE: Stays true until the user clicks the bell
          setIsRinging(true); 
          
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = "sine"; osc.frequency.setValueAtTime(880, ctx.currentTime); 
            gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.stop(ctx.currentTime + 0.5);
          } catch (e) { console.log("Audio muted by browser policy until interaction"); }

          if ('Notification' in window && Notification.permission === 'granted') {
            const newVideo = payload.new;
            const ytId = newVideo.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
            const iconUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/favicon.ico';
            
            new Notification("New Class Uploaded! 🚀", {
              body: `${newVideo.title}\n${newVideo.subject} • ${newVideo.chapter}`,
              icon: iconUrl,
            });
          }
        }
      })
      .subscribe();
    
    return () => {
      window.removeEventListener("classAdded", fetchNewClasses);
      document.removeEventListener("mousedown", handleClickOutside);
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // Action: Clear all notifications from view permanently
  const clearAllNotifications = () => {
    localStorage.setItem("hsc_notifs_cleared_at", Date.now().toString());
    setNotifications([]);
    setShowNotifs(false);
    setIsRinging(false);
  };

  // Action: Stop jiggling when the bell is clicked
  const handleBellClick = () => {
    setShowNotifs(!showNotifs);
    setIsRinging(false); 
  };

  const toggleNightMode = () => {
    setIsNightMode(!isNightMode);
    document.body.classList.toggle("night-mode-active");
    toast(isNightMode ? "Night Mode Disabled" : "Night Mode Enabled 🌙", { icon: isNightMode ? "☀️" : "🌙" });
  };

  const toggleExamMode = () => {
    const newMode = !isExamMode;
    setIsExamMode(newMode);
    window.dispatchEvent(new CustomEvent("examModeChanged", { detail: newMode }));
    toast(newMode ? "Exam Mode Activated 🎯" : "Exam Mode Deactivated", { icon: newMode ? "🎯" : "📝" });
  };

  return (
    <nav className="glass-panel sticky top-0 z-40 w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/10 backdrop-blur-xl border-b border-white/20">
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-3 jelly cursor-pointer" onClick={() => window.location.href = '/'}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <GraduationCap className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-wider">HSC<span className="text-indigo-400">ONESHOT</span>PRO</h1>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-end">
        {/* Inject Custom Keyframes for Ringing Animation */}
        <style>{`
          @keyframes custom-ring {
            0%, 100% { transform: rotate(0deg); }
            10%, 30%, 50%, 70%, 90% { transform: rotate(15deg); }
            20%, 40%, 60%, 80% { transform: rotate(-15deg); }
          }
          .animate-ring { animation: custom-ring 0.6s ease-in-out infinite; }
        `}</style>

        {/* Global Search (Moved to left of bell so Bell sits on the far right edge) */}
        <div className="relative flex-grow sm:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-400 transition" />
          <input type="text" onChange={(e) => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent("globalSearch", { detail: e.target.value }))} placeholder="Search classes..." className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner" />
        </div>

        {/* Notifications (Moved to right edge) */}
        <div className="relative shrink-0" ref={notifRef}>
          <button onClick={handleBellClick} className={`p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition relative jelly ${isRinging ? 'bg-fuchsia-500/20 border-fuchsia-500/50' : ''}`}>
            <Bell className={`w-5 h-5 text-gray-300 origin-top ${isRinging ? 'animate-ring text-fuchsia-400' : ''}`} />
            {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-gray-900 animate-pulse"></span>}
          </button>
          
          {showNotifs && (
            <div className="absolute right-0 top-full mt-3 w-[85vw] max-w-[320px] sm:w-80 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 animate-fade-in flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h3 className="font-bold text-sm text-gray-200">Latest Drops</h3>
                {notifications.length > 0 && (
                  <button onClick={clearAllNotifications} className="text-[10px] uppercase tracking-wider text-rose-400 hover:text-rose-300 font-bold transition">Clear All</button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">You're all caught up! ✨</p>
              ) : (
                notifications.map(n => {
                  const ytId = n.url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
                  return (
                    <div key={n.id} onClick={() => {
                        clearAllNotifications(); // Auto-clear when they click to watch
                        window.location.href=`/study/${n.id}`;
                      }} className="flex gap-3 items-center cursor-pointer hover:bg-white/5 p-2 rounded-xl transition">
                      <img src={ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://via.placeholder.com/64x36"} className="w-16 h-9 rounded-md object-cover border border-white/10" alt="thumb"/>
                      <div className="overflow-hidden flex-grow">
                        <p className="text-xs font-bold text-white truncate">{n.title}</p>
                        <p className="text-[10px] text-indigo-300 truncate">{n.subject} • {n.chapter}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}