"use client";

import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Video, Image as ImageIcon, MonitorPlay, FileText, ArrowUpRight, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, isAfter, parseISO } from "date-fns";

type DataPoint = { id: string; created_at: string };

interface AnalyticsClientProps {
  initialData: {
    videos: DataPoint[];
    images: DataPoint[];
    youtubeUploads: DataPoint[];
  };
}

export default function AnalyticsClient({ initialData }: AnalyticsClientProps) {
  const [timeRange, setTimeRange] = useState(30);

  // Filter data based on timeRange
  const cutoffDate = subDays(new Date(), timeRange);
  
  const filterByDate = (arr: DataPoint[]) => arr.filter(item => isAfter(parseISO(item.created_at), cutoffDate));

  const filteredVideos = filterByDate(initialData.videos);
  const filteredImages = filterByDate(initialData.images);
  const filteredUploads = filterByDate(initialData.youtubeUploads);

  const totalContent = filteredVideos.length + filteredImages.length + filteredUploads.length;

  // Group by date for area chart
  const chartDataMap: Record<string, number> = {};
  
  // Initialize last X days with 0
  for (let i = timeRange - 1; i >= 0; i--) {
    const d = subDays(new Date(), i);
    chartDataMap[format(d, 'MMM d')] = 0;
  }

  const addToChart = (arr: DataPoint[]) => {
    arr.forEach(item => {
      const dateStr = format(parseISO(item.created_at), 'MMM d');
      if (chartDataMap[dateStr] !== undefined) {
        chartDataMap[dateStr]++;
      }
    });
  };

  addToChart(filteredVideos);
  addToChart(filteredImages);
  addToChart(filteredUploads);

  const chartData = Object.entries(chartDataMap).map(([name, views]) => ({ name, views }));

  const pieData = [
    { name: 'Videos', value: filteredVideos.length },
    { name: 'Images', value: filteredImages.length },
    { name: 'YouTube', value: filteredUploads.length },
  ].filter(d => d.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#ef4444'];

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-green-500" />
            Content Analytics
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            Track your AI generation and upload activity over time.
          </p>
        </div>
        
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="bg-background/50 border border-border/50 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none transition-all appearance-none font-medium shadow-sm"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
          <option value={365}>This Year</option>
        </select>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { title: 'Total Generated', value: totalContent, icon: Activity, color: 'text-green-500' },
          { title: 'AI Videos', value: filteredVideos.length, icon: Video, color: 'text-blue-500' },
          { title: 'AI Images', value: filteredImages.length, icon: ImageIcon, color: 'text-emerald-500' },
          { title: 'YouTube Uploads', value: filteredUploads.length, icon: MonitorPlay, color: 'text-red-500' }
        ].map((stat, i) => (
          <div key={i} className="backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-border transition-colors">
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 rounded-xl bg-background/50 border border-border/50">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            
            <div className="relative z-10">
              <p className="text-muted-foreground font-medium text-sm mb-1">{stat.title}</p>
              <h3 className="text-3xl font-extrabold">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden min-h-[400px] flex flex-col">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100vw] md:w-[500px] h-32 bg-green-500/10 blur-3xl pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Generation Activity
            </h2>
          </div>

          <div className="flex-1 relative z-10 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#22c55e' }}
                  labelStyle={{ color: '#fff', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="views" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col">
          <h2 className="text-xl font-bold mb-6 relative z-10">Content Distribution</h2>
          
          <div className="flex-1 relative z-10 flex flex-col items-center justify-center">
            {pieData.length > 0 ? (
              <>
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 w-full">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                      <span className="text-sm font-medium text-muted-foreground">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full w-full text-muted-foreground text-sm">
                No data for this period
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
