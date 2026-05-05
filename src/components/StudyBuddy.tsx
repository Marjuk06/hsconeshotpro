"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function StudyBuddy() {
  const pathname = usePathname();
  const [msg, setMsg] = useState("Ready to study?");
  const [showMsg, setShowMsg] = useState(false);
  const [mood, setMood] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);

  const smartAssistant = (message: string, currentMood = "idle", duration = 3000) => {
    if (isMuted) return;
    setMsg(message);
    setMood(currentMood);
    setShowMsg(true);
    setTimeout(() => {
      setShowMsg(false);
      setTimeout(() => setMood("idle"), 300); // Wait for bubble to fade before resetting mood
    }, duration);
  };

  useEffect(() => {
    // Initial Greeting
    const hour = new Date().getHours();
    let greeting = "Ready to crush some chapters? 🔥";
    if (hour < 5 || hour >= 22) greeting = "Late night study? Respect 🌙";
    else if (hour < 12) greeting = "Start your day strong 💪";
    
    // Small delay so it pops up after the page loads
    const timer = setTimeout(() => {
      smartAssistant(greeting, "happy", 4000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isMuted]); // Added isMuted to dependency array so it doesn't complain about stale closures

  // 🔥 IMPORTANT FIX: Early returns MUST go after ALL hooks! 🔥
  if (pathname?.startsWith("/study/")) return null;

  const handleDoubleClick = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (newMutedState) {
      setShowMsg(false);
      setMood("sleepy");
    } else {
      setMood("happy");
      setMsg("I'm back! 🔊");
      setShowMsg(true);
      setTimeout(() => {
        setShowMsg(false);
        setTimeout(() => setMood("idle"), 300);
      }, 2000);
    }
  };

  const pokeAssistant = () => {
    if (isMuted) return;
    const actions = [
      () => smartAssistant("Hehe 😄 Let's study!", "happy"),
      () => smartAssistant("Don't ignore me 🥺", "sad"),
      () => smartAssistant("Wow! That tickles! ⚡", "shocked"),
      () => smartAssistant("I'm too cool for this 😎", "cool"),
      () => smartAssistant("Love you too! ❤️", "love"),
      () => smartAssistant("Whoa, stop spinning me! 😵", "dizzy")
    ];
    actions[Math.floor(Math.random() * actions.length)]();
  };

  return (
    <div className="fixed bottom-6 left-6 z-[90] flex flex-col items-start gap-3 transition-all duration-500 origin-bottom-left">
      
      {/* Message Bubble */}
      <div 
        className={`bg-black/60 border border-white/10 backdrop-blur-xl px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm font-medium text-white shadow-[0_10px_20px_rgba(0,0,0,0.3)] max-w-[250px] whitespace-pre-wrap transition-all duration-300 ${
          showMsg ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-90 pointer-events-none'
        }`}
      >
        {msg}
      </div>

      {/* The Blob Character */}
      <div 
        onClick={pokeAssistant}
        onDoubleClick={handleDoubleClick}
        className={`blob-char ${mood} w-[60px] h-[60px] rounded-full cursor-pointer relative transition-transform duration-200 ease-out active:scale-90`}
        title="Double click to mute/unmute!"
      >
        <div className="eyes absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3 flex justify-between transition-all duration-300">
          <div className="eye w-2 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"></div>
          <div className="eye w-2 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"></div>
        </div>
        <div className="mouth absolute top-[62%] left-1/2 -translate-x-1/2 w-2.5 h-1 bg-white rounded-full opacity-90 transition-all duration-300"></div>
      </div>

      {/* Global Styles for Blob Animations */}
      <style jsx global>{`
        .blob-char {
          background: radial-gradient(circle at 35% 35%, #a855f7, #4f46e5);
          box-shadow: 0 0 25px rgba(99,102,241,0.5), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.4);
          animation: blobFloat 3s ease-in-out infinite;
        }
        .blob-char:hover { box-shadow: 0 0 35px rgba(217,70,239,0.7), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.5); }
        
        .blob-char .eye { animation: blobBlink 4s infinite; }
        
        /* Moods */
        .blob-char.happy .eye { height: 5px; border-radius: 50% 50% 0 0; margin-top: 5px; animation: none; }
        .blob-char.happy .mouth { width: 16px; height: 8px; border-radius: 0 0 10px 10px; }
        
        .blob-char.sad .eye { height: 6px; transform: rotate(-15deg); animation: none; }
        .blob-char.sad .eyes .eye:nth-child(2) { transform: rotate(15deg); }
        .blob-char.sad .mouth { width: 12px; height: 4px; border-radius: 10px 10px 0 0; top: 65%; }
        
        .blob-char.angry { background: radial-gradient(circle at 35% 35%, #ef4444, #7f1d1d); box-shadow: 0 0 30px rgba(239, 68, 68, 0.6); }
        .blob-char.angry .eye { height: 4px; background: #fff; transform: rotate(15deg); margin-top: 2px; animation: none; }
        .blob-char.angry .eyes .eye:nth-child(2) { transform: rotate(-15deg); }
        .blob-char.angry .mouth { width: 14px; height: 4px; border-radius: 10px 10px 0 0; }
        
        .blob-char.sleepy .eye { height: 3px; opacity: 0.6; animation: none; margin-top: 6px;}
        .blob-char.sleepy .mouth { width: 6px; height: 6px; border-radius: 50%; opacity: 0.5; }
        
        .blob-char.shocked .eye { width: 10px; height: 10px; border-radius: 50%; animation: none; }
        .blob-char.shocked .mouth { width: 8px; height: 8px; border-radius: 50%; top: 68%; }
        
        .blob-char.cool .eye { width: 14px; height: 5px; border-radius: 2px; animation: none; }
        .blob-char.cool .mouth { width: 12px; height: 3px; transform: translateX(-50%) rotate(-5deg); border-radius: 2px; }
        
        .blob-char.love { background: radial-gradient(circle at 35% 35%, #f43f5e, #db2777); box-shadow: 0 0 30px rgba(244, 63, 94, 0.6); }
        .blob-char.love .eye { width: 10px; height: 8px; border-radius: 50% 50% 0 0; animation: blobFloatPlayful 1s infinite; }
        .blob-char.love .mouth { width: 14px; height: 6px; border-radius: 0 0 10px 10px; }
        
        .blob-char.dizzy .eye { width: 12px; height: 4px; animation: blobSpin 0.5s linear infinite; }
        .blob-char.dizzy .mouth { width: 8px; height: 8px; border-radius: 50%; animation: blobFloatPlayful 0.5s infinite; }

        @keyframes blobFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes blobFloatPlayful { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-15px) rotate(10deg); } 75% { transform: translateY(-5px) rotate(-10deg); } }
        @keyframes blobBlink { 0%, 96%, 98% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
        @keyframes blobSpin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}