"use client";

import { useState } from "react";
import { Search, Filter, Plus, FileVideo, FileAudio, FileImage, FileText, MoreVertical, LayoutGrid, List, X } from "lucide-react";
import { deleteImageAction } from "@/app/actions/image-actions";
import { deleteVideoAction } from "@/app/actions/video-actions";
import { deleteVoiceAction } from "@/app/actions/voice-actions";
import { deleteLessonAction } from "@/app/actions/ai-actions";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type AssetType = 'lesson' | 'video' | 'audio' | 'image' | 'document';

export type Asset = {
  id: string;
  name: string;
  type: AssetType;
  date: string;
  url?: string;
  script?: string;
  description?: string;
};

export function MediaClient({ initialAssets, defaultTab = 'All' }: { initialAssets: Asset[], defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const router = useRouter();

  const tabs = ['All', 'Lessons', 'Videos', 'Audio', 'Images'];

  const getIcon = (type: string) => {
    switch(type) {
      case 'video': return <FileVideo className="w-8 h-8 text-blue-400" />;
      case 'image': return <FileImage className="w-8 h-8 text-emerald-400" />;
      case 'audio': return <FileAudio className="w-8 h-8 text-violet-400" />;
      case 'lesson': return <FileText className="w-8 h-8 text-indigo-400" />;
      default: return <FileText className="w-8 h-8 text-orange-400" />;
    }
  };

  const getBg = (type: string) => {
    switch(type) {
      case 'video': return 'bg-blue-500/10 border-blue-500/20';
      case 'image': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'audio': return 'bg-violet-500/10 border-violet-500/20';
      case 'lesson': return 'bg-indigo-500/10 border-indigo-500/20';
      default: return 'bg-orange-500/10 border-orange-500/20';
    }
  };

  const filteredAssets = initialAssets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesTab = false;
    if (activeTab === 'All') matchesTab = true;
    else if (activeTab === 'Lessons' && asset.type === 'lesson') matchesTab = true;
    else if (activeTab === 'Videos' && asset.type === 'video') matchesTab = true;
    else if (activeTab === 'Audio' && asset.type === 'audio') matchesTab = true;
    else if (activeTab === 'Images' && asset.type === 'image') matchesTab = true;

    return matchesSearch && matchesTab;
  });

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;
    setIsDeleting(asset.id);
    setActiveDropdown(null);
    let success = false;
    let errorMsg = "Failed to delete";
    try {
      if (asset.type === 'image') {
        const res = await deleteImageAction(asset.id);
        success = res.success; errorMsg = res.error || errorMsg;
      } else if (asset.type === 'video') {
        const res = await deleteVideoAction(asset.id);
        success = res.success; errorMsg = res.error || errorMsg;
      } else if (asset.type === 'audio') {
        const res = await deleteVoiceAction(asset.id);
        success = res.success; errorMsg = res.error || errorMsg;
      } else if (asset.type === 'lesson') {
        const res = await deleteLessonAction(asset.id);
        success = res.success; errorMsg = res.error || errorMsg;
      }
    } catch (e) {
      console.error(e);
    }
    setIsDeleting(null);
    if (!success) alert(errorMsg);
  };

  const handleDownload = (asset: Asset) => {
    setActiveDropdown(null);
    if (asset.url) {
      let extension = '';
      if (asset.type === 'video') extension = '.mp4';
      else if (asset.type === 'audio') extension = '.mp3';
      else if (asset.type === 'image') extension = '.jpg';
      const filename = `${asset.name.replace(/\s+/g, '_')}_${new Date().getTime()}${extension}`;
      
      const proxyUrl = `/api/download?url=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(filename)}`;
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (asset.script || asset.description) {
      // It's a text-based asset like a lesson
      let content = asset.script || asset.description || '';
      try {
        // Pretty print if it's JSON
        const parsed = JSON.parse(content);
        content = JSON.stringify(parsed, null, 2);
      } catch (e) {}
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${asset.name.replace(/\s+/g, '_')}_${new Date().getTime()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full max-w-7xl backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px]">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border/50 pb-4 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                : 'bg-background/50 border border-transparent text-muted-foreground hover:bg-background hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 relative z-10">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search assets..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/50 border border-border rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors text-sm font-medium">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <div className="flex bg-background/50 border border-border/50 rounded-xl p-1">
            <button className="p-1.5 rounded-lg bg-background shadow-sm"><LayoutGrid className="w-4 h-4" /></button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 relative z-10">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p>No media found in this category.</p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div key={asset.id} className="group relative rounded-2xl border border-border/50 bg-background/30 hover:bg-background/50 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col" onClick={() => setSelectedAsset(asset)}>
              <div className={`h-32 rounded-t-2xl flex items-center justify-center border-b border-border/50 relative overflow-hidden ${getBg(asset.type)}`}>
                {asset.url && asset.type === 'image' ? (
                  <Image src={asset.url} alt={asset.name} fill className="object-cover w-full h-full" />
                ) : getIcon(asset.type)}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between relative">
                <div>
                  <h3 className="font-semibold text-sm truncate pr-6" title={asset.name}>{asset.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{asset.type}</p>
                </div>
                <div className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                  <span>{asset.date}</span>
                </div>
                
                {/* Dropdown Container */}
                <div className="absolute top-2 right-2 flex flex-col items-end z-20" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === asset.id ? null : asset.id)}
                    className="p-1.5 rounded-lg bg-black/20 text-foreground hover:bg-black/40 hover:text-white transition-all backdrop-blur-md"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {activeDropdown === asset.id && (
                    <div className="absolute top-8 right-0 w-40 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                      <button onClick={() => handleDownload(asset)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium">Download</button>
                      {asset.type === 'lesson' && (
                        <button onClick={() => router.push(`/dashboard/lesson-generator?lessonId=${asset.id}`)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium text-indigo-400">Convert to Video</button>
                      )}
                      <div className="border-t border-border/50 my-1"></div>
                      <button onClick={() => handleDelete(asset)} disabled={isDeleting === asset.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors font-medium text-red-500 flex items-center gap-2">
                        {isDeleting === asset.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedAsset(null)}>
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50">
              <h3 className="font-bold text-lg truncate pr-8">{selectedAsset.name}</h3>
              <button onClick={() => setSelectedAsset(null)} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-black/20 relative">
              {selectedAsset.type === 'video' && selectedAsset.url && (
                <video src={selectedAsset.url} controls className="max-w-full max-h-[60vh] rounded-xl shadow-lg" autoPlay />
              )}
              {selectedAsset.type === 'audio' && (
                <div className="w-full max-w-2xl text-left flex flex-col items-center space-y-6 mt-4">
                  {selectedAsset.url ? (
                    <audio src={selectedAsset.url} controls className="w-full shadow-lg rounded-full" autoPlay />
                  ) : (
                    <div className="w-full bg-background/50 border border-border p-3 rounded-full flex items-center justify-between shadow-lg">
                       <div className="flex items-center gap-3 ml-4">
                         <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                           <FileAudio className="w-4 h-4 text-violet-500" />
                         </div>
                         <span className="text-sm font-medium">Text-to-Speech Preview</span>
                       </div>
                       <button 
                         onClick={(e) => {
                           const target = e.currentTarget;
                           if (target.textContent?.includes("Stop")) {
                             window.speechSynthesis.cancel();
                             target.innerHTML = "Play Audio";
                           } else {
                             const utterance = new SpeechSynthesisUtterance(selectedAsset.script || "");
                             utterance.onend = () => { target.innerHTML = "Play Audio"; };
                             window.speechSynthesis.cancel();
                             window.speechSynthesis.speak(utterance);
                             target.innerHTML = "Stop Audio";
                           }
                         }} 
                         className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm rounded-full transition-colors w-32 text-center"
                       >
                         Play Audio
                       </button>
                    </div>
                  )}
                  {selectedAsset.script && (
                    <div className="w-full bg-background/50 p-6 rounded-xl border border-border">
                      <h4 className="font-bold text-violet-400 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Generated Script
                      </h4>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedAsset.script}</p>
                    </div>
                  )}
                </div>
              )}
              {selectedAsset.type === 'image' && selectedAsset.url && (
                <div className="relative w-full h-[60vh]">
                  <Image src={selectedAsset.url} alt={selectedAsset.name} fill className="object-contain drop-shadow-2xl" unoptimized />
                </div>
              )}
              {selectedAsset.type === 'lesson' && (
                <div className="w-full max-w-3xl mx-auto text-left space-y-6">
                  {selectedAsset.description && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl">
                      <h4 className="font-bold text-indigo-400 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Summary
                      </h4>
                      <p className="text-sm leading-relaxed">{selectedAsset.description}</p>
                    </div>
                  )}
                  {selectedAsset.script && (
                    <div className="bg-background/80 p-6 rounded-2xl border border-border shadow-inner">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" /> Lesson Content
                      </h4>
                      <div className="text-sm leading-relaxed overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap max-h-[40vh]">
                        {(() => {
                          try {
                            const parsed = JSON.parse(selectedAsset.script);
                            return JSON.stringify(parsed, null, 2);
                          } catch (e) {
                            return selectedAsset.script;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border/50 flex justify-end gap-3 bg-background/50">
              {selectedAsset.type === 'lesson' && (
                <button 
                  onClick={() => router.push(`/dashboard/lesson-generator?lessonId=${selectedAsset.id}`)}
                  className="px-5 py-2.5 rounded-xl font-bold transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                >
                  Convert to Video
                </button>
              )}
              <button 
                onClick={() => handleDownload(selectedAsset)}
                className="px-5 py-2.5 rounded-xl font-bold transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
