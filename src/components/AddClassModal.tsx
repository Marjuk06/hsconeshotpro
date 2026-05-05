"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddClassModal({ isOpen, onClose }: AddClassModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    // Package the form data for Supabase
    const newClass = {
      url: formData.get("url"),
      title: formData.get("title"),
      subject: formData.get("subject"),
      paper: formData.get("paper"),
      chapter: formData.get("chapter"),
      teacher: formData.get("teacher"),
      tags: formData.get("tags"),
      status: "New",
      progress: 0,
      is_favorite: false
    };

    // Send to Supabase
    const { error } = await supabase.from("videos").insert([newClass]);

    setLoading(false);

    if (!error) {
      onClose();
      // Dispatch an event to tell the VideoGrid to refresh instantly
      window.dispatchEvent(new Event("classAdded")); 
    } else {
      alert("Error adding class: " + error.message);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="glass-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 relative z-10 animate-fade-in shadow-2xl shadow-black">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Add New Class</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition jelly">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">YouTube Link <span className="text-rose-500">*</span></label>
            <input type="url" name="url" required placeholder="https://youtu.be/..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Title <span className="text-rose-500">*</span></label>
            <input type="text" name="title" required placeholder="Vector One Shot - HSC 25" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Subject <span className="text-rose-500">*</span></label>
              <input type="text" name="subject" required placeholder="e.g. Physics" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Paper</label>
              <input type="text" name="paper" placeholder="e.g. 1st Paper" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Chapter <span className="text-rose-500">*</span></label>
              <input type="text" name="chapter" required placeholder="e.g. Vector" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Teacher</label>
              <input type="text" name="teacher" placeholder="e.g. ACS" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Tags</label>
            <input type="text" name="tags" placeholder="#mcq, #important" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-sm" />
          </div>

          <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-medium py-3.5 rounded-xl mt-6 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition duration-300 jelly disabled:opacity-50">
            {loading ? "Saving..." : "Save to Hub"}
          </button>
        </form>
      </div>
    </div>
  );
}