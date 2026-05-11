"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { 
  Shield, PlusCircle, LayoutDashboard, Library, Settings, 
  Upload, Download, Search, Trash2, Edit2, PlayCircle, 
  CheckCircle, Clock, BookOpen, AlertTriangle, ArrowLeft,
  LayoutGrid, LayoutList, ExternalLink, Paperclip, FolderInput, ArrowUp, ArrowDown, X, Image as ImageIcon, Share2, Layers, ChevronRight, FileText
} from "lucide-react";

const getYouTubeID = (url: string) => {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
};
// --- NEW YOUTUBE TIME DECODER ENGINE ---
const fetchYTDuration = async (ytId: string): Promise<number> => {
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey || !ytId) return 0;
  
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${ytId}&part=contentDetails&key=${apiKey}`);
    const data = await res.json();
    if (!data.items || data.items.length === 0) return 0;
    
    // Decode YouTube's weird PT1H2M10S format into total seconds
    const durationStr = data.items[0].contentDetails.duration;
    const match = durationStr.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    
    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
  } catch (error) {
    console.error("Failed to fetch duration", error);
    return 0;
  }
};

export default function MasterAdmin() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("library"); 
  const [videos, setVideos] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list"); 
  const [isNavLoaded, setIsNavLoaded] = useState(false);
  
  // Auth State
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  
  // Library Multi-Select & Modals
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteAlertIds, setDeleteAlertIds] = useState<number[]>([]);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  
  // EDIT Modal State
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const [editSheets, setEditSheets] = useState<{title: string, url: string}[]>([{ title: "Lecture Slide", url: "" }]);

  useEffect(() => {
    if (editingVideo) {
      // Auto-load existing sheets or provide a blank one if none exist
      setEditSheets(editingVideo.sheets && editingVideo.sheets.length > 0 ? editingVideo.sheets : [{ title: "Lecture Slide", url: "" }]);
    }
  }, [editingVideo]);

  // Factory Reset States
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Form States (Upload)
  const [isBulkMode, setIsBulkMode] = useState(false); 
  const [loadingForm, setLoadingForm] = useState(false);
  const [bulkRows, setBulkRows] = useState([{ url: "", title: "", chapter: "" }]);
  const [sheets, setSheets] = useState([{ title: "Lecture Slide", url: "" }]);
  const [prefetchThumb, setPrefetchThumb] = useState<string | null>(null); // For live thumbnail preview
  
  // The exact naming sequence for your lecture sheets
  const SHEET_SEQUENCE = ["Lecture Slide", "Practice Sheet", "Solution Sheet", "Marked Book", "Bonus Material"];

  // Hierarchy & Smart Link States
  const [hierarchy, setHierarchy] = useState<Record<string, any>>({});
  const [hPath, setHPath] = useState<{subject: string, paper: string, chapter: string}>({subject: "", paper: "", chapter: ""});
  const [formPrefill, setFormPrefill] = useState<{subject: string, paper: string, chapter: string, url?: string} | null>(null);
  const [editingNode, setEditingNode] = useState<{oldName: string, seq: number, label?: string} | null>(null);
  
  // Drag & Drop / Safe Delete States
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [nodePreview, setNodePreview] = useState<string | null>(null); // For Hierarchy image preview
  
  // --- SMART DATA ENGINES ---
  // 1. Auto-Fetch YT Meta Data & Extract Drive Links
  const fetchYTData = async (url: string) => {
    const ytId = getYouTubeID(url);
    if (!ytId) return null;
    const toastId = toast.loading("Scraping YouTube Data... 🔍");
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      if (apiKey) {
        // Use your official API to get the description
        const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${ytId}&part=snippet&key=${apiKey}`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const snippet = data.items[0].snippet;
          const description = snippet.description || "";
          
          // Hunt for Google Drive links hidden anywhere in the description
          const driveRegex = /(https?:\/\/drive\.google\.com\/[^\s\n]+)/g;
          const driveLinks = description.match(driveRegex) || [];

          toast.success("Auto-filled from YouTube! ✨", { id: toastId });
          return { 
            title: snippet.title || "", 
            teacher: snippet.channelTitle || "", 
            thumb: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
            driveLinks: [...new Set(driveLinks)] // Remove any duplicate links
          };
        }
      }

      // Fallback to basic fetch if API key fails
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      toast.success("Auto-filled basic info! ✨", { id: toastId });
      return { title: data.title || "", teacher: data.author_name || "", thumb: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, driveLinks: [] };
    } catch (e) {
      toast.dismiss(toastId);
      return { title: "", teacher: "", thumb: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, driveLinks: [] };
    }
  };

  // 2. Smart Bulk JSON Importer
  const handleSmartJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const importedRows = Array.isArray(json) ? json : json.videos ? json.videos : [json];
        if (importedRows.length === 0) return toast.error("JSON is empty.");
        
        const newRows = importedRows.map((v: any) => ({
          url: v.url || "", title: v.title || "", chapter: v.chapter || formPrefill?.chapter || "", teacher: v.teacher || ""
        }));
        setBulkRows(newRows);
        setIsBulkMode(true);
        toast.success(`Smart Import: Loaded ${newRows.length} classes! 🚀`);
      } catch (err) { toast.error("Invalid JSON format."); }
    };
    reader.readAsText(file); e.target.value = "";
  };
  
  // Client-side WebP Converter for Local Storage Economy
  const convertToWebP = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const MAX = 600; // Compress size to save storage
          if (width > height && width > MAX) { height *= MAX / width; width = MAX; } 
          else if (height > MAX) { width *= MAX / height; height = MAX; }
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.7)); // 70% quality WebP
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const saveHierarchy = async (newH: any) => {
    setHierarchy(newH); // Keep the UI snappy with an instant state update
    
    // Commit the entire configuration tree straight to the Supabase database cloud
    const { error } = await supabase
      .from("platform_config")
      .upsert({ id: "global_hierarchy", config_json: newH, updated_at: new Date().toISOString() });
      
    if (error) {
      toast.error("Database cloud sync failed!");
      console.error(error);
    }
  };

  const fetchDatabase = async () => {
    setLoadingData(true);
    const { data, error } = await supabase.from("videos").select("*").order("id", { ascending: false });
    if (!error && data) setVideos(data);
    setLoadingData(false);
  };

  useEffect(() => {
    fetchDatabase();
    // Fetch the global folder hierarchy structure straight from the DB
    const fetchGlobalHierarchy = async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("config_json")
        .eq("id", "global_hierarchy")
        .single();
      
      let cloudHierarchy = data?.config_json || {};

      // --- AUTO-MIGRATION RECOVERY ---
      // If the cloud only has 0 or 1 subjects, but your local browser has all your old ones, merge them to the cloud!
      const localH = JSON.parse(localStorage.getItem("hsc_hierarchy") || "{}");
      if (Object.keys(localH).length > Object.keys(cloudHierarchy).length) {
        toast.success("Recovering old folders to the Cloud... ☁️", { icon: '🔄' });
        
        // Merge the local data with any new cloud data so nothing is lost
        const mergedHierarchy = { ...localH, ...cloudHierarchy };
        cloudHierarchy = mergedHierarchy;
        
        // Push the recovered data straight to Supabase
        await supabase.from("platform_config").upsert({ 
          id: "global_hierarchy", 
          config_json: mergedHierarchy, 
          updated_at: new Date().toISOString() 
        });
      }
      
      setHierarchy(cloudHierarchy);
    };
    fetchGlobalHierarchy();
  }, []);

  // --- ADMIN NAVIGATION MEMORY ---
  // 1. Restore Admin State on Load
  useEffect(() => {
    const savedState = JSON.parse(localStorage.getItem("hsc_admin_state") || "null");
    if (savedState) {
      if (savedState.activeTab) setActiveTab(savedState.activeTab);
      if (savedState.hPath) setHPath(savedState.hPath);
    }
    if (localStorage.getItem("hsc_admin_auth") === "0000") setIsLocked(false); 
    setIsNavLoaded(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "Mar(140075)") { 
      localStorage.setItem("hsc_admin_auth", "0000");
      setIsLocked(false);
      toast.success("Access Granted! 🔓");
    } else {
      toast.error("Incorrect PIN ❌");
      setPinInput("");
    }
  };

  // 2. Save Admin State automatically when you click around
  useEffect(() => {
    if (isNavLoaded) {
      localStorage.setItem("hsc_admin_state", JSON.stringify({ activeTab, hPath }));
    }
  }, [activeTab, hPath, isNavLoaded]);

  // Watch for smart link triggers to switch tabs
  useEffect(() => {
    if (formPrefill && activeTab !== "add") setActiveTab("add");
  }, [formPrefill, activeTab]);

  // Auto-fetch YT data if prefilled URL is passed to Upload Tab
  useEffect(() => {
    if (activeTab === "add" && formPrefill?.url && !isBulkMode) {
      // 1. Force the URL into the input box visually
      const urlInput = document.getElementById("single_url") as HTMLInputElement;
      if (urlInput) urlInput.value = formPrefill.url;

      // 2. Fetch the metadata (Title & Teacher)
      fetchYTData(formPrefill.url).then(ytData => {
        if (ytData) {
          const titleInput = document.getElementById("single_title") as HTMLInputElement;
          if (titleInput && !titleInput.value) titleInput.value = ytData.title;
          const teachInput = document.getElementsByName("teacher")[0] as HTMLInputElement;
          if (teachInput && !teachInput.value) teachInput.value = ytData.teacher;
        }
      });
    }
  }, [activeTab, formPrefill, isBulkMode]);

  const totalClasses = videos.length;
  const completedClasses = videos.filter(v => v.status === "Watched").length;
  const totalWatchHours = (videos.reduce((acc, curr) => acc + (curr.last_position || 0), 0) / 3600).toFixed(1);

  // --- DATALISTS EXTRACTION ---
  const uniqueSubjectsList = Array.from(new Set(videos.map(v => v.subject).filter(Boolean)));
  const uniquePapersList = Array.from(new Set(videos.map(v => v.paper).filter(Boolean)));
  const uniqueChaptersList = Array.from(new Set(videos.map(v => v.chapter).filter(Boolean)));
  const uniqueTeachersList = Array.from(new Set(videos.map(v => v.teacher).filter(Boolean)));

  const [filterSubject, setFilterSubject] = useState("All");
  const [filterPaper, setFilterPaper] = useState("All");

  // --- ACTIONS: SELECTION & REORDERING ---
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVideos.length && filteredVideos.length > 0) setSelectedIds([]);
    else setSelectedIds(filteredVideos.map(v => v.id));
  };
  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleReorder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === videos.length - 1) return;
    const newVideos = [...videos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newVideos[index];
    newVideos[index] = newVideos[targetIndex];
    newVideos[targetIndex] = temp;
    setVideos(newVideos);
    toast.success("Order changed locally.", { icon: "↕️" });
  };

  const handleShare = (id: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/study/${id}`);
    toast.success("Link copied! 🔗");
  };

  // --- ACTIONS: BULK MOVE ---
  const executeBulkMove = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = { subject: formData.get("subject"), paper: formData.get("paper"), chapter: formData.get("chapter") };
    const toastId = toast.loading(`Moving ${selectedIds.length} classes...`);
    const { error } = await supabase.from("videos").update(updates).in("id", selectedIds);
    if (!error) { toast.success("Classes moved successfully!", { id: toastId }); setSelectedIds([]); setIsMoveModalOpen(false); fetchDatabase(); } 
    else toast.error("Failed to move classes.", { id: toastId });
  };

  // --- ACTIONS: DELETE ---
  const confirmDelete = async () => {
    if (deleteAlertIds.length === 0) return;
    const toastId = toast.loading(`Deleting...`);
    setVideos(videos.filter(v => !deleteAlertIds.includes(v.id))); 
    setSelectedIds([]); 
    const { error } = await supabase.from("videos").delete().in("id", deleteAlertIds);
    if (!error) toast.success("Successfully deleted.", { id: toastId });
    else { toast.error("Failed to delete.", { id: toastId }); fetchDatabase(); }
    setDeleteAlertIds([]);
  };

  // --- ACTIONS: FULL EDIT SYSTEM ---
  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Filter out any empty sheet rows before saving
    const validEditSheets = editSheets.filter(s => s.url.trim() !== "");
    
    const updates = {
      title: formData.get("title"), url: formData.get("url"), subject: formData.get("subject"),
      paper: formData.get("paper"), chapter: formData.get("chapter"), teacher: formData.get("teacher"), tags: formData.get("tags"),
      sheets: validEditSheets
    };
    const toastId = toast.loading("Updating class...");
    const { error } = await supabase.from("videos").update(updates).eq("id", editingVideo.id);
    if (!error) { toast.success("Class updated!", { id: toastId }); setEditingVideo(null); fetchDatabase(); } 
    else toast.error("Failed to update.", { id: toastId });
  };

  // --- ACTIONS: FACTORY RESET (GLOBAL CLOUD WIPE) ---
  const executeFactoryReset = async () => {
    setIsResetting(true);
    const toastId = toast.loading("Initiating Total Cloud Wipe... ☢️");

    try {
      // 1. Wipe Supabase Video Records
      const allIds = videos.map(v => v.id);
      if (allIds.length > 0) {
        const { error: videoError } = await supabase.from("videos").delete().in("id", allIds);
        if (videoError) throw videoError;
      }

      // 2. Clear out the database metadata layout configurations globally
      const { error: configError } = await supabase
        .from("platform_config")
        .upsert({ id: "global_hierarchy", config_json: {}, updated_at: new Date().toISOString() });
      if (configError) throw configError;

      // 3. Update local state instantly
      setVideos([]);
      setHierarchy({});
      setHPath({ subject: "", paper: "", chapter: "" });
      
      toast.success("Database Nuked Successfully! 💥", { id: toastId });
      setShowResetConfirm(false);
    } catch (error) {
      toast.error("Wipe failed. Check database permissions.", { id: toastId });
      console.error(error);
    } finally {
      setIsResetting(false);
    }
  };

  // --- ACTIONS: SMART BULK UPLOAD ---
  const addSheetInput = () => {
    // Automatically pick the next title in the sequence based on how many sheets currently exist
    const nextTitle = SHEET_SEQUENCE[sheets.length] || "Extra Material";
    setSheets([...sheets, { title: nextTitle, url: "" }]);
  };
  const removeSheetInput = (index: number) => setSheets(sheets.filter((_, i) => i !== index));
  const updateSheet = (index: number, field: 'title' | 'url', value: string) => { const newSheets = [...sheets]; newSheets[index][field] = value; setSheets(newSheets); };
  const addBulkRow = () => setBulkRows([...bulkRows, { url: "", title: "", chapter: "" }]);
  const removeBulkRow = (index: number) => setBulkRows(bulkRows.filter((_, i) => i !== index));
  const updateBulkRow = (index: number, field: string, value: string) => { const newRows = [...bulkRows]; newRows[index] = { ...newRows[index], [field]: value }; setBulkRows(newRows); };

  async function handleAddClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoadingForm(true);
    const toastId = toast.loading(isBulkMode ? "Deploying bulk classes..." : "Saving class...");
    const formData = new FormData(e.currentTarget);
    const validSheets = sheets.filter(s => s.url.trim() !== "");
    
    // Ensure default fallback values for the hierarchy
    const subject = formData.get("subject") as string || "Uncategorized"; 
    const paper = formData.get("paper") as string || "General"; 
    const teacher = formData.get("teacher") as string; 
    const manualTags = formData.get("tags") as string;
    
    const newClasses = [];
    const autoTagsArray = [subject, paper, teacher].filter(Boolean).map(str => `#${str.toLowerCase().replace(/\s+/g, '')}`);

    const timestamp = new Date().toISOString(); // Define once to ensure exact sync

    if (isBulkMode) {
      for (const row of bulkRows) {
        if (!row.url.trim()) continue;
        const ytId = getYouTubeID(row.url);
        const durationSecs = ytId ? await fetchYTDuration(ytId) : 0; // Fetch exact time
        
        const chap = row.chapter || "Misc";
        const rowTags = [...autoTagsArray, `#${chap.toLowerCase().replace(/\s+/g, '')}`];
        newClasses.push({ 
          url: row.url, title: row.title, subject, paper, chapter: chap, teacher, 
          tags: manualTags ? `${manualTags}, ${rowTags.join(', ')}` : rowTags.join(', '), 
          sheets: validSheets, status: "New", progress: 0, is_favorite: false, last_position: 0, 
          notes: "", duration: durationSecs, created_at: timestamp 
        });
      }
    } else {
      const singleUrl = formData.get("single_url") as string;
      const ytId = getYouTubeID(singleUrl);
      const durationSecs = ytId ? await fetchYTDuration(ytId) : 0; // Fetch exact time
      
      const chap = formData.get("single_chapter") as string || "Misc";
      const rowTags = [...autoTagsArray, `#${chap.toLowerCase().replace(/\s+/g, '')}`];
      newClasses.push({ 
        url: singleUrl, title: formData.get("single_title") as string, subject, paper, chapter: chap, teacher, 
        tags: manualTags ? `${manualTags}, ${rowTags.join(', ')}` : rowTags.join(', '), 
        sheets: validSheets, status: "New", progress: 0, is_favorite: false, last_position: 0, 
        notes: "", duration: durationSecs, created_at: timestamp 
      });
    }

    const { error } = await supabase.from("videos").insert(newClasses);
    setLoadingForm(false);
    
    if (!error) {
      // --- SMART HIERARCHY AUTO-BUILDER ---
      const newH = { ...hierarchy };
      let hierarchyUpdated = false;
      
      newClasses.forEach(cls => {
        const sub = cls.subject;
        const pap = cls.paper;
        const chap = cls.chapter;
        
        // Grab YouTube thumbnail automatically for new folders
        const ytId = getYouTubeID(cls.url);
        const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "";

        // Auto-create missing nodes
        if (!newH[sub]) { newH[sub] = { img: thumb, seq: Object.keys(newH).length, papers: {} }; hierarchyUpdated = true; }
        if (!newH[sub].papers) newH[sub].papers = {};
        if (!newH[sub].papers[pap]) { newH[sub].papers[pap] = { img: thumb, seq: Object.keys(newH[sub].papers).length, chapters: {} }; hierarchyUpdated = true; }
        if (!newH[sub].papers[pap].chapters) newH[sub].papers[pap].chapters = {};
        if (!newH[sub].papers[pap].chapters[chap]) { newH[sub].papers[pap].chapters[chap] = { img: thumb, seq: Object.keys(newH[sub].papers[pap].chapters).length }; hierarchyUpdated = true; }
      });

      if (hierarchyUpdated) {
        saveHierarchy(newH);
        toast.success("Subject Controls Auto-Synced! 📂", { id: toastId });
      } else {
        toast.success(`${newClasses.length} Class(es) added!`, { id: toastId });
      }

      // 🔥 INSTANT SHOUT: Tells the Navbar and VideoGrid to update immediately!
      window.dispatchEvent(new Event("classAdded"));

      (e.target as HTMLFormElement).reset(); setBulkRows([{ url: "", title: "", chapter: "" }]); setSheets([{ title: "Lecture Slide", url: "" }]);
      fetchDatabase(); setActiveTab("library"); 
    } else {
      // THIS WILL PRINT THE EXACT REASON SUPABASE IS REJECTING IT
      toast.error(`DB Error: ${error.message}`, { id: toastId, duration: 6000 });
      console.error("Full DB Error:", error);
    }
  }

  // --- ACTIONS: FOLDER BGs ---
 


  // --- DATA MAINTENANCE ---
  const [isSyncing, setIsSyncing] = useState(false);
  
  const syncMissingDurations = async () => {
    setIsSyncing(true);
    // Find only videos that are missing duration data
    const videosToUpdate = videos.filter(v => !v.duration || v.duration === 0);
    
    if (videosToUpdate.length === 0) {
      toast.success("All videos already have their times synced! ✨");
      setIsSyncing(false);
      return;
    }

    const toastId = toast.loading(`Syncing time data for ${videosToUpdate.length} videos... Please wait ⏳`);
    let updatedCount = 0;

    for (const v of videosToUpdate) {
      const ytId = getYouTubeID(v.url);
      if (ytId) {
        const durationSecs = await fetchYTDuration(ytId);
        if (durationSecs > 0) {
          await supabase.from("videos").update({ duration: durationSecs }).eq("id", v.id);
          updatedCount++;
        }
      }
    }

    fetchDatabase(); // Refresh the local data to show the new times
    toast.success(`Successfully synced ${updatedCount} video times! ⏱️`, { id: toastId });
    setIsSyncing(false);
  };

  // --- IMPORT / EXPORT ---
  const exportData = async () => {
    toast.loading("Packaging backup...", { id: "export" });
    // Now packages BOTH videos and the folder hierarchy
    const blob = new Blob([JSON.stringify({ videos, hierarchy }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `hsc-master-backup.json`; a.click(); URL.revokeObjectURL(url);
    toast.success("Master Backup Downloaded! 📦", { id: "export" });
  };
  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      toast.loading("Restoring Master Backup...", { id: "import" });
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // 1. Restore Folders (Hierarchy)
        if (json.hierarchy && Object.keys(json.hierarchy).length > 0) {
          await saveHierarchy(json.hierarchy);
          toast.success("Subject Folders Restored! 📂", { id: "import_h" });
        }

        // 2. Restore Videos
        if (json.videos && json.videos.length > 0) {
          const existingUrls = new Set(videos.map(v => v.url));
          const newVideos = json.videos.map((v:any) => ({...v})).filter((v: any) => !existingUrls.has(v.url));
          if (newVideos.length > 0) {
            const { error } = await supabase.from("videos").insert(newVideos);
            if (error) throw error;
            fetchDatabase(); toast.success(`${newVideos.length} classes restored! 🚀`, { id: "import" });
          } else {
            toast.success("Videos already up to date! ✨", { id: "import" });
          }
        }
      } catch (error: any) { toast.error("Corrupted backup file! ❌", { id: "import" }); }
    };
    reader.readAsText(file); e.target.value = ''; 
  };

  // --- FILTERS ---
  let filteredVideos = videos;
  if (filterSubject !== "All") filteredVideos = filteredVideos.filter(v => v.subject === filterSubject);
  if (filterPaper !== "All") filteredVideos = filteredVideos.filter(v => v.paper === filterPaper);
  if (searchTerm) {
    filteredVideos = filteredVideos.filter(v => 
      v.title.toLowerCase().includes(searchTerm.toLowerCase()) || v.chapter?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Prevent UI flashing while Memory Engine restores your location
  if (!isNavLoaded) return <div className="min-h-screen flex items-center justify-center text-indigo-400 font-bold animate-pulse bg-[#0B0F19]">Loading Admin Workstation...</div>;

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black z-0"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-rose-600/10 blur-[120px] z-0"></div>
        <div className="glass-panel p-8 rounded-3xl z-10 w-full max-w-sm border border-white/10 shadow-2xl animate-fade-in flex flex-col items-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 border border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.3)]"><Shield className="text-rose-400 w-8 h-8"/></div>
          <h2 className="text-2xl font-black mb-2 tracking-widest text-white">ADMIN <span className="text-rose-400">PORTAL</span></h2>
          <p className="text-sm text-gray-400 mb-6 text-center">Enter your master PIN to access the workstation.</p>
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
            <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="••••" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center tracking-[1em] text-white focus:outline-none focus:border-rose-500 transition" autoFocus />
            <button type="submit" className="w-full py-3 bg-gradient-to-r from-rose-500 to-orange-500 rounded-xl font-bold text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] jelly hover:scale-105 transition">Unlock Database</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* REUSABLE DATALISTS FOR AUTO-COMPLETE */}
    <datalist id="subjects-list">{uniqueSubjectsList.map(s => <option key={s as string} value={s as string}/>)}</datalist>
    <datalist id="papers-list">{uniquePapersList.map(p => <option key={p as string} value={p as string}/>)}</datalist>
    <datalist id="chapters-list">{uniqueChaptersList.map(c => <option key={c as string} value={c as string}/>)}</datalist>
    <datalist id="teachers-list">{uniqueTeachersList.map(t => <option key={t as string} value={t as string}/>)}</datalist>

    <div className="flex flex-col lg:flex-row min-h-[90vh] gap-6 animate-fade-in">
      
      {/* 📱 SIDEBAR NAVIGATION */}
      <div className="lg:w-64 flex-shrink-0 flex flex-col gap-2">
        <div className="glass-panel p-6 rounded-3xl mb-4 border border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center"><Shield className="text-white w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-lg leading-tight tracking-wider">HSC<span className="text-rose-400">ADMIN</span></h2>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">Control Center</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <button onClick={() => setActiveTab("overview")} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-300 jelly ${activeTab === "overview" ? "bg-white/10 text-white border border-white/10 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}><LayoutDashboard className={`w-4 h-4 ${activeTab === "overview" ? "text-indigo-400" : ""}`} /> Dashboard Overview</button>
          <button onClick={() => setActiveTab("library")} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-300 jelly ${activeTab === "library" ? "bg-white/10 text-white border border-white/10 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}><Library className={`w-4 h-4 ${activeTab === "library" ? "text-fuchsia-400" : ""}`} /> Manage Library</button>
          <button onClick={() => setActiveTab("add")} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-300 jelly ${activeTab === "add" ? "bg-white/10 text-white border border-white/10 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}><PlusCircle className={`w-4 h-4 ${activeTab === "add" ? "text-emerald-400" : ""}`} /> Upload Content</button>
          <button onClick={() => {setActiveTab("hierarchy"); setFormPrefill(null);}} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-300 jelly ${activeTab === "hierarchy" ? "bg-white/10 text-white border border-white/10 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}><Layers className={`w-4 h-4 ${activeTab === "hierarchy" ? "text-cyan-400" : ""}`} /> Subject Controls</button>
          <button onClick={() => setActiveTab("settings")} className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-medium transition-all duration-300 jelly ${activeTab === "settings" ? "bg-white/10 text-white border border-white/10 shadow-inner" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}`}><Settings className={`w-4 h-4 ${activeTab === "settings" ? "text-amber-400" : ""}`} /> System Settings</button>
        </nav>

        <div className="mt-auto pt-8">
          <button onClick={() => router.push('/')} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black/40 border border-white/5 text-gray-400 hover:text-white hover:bg-white/5 transition text-xs font-bold uppercase tracking-wider"><ArrowLeft className="w-3.5 h-3.5" /> Return to Student Hub</button>
        </div>
      </div>

      {/* 🖥️ MAIN CONTENT AREA */}
      <div className="flex-grow glass-panel rounded-3xl border border-white/10 p-6 sm:p-8 min-h-0 relative overflow-hidden flex flex-col">
        
        {/* TAB: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="animate-fade-in flex flex-col h-full">
            <h2 className="text-2xl font-bold mb-6">Platform Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="glass-card p-5 rounded-2xl border-indigo-500/20 bg-indigo-500/5 flex flex-col gap-1"><span className="text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><PlayCircle className="w-3.5 h-3.5" /> Total Classes</span><span className="text-3xl font-bold">{totalClasses}</span></div>
              <div className="glass-card p-5 rounded-2xl border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-1"><span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Completed</span><span className="text-3xl font-bold">{completedClasses}</span></div>
              <div className="glass-card p-5 rounded-2xl border-amber-500/20 bg-amber-500/5 flex flex-col gap-1"><span className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Watch Hours</span><span className="text-3xl font-bold">{totalWatchHours} <span className="text-sm font-normal text-amber-400/60">hrs</span></span></div>
              <div className="glass-card p-5 rounded-2xl border-fuchsia-500/20 bg-fuchsia-500/5 flex flex-col gap-1"><span className="text-fuchsia-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Subjects</span><span className="text-3xl font-bold">{uniqueSubjectsList.length}</span></div>
            </div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Recently Added Content</h3>
            <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {videos.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition">
                  <div className="flex items-center gap-3">
                    <img src={getYouTubeID(v.url) ? `https://img.youtube.com/vi/${getYouTubeID(v.url)}/hqdefault.jpg` : "https://via.placeholder.com/120x68"} className="w-16 h-9 object-cover rounded-md opacity-80" alt="" />
                    <div><p className="text-sm font-medium truncate max-wxs sm:max-w-md">{v.title}</p><p className="text-[10px] text-gray-400">{v.subject} • {v.chapter}</p></div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-300 border border-white/10">{new Date(v.id).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MANAGE LIBRARY */}
        {activeTab === "library" && (
          <div className="animate-fade-in flex flex-col h-full">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 shrink-0">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Library className="text-fuchsia-400 w-6 h-6" /> Content Library</h2>
              
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2 animate-fade-in mr-2">
                    <button onClick={() => setIsMoveModalOpen(true)} className="px-3 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded-xl text-sm font-bold flex items-center gap-1.5 jelly"><FolderInput className="w-4 h-4" /> Move ({selectedIds.length})</button>
                    <button onClick={() => setDeleteAlertIds(selectedIds)} className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl text-sm font-bold flex items-center gap-1.5 jelly"><Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})</button>
                  </div>
                )}
                
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-fuchsia-500">
                  <option value="All">All Subjects</option>
                  {uniqueSubjectsList.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
                </select>
                <select value={filterPaper} onChange={(e) => setFilterPaper(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-fuchsia-500">
                  <option value="All">All Papers</option>
                  {uniquePapersList.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
                </select>

                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition" />
                </div>
                
                <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 shrink-0">
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition jelly ${viewMode === 'list' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}><LayoutList className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition jelly ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}><LayoutGrid className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {loadingData ? (
               <div className="flex items-center justify-center flex-grow text-gray-500 animate-pulse">Querying Database...</div>
            ) : filteredVideos.length === 0 ? (
               <div className="flex flex-col items-center justify-center flex-grow text-gray-500"><Search className="w-12 h-12 mb-3 opacity-20" /><p>No content matches your filters.</p></div>
            ) : (
              <>
                {viewMode === "list" && (
                  <div className="flex-grow overflow-auto rounded-2xl border border-white/10 bg-black/20 custom-scrollbar">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                      <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                          <th className="p-4 w-12 text-center">
                            <div onClick={toggleSelectAll} className={`w-4 h-4 rounded border mx-auto flex items-center justify-center cursor-pointer transition-colors ${selectedIds.length > 0 && selectedIds.length === filteredVideos.length ? 'bg-fuchsia-500 border-fuchsia-500' : 'bg-black/50 border-white/20 hover:border-fuchsia-400'}`}>
                              {selectedIds.length > 0 && selectedIds.length === filteredVideos.length && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                            </div>
                          </th>
                          <th className="p-4 font-medium text-gray-400 uppercase tracking-wider text-[10px] w-24">Media</th>
                          <th className="p-4 font-medium text-gray-400 uppercase tracking-wider text-[10px]">Details</th>
                          <th className="p-4 font-medium text-gray-400 uppercase tracking-wider text-[10px]">Folder Path</th>
                          <th className="p-4 font-medium text-gray-400 uppercase tracking-wider text-[10px]">Status</th>
                          <th className="p-4 font-medium text-gray-400 uppercase tracking-wider text-[10px] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredVideos.map((v, index) => {
                          const ytId = getYouTubeID(v.url);
                          const isSelected = selectedIds.includes(v.id);
                          return (
                            <tr key={v.id} className={`transition ${isSelected ? 'bg-fuchsia-500/10' : 'hover:bg-white/5'}`}>
                              <td className="p-4 text-center">
                                <div onClick={() => toggleSelect(v.id)} className={`w-4 h-4 rounded border mx-auto flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-fuchsia-500 border-fuchsia-500' : 'bg-black/50 border-white/20 hover:border-fuchsia-400'}`}>
                                  {isSelected && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="w-24 h-14 bg-black/50 rounded-lg overflow-hidden relative border border-white/10">
                                  <img src={ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : ""} className="w-full h-full object-cover opacity-80" alt="thumb" />
                                </div>
                              </td>
                              <td className="p-4">
                                <p className="font-medium text-gray-200 max-w-[250px] truncate">{v.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {v.teacher && <span className="text-[10px] text-gray-400 flex items-center gap-1"><BookOpen className="w-3 h-3" /> {v.teacher}</span>}
                                  {v.tags && <span className="text-[10px] text-indigo-400/80 font-mono truncate max-w-[100px]">{v.tags}</span>}
                                </div>
                              </td>
                              <td className="p-4 text-gray-300">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 font-medium text-fuchsia-200/80">{v.subject} {v.paper ? `• ${v.paper}` : ""}</span>
                                  <span className="text-xs truncate max-w-[150px] text-gray-400 font-bold">{v.chapter}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider ${v.progress === 100 ? 'bg-emerald-500/10 text-emerald-400' : v.progress > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                  {v.progress === 100 ? 'Watched' : v.progress > 0 ? `${v.progress}%` : 'New'}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end gap-1.5 items-center">
                                  <div className="flex flex-col border border-white/10 rounded bg-black/40 mr-2">
                                    <button onClick={() => handleReorder(index, 'up')} className="p-0.5 hover:text-white hover:bg-white/10 text-gray-500 transition"><ArrowUp className="w-3 h-3"/></button>
                                    <button onClick={() => handleReorder(index, 'down')} className="p-0.5 hover:text-white hover:bg-white/10 text-gray-500 border-t border-white/10 transition"><ArrowDown className="w-3 h-3"/></button>
                                  </div>
                                  <button onClick={() => handleShare(v.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-green-500/20 hover:text-green-400 transition text-gray-400 jelly"><Share2 className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingVideo(v)} className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 hover:text-amber-400 transition text-gray-400 jelly"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => setDeleteAlertIds([v.id])} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-gray-400 jelly"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {viewMode === "grid" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-auto custom-scrollbar flex-grow content-start pb-4 pr-2">
                    {filteredVideos.map(v => {
                       const ytId = getYouTubeID(v.url);
                       const isSelected = selectedIds.includes(v.id);
                       return (
                         <div key={v.id} className={`glass-panel rounded-2xl border ${isSelected ? 'border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'border-white/5'} overflow-hidden flex flex-col relative transition-all`}>
                           <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur rounded p-1">
                             <div onClick={() => toggleSelect(v.id)} className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-fuchsia-500 border-fuchsia-500' : 'bg-black/50 border-white/20 hover:border-fuchsia-400'}`}>
                               {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>}
                             </div>
                           </div>
                           <div className="relative aspect-video bg-black/50 border-b border-white/5">
                             <img src={ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : "https://via.placeholder.com/640x360"} className="w-full h-full object-cover opacity-80" alt="thumb" />
                           </div>
                           <div className="p-4 flex flex-col flex-grow">
                             <div className="flex items-center gap-2 mb-2">
                               <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-white/5 border border-white/10 text-fuchsia-300">{v.subject} {v.paper ? `• ${v.paper}` : ""}</span>
                               <span className="text-xs text-gray-400 truncate font-bold">{v.chapter}</span>
                             </div>
                             <h3 className="font-semibold text-sm mb-3 line-clamp-2 text-gray-100">{v.title}</h3>
                             <div className="flex justify-end gap-2 border-t border-white/5 pt-3 mt-auto">
                               <button onClick={() => handleShare(v.id)} className="p-2 rounded-xl bg-white/5 hover:bg-green-500/20 hover:text-green-400 transition text-gray-400 jelly"><Share2 className="w-4 h-4" /></button>
                               <button onClick={() => setEditingVideo(v)} className="p-2 rounded-xl bg-white/5 hover:bg-amber-500/20 hover:text-amber-400 transition text-gray-400 jelly"><Edit2 className="w-4 h-4" /></button>
                               <button onClick={() => setDeleteAlertIds([v.id])} className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-gray-400 jelly"><Trash2 className="w-4 h-4" /></button>
                             </div>
                           </div>
                         </div>
                       )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: ADD CLASS (SMART BULK ENTRY) */}
        {activeTab === "add" && (
          <div className="animate-fade-in flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><PlusCircle className="text-emerald-400 w-6 h-6" /> Upload New Content</h2>
            
            <form onSubmit={handleAddClass} className="space-y-6">
              <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-white/5 space-y-4">
                <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-3">
                  <h3 className="font-bold text-gray-200">Global Class Settings</h3>
                  <label className="flex items-center gap-2 text-sm font-bold text-emerald-400 cursor-pointer bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    <input type="checkbox" checked={isBulkMode} onChange={() => setIsBulkMode(!isBulkMode)} className="accent-emerald-500 w-4 h-4" />
                    Multi-Row Bulk Mode
                  </label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Subject <span className="text-rose-500">*</span></label><input type="text" list="subjects-list" name="subject" defaultValue={formPrefill?.subject || ""} required placeholder="e.g. Physics" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-sm" /></div>
                  <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Paper <span className="text-rose-500">*</span></label><input type="text" list="papers-list" name="paper" defaultValue={formPrefill?.paper || ""} required placeholder="e.g. 1st Paper" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-sm" /></div>
                  <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Teacher / Platform</label><input type="text" list="teachers-list" name="teacher" placeholder="e.g. ACS" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-sm" /></div>
                  <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Custom Tags</label><input type="text" name="tags" placeholder="#important" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-sm" /></div>
                </div>
              </div>

              {!isBulkMode ? (
                <>
                  {/* SMART JSON UPLOAD ZONE */}
                  <div className="w-full border border-dashed border-emerald-500/30 rounded-xl p-4 bg-emerald-500/5 hover:bg-emerald-500/10 transition relative group mb-4">
                    <div className="flex flex-col items-center justify-center text-center gap-1">
                      <FileText className="w-6 h-6 text-emerald-400 mb-1" />
                      <span className="text-sm font-bold text-gray-200">Auto-Fill from JSON</span>
                      <span className="text-[10px] text-gray-400">Upload a JSON file containing links. We'll build the bulk list automatically.</span>
                    </div>
                    <input type="file" accept=".json" onChange={handleSmartJSONImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] text-emerald-400 mb-1 uppercase tracking-wider font-bold flex justify-between">YouTube Link <span className="text-rose-500">*</span> <span className="text-gray-500 font-normal">Auto-fetches details</span></label>
                        <input type="url" id="single_url" name="single_url" required placeholder="https://youtu.be/..." 
                          defaultValue={formPrefill?.url || ""}
                          onChange={(e) => {
                            const ytId = getYouTubeID(e.target.value);
                            if (ytId) setPrefetchThumb(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
                            else setPrefetchThumb(null);
                          }}
                          onBlur={async (e) => {
                            if(!e.target.value) return;
                            const ytData = await fetchYTData(e.target.value);
                            if (ytData) {
                              const titleInput = document.getElementById("single_title") as HTMLInputElement;
                              if (titleInput && !titleInput.value) titleInput.value = ytData.title;
                              const teachInput = document.getElementsByName("teacher")[0] as HTMLInputElement;
                              if (teachInput && !teachInput.value) teachInput.value = ytData.teacher;
                              
                              // Magic: Auto-populate the sheets if Drive links were found in the description!
                              if (ytData.driveLinks && ytData.driveLinks.length > 0) {
                                const newSheets = (ytData.driveLinks as string[]).slice(0, 5).map((link: string, i: number) => ({
                                  title: SHEET_SEQUENCE[i] || "Extra Material",
                                  url: link
                                }));
                                setSheets(newSheets);
                                toast.success(`Found ${newSheets.length} Drive link(s) in description! 📄`);
                              }
                            }
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm shadow-inner" />
                        
                        {/* Instant YouTube Thumbnail Verification Preview */}
                        {prefetchThumb && (
                          <div className="mt-3 relative aspect-video w-32 rounded-lg overflow-hidden border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-fade-in">
                             <img src={prefetchThumb} alt="preview" className="w-full h-full object-cover" />
                             <div className="absolute top-1 right-1 bg-emerald-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Verified</div>
                          </div>
                        )}
                      </div>
                      <div><label className="block text-[10px] text-emerald-400 mb-1 uppercase tracking-wider font-bold">Class Title <span className="text-rose-500">*</span></label><input type="text" id="single_title" name="single_title" required placeholder="Vector One Shot - HSC 25" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm shadow-inner" /></div>
                      <div><label className="block text-[10px] text-emerald-400 mb-1 uppercase tracking-wider font-bold">Specific Chapter <span className="text-rose-500">*</span></label><input type="text" list="chapters-list" name="single_chapter" defaultValue={formPrefill?.chapter || ""} required placeholder="e.g. Vector" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition text-sm shadow-inner" /></div>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-white/5 h-full">
                      <label className="block text-xs text-emerald-400 mb-3 uppercase tracking-wider font-bold">Attached Lecture Sheets</label>
                      <div className="space-y-3">
                        {sheets.map((sheet, index) => (
                          <div key={index} className="flex flex-col gap-2 p-3 bg-black/30 rounded-xl border border-white/5 relative group">
                            <input type="text" placeholder="Title (e.g., Practice Sheet)" value={sheet.title} onChange={(e) => updateSheet(index, 'title', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-xs" />
                            <input type="url" placeholder="Google Drive Link..." value={sheet.url} onChange={(e) => updateSheet(index, 'url', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition text-xs" />
                            {sheets.length > 1 && <button type="button" onClick={() => removeSheetInput(index)} className="absolute top-2 right-2 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition">✕</button>}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addSheetInput} className="mt-4 text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition jelly bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20"><PlusCircle className="w-3.5 h-3.5" /> Add Another Sheet</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2"><Shield className="w-4 h-4 text-emerald-400" /> <span className="text-sm font-bold text-gray-300">Bulk Video Rows</span></div>
                  {bulkRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_auto] gap-3 p-4 bg-black/30 border border-white/10 rounded-xl relative group">
                      <input type="url" placeholder="YouTube Link *" value={row.url} 
                        onChange={(e) => updateBulkRow(index, 'url', e.target.value)} 
                        onBlur={async (e) => {
                          if(!e.target.value) return;
                          const ytData = await fetchYTData(e.target.value);
                          if(ytData && !row.title) {
                            const newRows = [...bulkRows];
                            newRows[index] = { ...newRows[index], title: ytData.title };
                            setBulkRows(newRows);
                          }
                        }}
                        className="bg-black/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" required={index === 0} />
                      <input type="text" placeholder="Title *" value={row.title} onChange={(e) => updateBulkRow(index, 'title', e.target.value)} className="bg-black/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" required={index === 0} />
                      <input type="text" list="chapters-list" placeholder="Chapter *" value={row.chapter} onChange={(e) => updateBulkRow(index, 'chapter', e.target.value)} className="bg-black/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" required={index === 0} />
                      {bulkRows.length > 1 && <button type="button" onClick={() => removeBulkRow(index)} className="p-2 text-gray-500 hover:text-rose-400 bg-white/5 rounded-lg transition"><Trash2 className="w-4 h-4"/></button>}
                    </div>
                  ))}
                  <button type="button" onClick={addBulkRow} className="w-full py-3 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-medium text-sm transition flex items-center justify-center gap-2 jelly"><PlusCircle className="w-4 h-4" /> Add Another Row</button>
                </div>
              )}

              <button disabled={loadingForm} type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-xl hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition duration-300 jelly disabled:opacity-50 text-base">
                {loadingForm ? "Processing Transaction..." : isBulkMode ? `Deploy ${bulkRows.length} Classes to Database` : "Deploy Class to Database"}
              </button>
            </form>
          </div>
        )}

        {/* TAB: HIERARCHY (SUBJECT CONTROLS) */}
        {activeTab === "hierarchy" && (
          <div className="animate-fade-in flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Layers className="text-cyan-400 w-6 h-6" /> Subject Controls</h2>
            
            {/* Folder Navigation Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 bg-black/30 p-3 rounded-xl border border-white/5 w-max">
              <button onClick={() => setHPath({subject: "", paper: "", chapter: ""})} className="hover:text-white flex items-center gap-1 transition"><Library className="w-4 h-4"/> Home</button>
              {hPath.subject && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={() => setHPath({...hPath, paper: "", chapter: ""})} className="hover:text-cyan-400 font-bold">{hPath.subject}</button></>}
              {hPath.paper && <><ChevronRight className="w-4 h-4 opacity-50" /><button onClick={() => setHPath({...hPath, chapter: ""})} className="hover:text-cyan-400 font-bold">{hPath.paper}</button></>}
              {hPath.chapter && <><ChevronRight className="w-4 h-4 opacity-50" /><span className="text-cyan-400 font-bold">{hPath.chapter}</span></>}
            </div>

            {/* Smart Add Content Jump (Visible only inside a Chapter) */}
            {hPath.chapter && (
              <div className="mb-6 glass-panel p-6 rounded-2xl border-cyan-500/30 flex justify-between items-center bg-cyan-900/10">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Upload Classes Here</h3>
                  <p className="text-sm text-gray-400">Add videos directly into {hPath.subject} &gt; {hPath.paper} &gt; {hPath.chapter}</p>
                </div>
                <button onClick={() => {
                  const tempUrl = (document.getElementById("node_url_input") as HTMLInputElement)?.value || "";
                  setFormPrefill({subject: hPath.subject, paper: hPath.paper, chapter: hPath.chapter, url: tempUrl});
                }} className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition jelly shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-2">
                  <PlusCircle className="w-5 h-5"/> Add Content
                </button>
              </div>
            )}

            {/* Form for Edits & New Nodes */}
            <form key={editingNode ? editingNode.oldName : 'new_node'} onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get("node_name") as string;
              const label = formData.get("node_label") as string;
              const file = (formData.get("node_img") as File);
              let url = formData.get("node_url") as string;
              
              const toastId = toast.loading("Processing...");
              
              // Smart detect if URL is a YouTube link
              const ytId = getYouTubeID(url);
              if (ytId) url = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
              
              let finalImg = url;
              if (file && file.size > 0) finalImg = await convertToWebP(file);
              
              const newH = { ...hierarchy };
              const targetDict = !hPath.subject ? newH : !hPath.paper ? newH[hPath.subject].papers : newH[hPath.subject].papers[hPath.paper].chapters;
              
              const oldData = targetDict[editingNode?.oldName || name] || {};
              const nodeData = { 
                ...oldData,
                seq: editingNode ? editingNode.seq : Object.keys(targetDict).length, 
                label: label, // Now forces exactly what you typed, even if empty
                papers: oldData.papers || {}, 
                chapters: oldData.chapters || {} 
              };
              
              if (finalImg) nodeData.img = finalImg;
              
              // --- CRITICAL SUPABASE SYNC (Fixes thumbnail disappearing on rename) ---
              if (editingNode && editingNode.oldName !== name) {
                const toastUpdate = toast.loading(`Syncing database links for ${name}...`);
                let updateQuery = supabase.from("videos").update(
                  !hPath.subject ? { subject: name } : 
                  !hPath.paper ? { paper: name } : { chapter: name }
                );
                
                if (!hPath.subject) updateQuery = updateQuery.eq("subject", editingNode.oldName);
                else if (!hPath.paper) updateQuery = updateQuery.eq("subject", hPath.subject).eq("paper", editingNode.oldName);
                else updateQuery = updateQuery.eq("subject", hPath.subject).eq("paper", hPath.paper).eq("chapter", editingNode.oldName);
                
                await updateQuery;
                delete targetDict[editingNode.oldName];
                toast.success("Database fully synced!", { id: toastUpdate });
                fetchDatabase(); // Refresh admin local video state
              }

              targetDict[name] = nodeData;
              saveHierarchy(newH);
              setEditingNode(null);
              setNodePreview(null); // Clear preview after saving
              (e.target as HTMLFormElement).reset();
              toast.success(`${name} saved! 📁`, { id: toastId });
            }} className="glass-panel p-5 rounded-2xl border border-white/5 bg-white/5 space-y-4 mb-8">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-200">{editingNode ? "Edit Mode (Rename & Update)" : `Add New ${!hPath.subject ? "Subject" : !hPath.paper ? "Paper" : "Chapter"}`}</h3>
                {editingNode && <button type="button" onClick={() => { setEditingNode(null); setNodePreview(null); }} className="text-xs text-rose-400 hover:text-rose-300">Cancel Edit</button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end" id="hierarchy-form">
                <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Name <span className="text-gray-500 font-normal">({!hPath.subject ? "e.g. Physics" : "e.g. 1st Paper"})</span></label><input type="text" id="edit_name" name="node_name" defaultValue={editingNode?.oldName || ""} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-500 text-sm" /></div>
                <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Custom Label</label><input type="text" name="node_label" defaultValue={editingNode?.label || ""} placeholder="e.g. Week 1" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-500 text-sm" /></div>
                
                {/* Auto-fill the image URL input if we are editing an existing node */}
                <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Image URL <span className="text-gray-500 font-normal">(Auto YT)</span></label>
                <input type="url" id="node_url_input" name="node_url" 
                  defaultValue={editingNode ? (!hPath.subject ? hierarchy[editingNode.oldName]?.img : !hPath.paper ? hierarchy[hPath.subject].papers[editingNode.oldName]?.img : hierarchy[hPath.subject].papers[hPath.paper].chapters[editingNode.oldName]?.img) || "" : ""} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) { setNodePreview(null); return; }
                    const ytId = getYouTubeID(val);
                    setNodePreview(ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : val);
                  }}
                  placeholder="https://..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-cyan-500 text-sm" /></div>
                
                <div className="relative"><label className="block text-[10px] text-cyan-400 mb-1 uppercase tracking-wider font-bold">Local Upload</label>
                <input type="file" name="node_img" accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setNodePreview(URL.createObjectURL(file));
                  }}
                  className="w-full file:bg-cyan-500/20 file:text-cyan-300 file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:mr-3 file:font-bold file:text-xs text-sm text-gray-400 bg-black/40 border border-white/10 rounded-xl p-1" /></div>
              </div>

              {/* LIVE IMAGE PREVIEW UI */}
              {nodePreview && (
                <div className="mt-1 relative aspect-video w-32 rounded-lg overflow-hidden border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)] animate-fade-in">
                  <img src={nodePreview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1 bg-cyan-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Preview</div>
                </div>
              )}

              <button type="submit" className={`w-full py-3 rounded-xl border border-dashed text-sm font-bold transition jelly ${editingNode ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/10' : 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10'}`}>{editingNode ? "Update Changes" : "Save to Database"}</button>
            </form>

            {/* Folder Grid Display (Ordered & Editable) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(!hPath.subject ? hierarchy : !hPath.paper ? (hierarchy[hPath.subject]?.papers || {}) : (hierarchy[hPath.subject]?.papers[hPath.paper]?.chapters || {}))
                .sort((a: [string, any], b: [string, any]) => (a[1].seq || 0) - (b[1].seq || 0))
                .map(([name, data]: [string, any], index, arr) => (
                <div key={name} 
                  draggable
                  onDragStart={() => setDraggedNode(name)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (!draggedNode || draggedNode === name) return;

                    const newH = { ...hierarchy };
                    const target = !hPath.subject ? newH : !hPath.paper ? newH[hPath.subject].papers : newH[hPath.subject].papers[hPath.paper].chapters;

                    const orderedKeys = arr.map(item => item[0]);
                    const draggedIdx = orderedKeys.indexOf(draggedNode);
                    const dropIdx = orderedKeys.indexOf(name);

                    // Reorder keys
                    orderedKeys.splice(draggedIdx, 1);
                    orderedKeys.splice(dropIdx, 0, draggedNode);

                    // Re-assign sequence safely based on new visual drop order
                    orderedKeys.forEach((key, i) => { target[key].seq = i; });

                    saveHierarchy(newH);
                    setDraggedNode(null);
                  }}
                  onDragEnd={() => setDraggedNode(null)}
                  className={`glass-card rounded-xl p-3 flex flex-col transition cursor-pointer group shadow-lg relative ${draggedNode === name ? 'opacity-40 border-cyan-500 scale-95' : 'border border-white/5 hover:border-cyan-500/50'}`} 
                  onClick={() => {
                    if (!hPath.subject) setHPath({...hPath, subject: name});
                    else if (!hPath.paper) setHPath({...hPath, paper: name});
                    else setHPath({...hPath, chapter: name});
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 overflow-hidden pointer-events-none">
                      <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 flex-shrink-0 bg-cover bg-center" style={{backgroundImage: `url(${data.img || ''})`}}>{!data.img && <ImageIcon className="w-4 h-4 m-auto text-gray-600 mt-2.5"/>}</div>
                      <span className="font-bold text-sm text-gray-200 truncate">{name}</span>
                    </div>
                    <div className="flex gap-1 z-10">
                      <button onClick={(e) => {
                        e.stopPropagation(); 
                        setEditingNode({oldName: name, seq: data.seq, label: data.label});
                        setNodePreview(data.img || null); // Show the existing image immediately
                        document.getElementById('hierarchy-form')?.scrollIntoView({ behavior: 'smooth' });
                      }} className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/30 transition jelly"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => {
                        e.stopPropagation(); setNodeToDelete(name); // <-- Opens the new safety modal!
                      }} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/30 transition jelly"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                  
                  {/* Sequence Reorder Controls */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-auto">
                    <span className="text-[10px] text-gray-500 font-mono">Order: {data.seq !== undefined ? data.seq : index} <span className="opacity-40 ml-1">(Drag to move)</span></span>
                    <div className="flex gap-1 z-10">
                      <button onClick={(e) => {
                        e.stopPropagation(); if (index === 0) return;
                        const newH = { ...hierarchy };
                        const target = !hPath.subject ? newH : !hPath.paper ? newH[hPath.subject].papers : newH[hPath.subject].papers[hPath.paper].chapters;
                        arr.forEach((item, i) => { target[item[0]].seq = i; });
                        const prevName = arr[index - 1][0];
                        const tempSeq = target[name].seq;
                        target[name].seq = target[prevName].seq;
                        target[prevName].seq = tempSeq;
                        saveHierarchy(newH);
                      }} className="p-1 text-gray-400 hover:text-white bg-white/5 rounded transition"><ArrowUp className="w-3 h-3"/></button>
                      <button onClick={(e) => {
                        e.stopPropagation(); if (index === arr.length - 1) return;
                        const newH = { ...hierarchy };
                        const target = !hPath.subject ? newH : !hPath.paper ? newH[hPath.subject].papers : newH[hPath.subject].papers[hPath.paper].chapters;
                        arr.forEach((item, i) => { target[item[0]].seq = i; });
                        const nextName = arr[index + 1][0];
                        const tempSeq = target[name].seq;
                        target[name].seq = target[nextName].seq;
                        target[nextName].seq = tempSeq;
                        saveHierarchy(newH);
                      }} className="p-1 text-gray-400 hover:text-white bg-white/5 rounded transition"><ArrowDown className="w-3 h-3"/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === "settings" && (
          <div className="animate-fade-in overflow-y-auto custom-scrollbar h-full pr-2">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Settings className="text-amber-400 w-6 h-6" /> System Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mb-8">
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 border border-blue-500/30"><Download className="text-blue-400 w-5 h-5" /></div>
                <h3 className="text-lg font-bold mb-2">Create Database Snapshot</h3>
                <p className="text-sm text-gray-400 mb-6 flex-grow">Download a complete JSON backup of all videos to your PC.</p>
                <button onClick={exportData} className="w-full py-3 rounded-xl mt-auto bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/50 text-blue-300 font-medium transition jelly flex justify-center items-center gap-2"><Download className="w-4 h-4" /> Export Data</button>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 border border-amber-500/30"><Upload className="text-amber-400 w-5 h-5" /></div>
                <h3 className="text-lg font-bold mb-2">Restore from Snapshot</h3>
                <p className="text-sm text-gray-400 mb-6 flex-grow">Upload a JSON backup to your app. Duplicates are safely ignored.</p>
                <label className="w-full py-3 rounded-xl mt-auto bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-300 font-medium transition jelly flex justify-center items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" /> Import Data
                  <input type="file" className="hidden" accept=".json" onChange={importData} />
                </label>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 border border-emerald-500/30"><Clock className="text-emerald-400 w-5 h-5" /></div>
                <h3 className="text-lg font-bold mb-2">Sync Missing Video Times</h3>
                <p className="text-sm text-gray-400 mb-6 flex-grow">Scans database for older videos and auto-fetches duration from YouTube.</p>
                <button disabled={isSyncing} onClick={syncMissingDurations} className="w-full py-3 rounded-xl mt-auto bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 text-emerald-300 font-medium transition jelly flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Clock className="w-4 h-4" /> {isSyncing ? "Syncing API..." : "Start Time Sync"}
                </button>
              </div>
            </div>

           {/* The Folder Backgrounds UI has been moved to the new Subject Controls Tab */}

            <div className="max-w-3xl glass-panel border border-red-500/30 bg-red-500/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none"><AlertTriangle className="w-32 h-32 text-red-500" /></div>
              <h3 className="text-lg font-bold text-red-400 mb-2 relative z-10">Danger Zone</h3>
              <p className="text-sm text-gray-400 mb-6 relative z-10 max-w-lg">Actions taken here are permanent. Ensure you have exported a snapshot first.</p>
              <button onClick={() => setShowResetConfirm(true)} className="px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/50 font-bold transition jelly relative z-10 text-sm shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)]">
                Factory Reset Database
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* CUSTOM BULK MOVE MODAL */}
    {isMoveModalOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMoveModalOpen(false)}></div>
        <form onSubmit={executeBulkMove} className="glass-panel w-full max-w-md rounded-2xl p-6 relative z-10 animate-fade-in shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><FolderInput className="w-5 h-5 text-indigo-400"/> Move {selectedIds.length} Classes</h3>
            <button type="button" onClick={() => setIsMoveModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
          </div>
          
          <div className="space-y-4 mb-6">
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Target Subject</label><input type="text" list="subjects-list" name="subject" required placeholder="e.g. Physics" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition text-sm" /></div>
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Target Paper</label><input type="text" list="papers-list" name="paper" required placeholder="e.g. 1st Paper" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition text-sm" /></div>
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Target Chapter</label><input type="text" list="chapters-list" name="chapter" required placeholder="e.g. Vector" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition text-sm" /></div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition jelly shadow-[0_0_15px_rgba(99,102,241,0.4)]">Confirm Move</button>
        </form>
      </div>
    )}

    {/* CUSTOM EDIT MODAL */}
    {editingVideo && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingVideo(null)}></div>
        <form onSubmit={submitEdit} className="glass-panel w-full max-w-lg rounded-2xl p-6 relative z-10 animate-fade-in shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Edit2 className="w-5 h-5 text-amber-400"/> Edit Class</h3>
            <button type="button" onClick={() => setEditingVideo(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
          </div>
          <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Title</label><input type="text" name="title" defaultValue={editingVideo.title} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">YouTube URL</label><input type="url" name="url" defaultValue={editingVideo.url} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Subject</label><input type="text" list="subjects-list" name="subject" defaultValue={editingVideo.subject} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
              <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Paper</label><input type="text" list="papers-list" name="paper" defaultValue={editingVideo.paper} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Chapter</label><input type="text" list="chapters-list" name="chapter" defaultValue={editingVideo.chapter} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
              <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Teacher</label><input type="text" list="teachers-list" name="teacher" defaultValue={editingVideo.teacher} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
            </div>
            <div><label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">Tags</label><input type="text" name="tags" defaultValue={editingVideo.tags} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-sm" /></div>
            
            {/* GOOGLE DRIVE / LECTURE SHEETS EDITOR */}
            <div className="glass-panel p-4 rounded-xl border border-white/5 bg-black/20 mt-2">
              <label className="block text-[10px] text-emerald-400 mb-3 uppercase tracking-wider font-bold">Attached Lecture Sheets (PDF/Drive)</label>
              <div className="space-y-3">
                {editSheets.map((sheet, index) => (
                  <div key={index} className="flex flex-col gap-2 relative group">
                    <input type="text" placeholder="Title (e.g., Lecture Slide)" value={sheet.title} onChange={(e) => { const newSheets = [...editSheets]; newSheets[index].title = e.target.value; setEditSheets(newSheets); }} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-500 outline-none text-xs" />
                    <input type="url" placeholder="Google Drive Link..." value={sheet.url} onChange={(e) => { const newSheets = [...editSheets]; newSheets[index].url = e.target.value; setEditSheets(newSheets); }} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-500 outline-none text-xs" />
                    {editSheets.length > 1 && <button type="button" onClick={() => setEditSheets(editSheets.filter((_, i) => i !== index))} className="absolute top-1 right-2 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition">✕</button>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setEditSheets([...editSheets, { title: "Lecture Slide", url: "" }])} className="mt-3 text-[10px] flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition font-bold uppercase tracking-wider"><PlusCircle className="w-3.5 h-3.5" /> Add Another Sheet</button>
            </div>

          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition jelly shadow-[0_0_15px_rgba(245,158,11,0.4)]">Save Changes</button>
        </form>
      </div>
    )}

    {/* CUSTOM DELETE MODAL */}
    {deleteAlertIds.length > 0 && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteAlertIds([])}></div>
        <div className="glass-panel w-full max-w-sm rounded-2xl p-6 relative z-10 animate-fade-in text-center shadow-2xl shadow-red-900/20">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20"><Trash2 className="w-7 h-7 text-red-400" /></div>
          <h3 className="text-xl font-bold mb-2">Delete {deleteAlertIds.length > 1 ? `${deleteAlertIds.length} Classes` : 'Class'}?</h3>
          <p className="text-sm text-gray-400 mb-6">Are you sure you want to permanently remove this from the global database?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteAlertIds([])} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-medium jelly">Cancel</button>
            <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)] jelly">Yes, Delete</button>
          </div>
        </div>
      </div>
    )}
    {/* CUSTOM HIERARCHY DELETE MODAL */}
    {nodeToDelete && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNodeToDelete(null)}></div>
        <div className="glass-panel w-full max-w-sm rounded-2xl p-6 relative z-10 animate-fade-in text-center shadow-2xl shadow-red-900/20">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20"><Trash2 className="w-7 h-7 text-red-400" /></div>
          <h3 className="text-xl font-bold mb-2">Delete "{nodeToDelete}"?</h3>
          <p className="text-sm text-gray-400 mb-6">This will permanently remove the folder. Videos inside will remain in the database but lose this folder mapping.</p>
          <div className="flex gap-3">
            <button onClick={() => setNodeToDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-medium jelly">Cancel</button>
            <button onClick={() => {
              const newH = { ...hierarchy };
              const target = !hPath.subject ? newH : !hPath.paper ? newH[hPath.subject].papers : newH[hPath.subject].papers[hPath.paper].chapters;
              delete target[nodeToDelete]; 
              saveHierarchy(newH);
              setNodeToDelete(null);
              toast.success(`Deleted successfully!`);
            }} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white transition font-medium shadow-[0_0_15px_rgba(239,68,68,0.3)] jelly">Yes, Delete</button>
          </div>
        </div>
      </div>
    )}

    {/* CUSTOM FACTORY RESET MODAL */}
    {showResetConfirm && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !isResetting && setShowResetConfirm(false)}></div>
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 relative z-10 animate-fade-in text-center shadow-2xl shadow-red-900/40 border border-red-500/30">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-black text-red-400 mb-3 uppercase tracking-widest">Total Wipe</h3>
          <p className="text-sm text-gray-300 mb-8 leading-relaxed">
            This will <span className="font-bold text-white">permanently delete ALL classes</span> from Supabase and wipe your production Subject Controls configuration. Make sure you exported a backup snapshot first!
          </p>
          <div className="flex gap-4">
            <button disabled={isResetting} onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-bold jelly">
              Cancel
            </button>
            <button disabled={isResetting} onClick={executeFactoryReset} className="flex-1 px-4 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white transition font-bold shadow-[0_0_20px_rgba(220,38,38,0.5)] jelly disabled:opacity-50 flex items-center justify-center gap-2">
              {isResetting ? "Wiping Cloud Data..." : "Nuke Database"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
