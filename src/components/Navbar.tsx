"use client";

import { GraduationCap, Target, Moon, Search, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function Navbar() {
  const [isExamMode, setIsExamMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);

  const toggleNightMode = () => {
    setIsNightMode(!isNightMode);
    document.body.classList.toggle("night-mode-active");
    toast(isNightMode ? "Night Mode Disabled" : "Night Mode Enabled 🌙", { icon: isNightMode ? "☀️" : "🌙" });
  };

  const toggleExamMode = () => {
    const newMode = !isExamMode;
    setIsExamMode(newMode);
    window.dispatchEvent(new CustomEvent("examModeChanged", { detail: newMode }));
    toast(newMode ? "Exam Mode Activated 識" : "Exam Mode Deactivated", { icon: newMode ? "識" : "答" });
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const fetchNewClasses = async () => {
      const { data } = await supabase.from("videos").select("*").eq("status", "New").order("id", { ascending: false }).limit(5);
      if (data) setNotifications(data);
    };
    fetchNewClasses();
    window.addEventListener("classAdded", fetchNewClasses);
    return () => window.removeEventListener("classAdded", fetchNewClasses);
  }, []);

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

      <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition relative jelly">
            <Bell className="w-5 h-5 text-gray-300" />
            {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-gray-900 animate-pulse"></span>}
          </button>
          
          {showNotifs && (
            <div className="absolute right-0 top-full mt-3 w-80 glass-panel border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-fade-in flex flex-col gap-3">
              <h3 className="font-bold text-sm text-gray-200 border-b border-white/10 pb-2">Latest Classes added</h3>
              {notifications.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No new classes right now.</p>
              ) : (
                notifications.map(n => {
                  const ytId = n.url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
                  return (
                    <div key={n.id} onClick={() => window.location.href=`/study/${n.id}`} className="flex gap-3 items-center cursor-pointer hover:bg-white/5 p-2 rounded-xl transition">
                      <img src={ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://via.placeholder.com/64x36"} className="w-16 h-9 rounded-md object-cover border border-white/10" alt="thumb"/>
                      <div className="overflow-hidden">
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

        <div className="relative flex-grow sm:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-400 transition" />
          <input type="text" onChange={(e) => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent("globalSearch", { detail: e.target.value }))} placeholder="Search classes, tags, subjects..." className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner" />
        </div>
      </div>
    </nav>
  );
}