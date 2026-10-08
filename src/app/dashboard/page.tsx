import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCustomUser } from '@/lib/auth/session';
import { Video, Image as ImageIcon, MessageSquare, FileVideo, BookOpen, Mic, Type, PlayCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Dashboard",
  description: "Manage your AI-generated content, media library, and schedules.",
};

export default async function DashboardPage() {
  const { data: { user } } = await getCustomUser();

  if (!user) {
    return null;
  }

  const isFirstLogin = user.user_metadata?.is_first_login === true;
  const userName = user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Creator';
  
  const supabase = await createClient();

  if (isFirstLogin) {
    // Reset the flag so next time it says Welcome Back
    supabase.auth.updateUser({ data: { is_first_login: false } }).catch(console.error);
  }
  const [
    { count: totalContent },
    { count: drafts },
    { count: processing },
    { count: scheduled },
    { count: published },
    { count: savedImages },
    { count: savedVideos },
    { count: savedVoices },
    { data: recentContent }
  ] = await Promise.all([
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'draft'),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'processing'),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'scheduled'),
    supabase.from('content').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published'),
    supabase.from('saved_images').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('saved_videos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('saved_voices').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('content').select('id, title, status, created_at, content_type').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
  ]);

  const mediaLibraryCount = (savedImages || 0) + (savedVideos || 0) + (savedVoices || 0);

  const getIcon = (type: string) => {
    switch (type) {
      case 'lesson': return <BookOpen className="h-5 w-5" />;
      case 'short_video': return <FileVideo className="h-5 w-5" />;
      case 'long_video': return <Video className="h-5 w-5" />;
      case 'social_post': return <MessageSquare className="h-5 w-5" />;
      default: return <ImageIcon className="h-5 w-5" />;
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const dashboardStats = [
    { title: 'Live Processing', value: processing || 0, desc: 'Content actively generating', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
    { title: 'Media Library', value: mediaLibraryCount, desc: 'Saved images, videos, and voices', color: 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30' },
    { title: 'Total Tools', value: 6, desc: 'Available creative tools', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' },
    { title: 'Total Schedules', value: scheduled || 0, desc: 'Content scheduled for posting', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
    { title: 'Total Content', value: totalContent || 0, desc: 'All your educational assets', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
    { title: 'Published', value: published || 0, desc: 'Live on your platforms', color: 'bg-green-500/10 text-green-500 border-green-500/30' },
    { title: 'Drafts', value: drafts || 0, desc: 'Ideas waiting to be fleshed out', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
    { title: 'Storage Used', value: '1.2 GB', desc: 'Total storage consumed', color: 'bg-violet-500/10 text-violet-500 border-violet-500/30' }
  ];

  return (
    <div className="space-y-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen">
      {/* Header section with responsive layout */}
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 glass-card p-6 md:p-8 border-white/5">
        <div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground flex items-center gap-3 drop-shadow-sm">
            {isFirstLogin ? `Welcome ${userName} 🎉` : `Welcome Back ${userName} 👋`}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-2 font-medium">Here is what is happening with your content today.</p>
        </div>
        <Link href="/dashboard/lesson-generator" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 transition-all w-full md:w-auto">
          <PlayCircle className="mr-2 h-5 w-5" /> Quick Start
        </Link>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>
      </div>

      {/* Stats Grid - Fluid responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {dashboardStats.map((stat, i) => (
          <div key={i} className={`glass-card p-6 relative overflow-hidden group border ${stat.color.split(' ')[2]}`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-30 ${stat.color.split(' ')[0]}`}></div>
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 relative z-10">{stat.title}</h3>
            <div className={`text-4xl md:text-5xl font-extrabold mb-2 relative z-10 ${stat.color.split(' ')[1]}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground relative z-10 font-medium">{stat.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-7">
        {/* Recent Content */}
        <div className="lg:col-span-4 glass-card p-6 md:p-8 relative overflow-hidden flex flex-col min-h-[400px]">
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 mix-blend-screen"></div>
          <div className="mb-6 relative z-10 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold tracking-tight">Recent Content</h2>
            <p className="text-muted-foreground mt-1 text-sm">Your recently generated or edited content.</p>
          </div>
          
          <div className="flex-1 relative z-10">
            {recentContent && recentContent.length > 0 ? (
              <div className="space-y-3">
                {recentContent.map((item: { id: string; title: string; status: string; created_at: string; content_type: string }) => (
                  <Link key={item.id} href={`/dashboard/media/${item.id}`} className="flex flex-col sm:flex-row sm:items-center gap-4 glass p-4 rounded-2xl transition-all hover:bg-white/5 group border border-white/5 hover:border-primary/30">
                    <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
                      {getIcon(item.content_type)}
                    </div>
                    <div className="flex-1 space-y-1 truncate">
                      <p className="text-sm md:text-base font-bold leading-none truncate text-foreground group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-xs text-muted-foreground font-medium">{getRelativeTime(item.created_at)}</p>
                    </div>
                    <div className={`self-start sm:self-center font-bold text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-lg shadow-sm ${
                      item.status === 'published' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      item.status === 'draft' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-black/20 backdrop-blur-sm">
                <p className="text-muted-foreground mb-6 font-medium">You haven't created any content yet.</p>
                <Link href="/dashboard/lesson-generator" className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                  Create your first content
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="lg:col-span-3 glass-card p-6 md:p-8 relative overflow-hidden flex flex-col">
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen"></div>
          <div className="mb-6 relative z-10 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold tracking-tight">Quick Actions</h2>
            <p className="text-muted-foreground mt-1 text-sm">Start creating new content.</p>
          </div>
          
          <div className="grid gap-4 relative z-10">
            <Link href="/dashboard/lesson-generator" className="group flex items-center gap-4 p-5 rounded-2xl bg-primary/90 text-white hover:bg-primary transition-all shadow-[0_8px_32px_rgba(99,102,241,0.3)] font-bold border border-primary-light">
              <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-lg">Generate AI Lesson</span>
            </Link>
            <Link href="/dashboard/voice-studio" className="group flex items-center gap-4 p-5 rounded-2xl glass hover:bg-white/10 transition-all font-bold border border-white/10 hover:border-violet-500/40">
              <div className="p-2 bg-violet-500/10 rounded-xl group-hover:scale-110 group-hover:bg-violet-500/20 transition-all">
                <Mic className="w-6 h-6 text-violet-400" />
              </div>
              <span className="text-lg">Voice Studio</span>
            </Link>
            <Link href="/dashboard/thumbnail-generator" className="group flex items-center gap-4 p-5 rounded-2xl glass hover:bg-white/10 transition-all font-bold border border-white/10 hover:border-blue-500/40">
              <div className="p-2 bg-blue-500/10 rounded-xl group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                <ImageIcon className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-lg">Thumbnails</span>
            </Link>
            <Link href="/dashboard/captions" className="group flex items-center gap-4 p-5 rounded-2xl glass hover:bg-white/10 transition-all font-bold border border-white/10 hover:border-pink-500/40">
              <div className="p-2 bg-pink-500/10 rounded-xl group-hover:scale-110 group-hover:bg-pink-500/20 transition-all">
                <Type className="w-6 h-6 text-pink-400" />
              </div>
              <span className="text-lg">Captions & Shorts</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
