"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Video, Mic, User, Image as ImageIcon, BookOpen, Type, Upload, Link as LinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const generateItems = [
  {
    title: "Script Generator",
    href: "/dashboard/media/new?type=lesson",
    description: "Create structured educational scripts instantly.",
    icon: <Type className="h-4 w-4 text-indigo-400" />,
  },
  {
    title: "Voice Studio",
    href: "/dashboard/voice-studio",
    description: "Generate lifelike AI voiceovers for your content.",
    icon: <Mic className="h-4 w-4 text-violet-400" />,
  },
  {
    title: "Avatar Studio",
    href: "/dashboard/avatar-studio",
    description: "Create talking head videos with AI avatars.",
    icon: <User className="h-4 w-4 text-fuchsia-400" />,
  },
  {
    title: "Thumbnail Generator",
    href: "/dashboard/thumbnail-generator",
    description: "Design eye-catching thumbnails that drive clicks.",
    icon: <ImageIcon className="h-4 w-4 text-blue-400" />,
  },
];

const buildItems = [
  {
    title: "Lesson Builder",
    href: "/dashboard/lesson-generator",
    description: "Construct comprehensive lessons with interactive elements.",
    icon: <BookOpen className="h-4 w-4 text-emerald-400" />,
  },
  {
    title: "Video Editor",
    href: "/dashboard/media",
    description: "Assemble and edit your generated video clips.",
    icon: <Video className="h-4 w-4 text-rose-400" />,
  },
  {
    title: "Caption Generator",
    href: "/dashboard/captions",
    description: "Auto-generate accurate captions for accessibility.",
    icon: <Type className="h-4 w-4 text-amber-400" />,
  },
];

const uploadItems = [
  {
    title: "Upload Media",
    href: "/dashboard/media/new",
    description: "Import your existing videos, audio, or scripts.",
    icon: <Upload className="h-4 w-4 text-slate-400" />,
  },
  {
    title: "Import from URL",
    href: "/dashboard/media/new",
    description: "Fetch content directly from a YouTube link or blog post.",
    icon: <LinkIcon className="h-4 w-4 text-cyan-400" />,
  },
];

export function ExploreDropdown() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent text-sm font-medium text-muted-foreground transition-colors hover:text-foreground p-0 h-auto">
            Explore
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[90vw] md:w-[600px] lg:w-[800px] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 glass-card rounded-xl border border-border/50 shadow-2xl">
              
              {/* Column 1: Generate */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2 mb-2">Generate</h4>
                <ul className="grid gap-2">
                  {generateItems.map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      href={component.href}
                      icon={component.icon}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </div>

              {/* Column 2: Build */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2 mb-2">Build</h4>
                <ul className="grid gap-2">
                  {buildItems.map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      href={component.href}
                      icon={component.icon}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
              </div>

              {/* Column 3: Upload */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2 mb-2">Upload</h4>
                <ul className="grid gap-2">
                  {uploadItems.map((component) => (
                    <ListItem
                      key={component.title}
                      title={component.title}
                      href={component.href}
                      icon={component.icon}
                    >
                      {component.description}
                    </ListItem>
                  ))}
                </ul>
                
                <div className="mt-6 rounded-lg bg-primary/10 p-4 border border-primary/20">
                  <h4 className="text-sm font-medium text-primary mb-1">Need inspiration?</h4>
                  <p className="text-xs text-muted-foreground mb-3">Check out our community templates.</p>
                  <Link href="/features" className="text-xs font-medium text-primary hover:underline">
                    View Templates &rarr;
                  </Link>
                </div>
              </div>

            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<typeof Link>,
  React.ComponentPropsWithoutRef<typeof Link> & { icon: React.ReactNode; title: string; children: React.ReactNode }
>(({ className, title, children, icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink className={cn(
        "group block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-white/5 focus:bg-white/5",
        className
      )} render={<Link ref={ref} {...props} />}>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1 rounded-md bg-background/50 border border-border/50 group-hover:bg-background group-hover:border-border transition-colors">
            {icon}
          </div>
          <div className="text-sm font-medium leading-none text-foreground group-hover:text-primary transition-colors">{title}</div>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground pl-8">
          {children}
        </p>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
