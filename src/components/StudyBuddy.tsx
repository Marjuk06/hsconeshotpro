"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function StudyBuddy() {
  const pathname = usePathname();
  const [msg, setMsg] = useState("Ready to study?");
  const [showMsg, setShowMsg] = useState(false);
  const [mood, setMood] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [tier, setTier] = useState<"beginner" | "intermediate" | "advanced">("beginner");

  const isStudyRoom = pathname?.startsWith("/study/");

  // --- AUDIO SYNTHESIS ENGINE (No external files needed) ---
  const playSound = (type: "pop" | "bloop") => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain); 
      gain.connect(ctx.destination);
      
      if (type === 'pop') {
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(); 
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(); 
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch(e) { console.log("Audio blocked by browser."); }
  };

  // --- THE BRAIN: Communication & Memory ---
  const smartAssistant = (message: string, currentMood = "idle", duration = 3000) => {
    if (isMuted) return;
    setMsg(message);
    setMood(currentMood);
    setShowMsg(true);
    playSound("pop"); 
    
    setTimeout(() => {
      setShowMsg(false);
      setTimeout(() => setMood("idle"), 300); 
    }, duration);
  };

  const checkEvolution = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("hsc_user_data") || "{}");
      const watchedCount = Object.values(stored).filter((v: any) => v.status === 'Watched' || v.progress === 100).length;
      
      if (watchedCount >= 20) setTier("advanced");      
      else if (watchedCount >= 5) setTier("intermediate"); 
      else setTier("beginner");                         
    } catch(e) {}
  };

  // --- GLOBAL EVENT LISTENERS & TIMERS ---
  useEffect(() => {
    checkEvolution(); 

    // 1. Initial Greeting (Only on Dashboard)
    let initialTimer: NodeJS.Timeout;
    if (!isStudyRoom) {
      const hour = new Date().getHours();
      let greeting = "Ready to crush some chapters? 🔥";
      if (hour < 5 || hour >= 22) greeting = "Late night study? Respect 🌙";
      else if (hour < 12) greeting = "Start your day strong 💪";
      initialTimer = setTimeout(() => { smartAssistant(greeting, "happy", 4000); }, 1000);
    }

    // 2. Achievement Unlocked Listener
    const handleClassWatched = (e: any) => {
      const chapter = e.detail?.chapter || "that chapter";
      setTimeout(() => {
        checkEvolution(); 
        smartAssistant(`Awesome job finishing ${chapter}! 🎉`, "happy", 6000);
      }, 500);
    };

    // 3. Idle & Pomodoro Focus Timers
    let idleTimer: NodeJS.Timeout;
    let focusInterval: NodeJS.Timeout;

    // Idle Timer (Only runs on Dashboard)
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      if (!isStudyRoom) { 
        idleTimer = setTimeout(() => {
          smartAssistant("Don't just stare at the screen, pick a subject! 👀", "shocked", 4000);
        }, 5 * 60 * 1000); 
      }
    };

    // Focus Timer (Only runs in Study Room)
    let studyMinutes = 0;
    if (isStudyRoom) {
      focusInterval = setInterval(() => {
        studyMinutes += 1;
        if (studyMinutes === 25) {
          smartAssistant("25 minutes of focus! Take a quick 5-min stretch break. ☕", "happy", 8000);
        } else if (studyMinutes === 50) {
          smartAssistant("50 mins! You're on fire! 🔥 Rest your eyes and drink water! 💧", "sleepy", 8000);
          studyMinutes = 0; // Reset loop
        }
      }, 60 * 1000); // Ticks exactly every 1 minute
    }

    window.addEventListener('classWatched', handleClassWatched);
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    
    resetIdleTimer();

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(idleTimer);
      clearInterval(focusInterval);
      window.removeEventListener('classWatched', handleClassWatched);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, [pathname, isMuted, isStudyRoom]); // Auto-resets timers when changing pages

  // --- INTERACTIONS ---
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
      playSound("pop");
      setTimeout(() => {
        setShowMsg(false);
        setTimeout(() => setMood("idle"), 300);
      }, 2000);
    }
  };

  const pokeAssistant = () => {
    if (isMuted) return;
    playSound("bloop"); 
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
    // 🔥 THE POP-UP MAGIC: Hides dynamically if in Study Room and idle 🔥
    <div className={`fixed bottom-6 left-6 z-[90] flex flex-col items-start gap-3 transition-all duration-700 ease-out origin-bottom-left ${
      isStudyRoom && !showMsg 
        ? 'translate-y-32 opacity-0 pointer-events-none scale-50' 
        : 'translate-y-0 opacity-100 scale-100'
    }`}>
      
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
        className={`blob-char ${mood} tier-${tier} w-[60px] h-[60px] rounded-full cursor-pointer relative transition-transform duration-200 ease-out active:scale-90`}
        title={`Double click to mute/unmute! (${tier.toUpperCase()} TIER)`}
      >
        {/* Advanced Tier Graduation Cap! */}
        {tier === 'advanced' && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10 w-10 h-10 drop-shadow-lg transform -rotate-12 pointer-events-none transition-all duration-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-gray-900 fill-gray-900">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
        )}

        <div className="eyes absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3 flex justify-between transition-all duration-300">
          <div className="eye w-2 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"></div>
          <div className="eye w-2 h-3 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300"></div>
        </div>
        <div className="mouth absolute top-[62%] left-1/2 -translate-x-1/2 w-2.5 h-1 bg-white rounded-full opacity-90 transition-all duration-300"></div>
      </div>

      {/* Global Styles for Blob Animations & Tier Colors */}
      <style jsx global>{`
        .blob-char {
          animation: blobFloat 3s ease-in-out infinite;
          transition: background 1s ease, box-shadow 1s ease;
        }
        
        /* THE EVOLUTION SYSTEM */
        .blob-char.tier-beginner {
          background: radial-gradient(circle at 35% 35%, #a855f7, #4f46e5);
          box-shadow: 0 0 25px rgba(99,102,241,0.5), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.4);
        }
        .blob-char.tier-beginner:hover { box-shadow: 0 0 35px rgba(217,70,239,0.7), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.5); }

        .blob-char.tier-intermediate {
          background: radial-gradient(circle at 35% 35%, #38bdf8, #0ea5e9);
          box-shadow: 0 0 25px rgba(14,165,233,0.5), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.4);
        }
        .blob-char.tier-intermediate:hover { box-shadow: 0 0 35px rgba(56,189,248,0.7), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.5); }

        .blob-char.tier-advanced {
          background: radial-gradient(circle at 35% 35%, #fbbf24, #d97706);
          box-shadow: 0 0 25px rgba(217,119,6,0.5), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.4);
        }
        .blob-char.tier-advanced:hover { box-shadow: 0 0 35px rgba(251,191,36,0.7), inset -5px -5px 15px rgba(0,0,0,0.3), inset 5px 5px 15px rgba(255,255,255,0.5); }
        
        .blob-char .eye { animation: blobBlink 4s infinite; }
        
        /* Moods */
        .blob-char.happy .eye { height: 5px; border-radius: 50% 50% 0 0; margin-top: 5px; animation: none; }
        .blob-char.happy .mouth { width: 16px; height: 8px; border-radius: 0 0 10px 10px; }
        
        .blob-char.sad .eye { height: 6px; transform: rotate(-15deg); animation: none; }
        .blob-char.sad .eyes .eye:nth-child(2) { transform: rotate(15deg); }
        .blob-char.sad .mouth { width: 12px; height: 4px; border-radius: 10px 10px 0 0; top: 65%; }
        
        .blob-char.angry { background: radial-gradient(circle at 35% 35%, #ef4444, #7f1d1d) !important; box-shadow: 0 0 30px rgba(239, 68, 68, 0.6) !important; }
        .blob-char.angry .eye { height: 4px; background: #fff; transform: rotate(15deg); margin-top: 2px; animation: none; }
        .blob-char.angry .eyes .eye:nth-child(2) { transform: rotate(-15deg); }
        .blob-char.angry .mouth { width: 14px; height: 4px; border-radius: 10px 10px 0 0; }
        
        .blob-char.sleepy .eye { height: 3px; opacity: 0.6; animation: none; margin-top: 6px;}
        .blob-char.sleepy .mouth { width: 6px; height: 6px; border-radius: 50%; opacity: 0.5; }
        
        .blob-char.shocked .eye { width: 10px; height: 10px; border-radius: 50%; animation: none; }
        .blob-char.shocked .mouth { width: 8px; height: 8px; border-radius: 50%; top: 68%; }
        
        .blob-char.cool .eye { width: 14px; height: 5px; border-radius: 2px; animation: none; }
        .blob-char.cool .mouth { width: 12px; height: 3px; transform: translateX(-50%) rotate(-5deg); border-radius: 2px; }
        
        .blob-char.love { background: radial-gradient(circle at 35% 35%, #f43f5e, #db2777) !important; box-shadow: 0 0 30px rgba(244, 63, 94, 0.6) !important; }
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