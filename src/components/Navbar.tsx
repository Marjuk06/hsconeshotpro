"use client";

import { GraduationCap, Target, Moon, Search } from "lucide-react";
import { useState } from "react";
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
    toast(newMode ? "Exam Mode Activated 🎯" : "Exam Mode Deactivated", { icon: newMode ? "🎯" : "📚" });
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

      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="relative flex-grow sm:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-400 transition" />
          <input type="text" onChange={(e) => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent("globalSearch", { detail: e.target.value }))} placeholder="Search classes, tags, subjects..." className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner" />
        </div>
      </div>
    </nav>
  );
}