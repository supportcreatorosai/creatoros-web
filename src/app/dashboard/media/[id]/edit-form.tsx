'use client';

import { useActionState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from 'next/link';
import { updateContent, FormState } from '../actions';
import { ArrowLeft } from 'lucide-react';
import { DeleteButton } from './delete-button';
import { SubmitButton } from '../submit-button';

export function EditContentForm({ id, content }: { id: string, content: { title: string; topic?: string; description?: string; script?: string; caption?: string; hashtags?: string; content_type: string; platform: string; status: string; thumbnail_url?: string; video_url?: string; audio_url?: string; [key: string]: unknown } }) {
  const initialState: FormState = { message: '', errors: {} };
  const updateContentWithId = updateContent.bind(null, id);
  const [state, formAction] = useActionState(updateContentWithId, initialState);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/media" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Content Editor</h1>
            <p className="text-muted-foreground mt-1">Editing: {content.title}</p>
          </div>
        </div>
        <DeleteButton id={id} />
      </div>

      <Card className="glass-card">
        <form action={formAction}>
          <CardHeader>
            <CardTitle>Content Details</CardTitle>
            <CardDescription>
              Update your content information and generated assets.
            </CardDescription>
            {state.message && (
              <div className={`text-sm font-medium mt-2 p-3 rounded-md border ${state.errors ? 'text-destructive bg-destructive/10 border-destructive/20' : 'text-green-500 bg-green-500/10 border-green-500/20'}`}>
                {state.message}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Meta Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input id="title" name="title" defaultValue={content.title} />
                  {state.errors?.title && <p className="text-sm text-destructive">{state.errors.title[0]}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Input id="topic" name="topic" defaultValue={content.topic || ''} />
                  {state.errors?.topic && <p className="text-sm text-destructive">{state.errors.topic[0]}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  defaultValue={content.description || ''}
                  className="h-[116px]" 
                />
                {state.errors?.description && <p className="text-sm text-destructive">{state.errors.description[0]}</p>}
              </div>
            </div>
            
            {/* Core Content */}
            <div className="space-y-2 pt-4 border-t border-border/50">
              <Label htmlFor="script" className="text-base font-semibold">Script</Label>
              <Textarea 
                id="script" 
                name="script" 
                defaultValue={content.script || ''}
                placeholder="Content script will appear here..."
                className="min-h-[300px] font-mono text-sm" 
              />
              {state.errors?.script && <p className="text-sm text-destructive">{state.errors.script[0]}</p>}
            </div>
            
            {/* Social Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Textarea 
                  id="caption" 
                  name="caption" 
                  defaultValue={content.caption || ''}
                  className="h-32" 
                />
                {state.errors?.caption && <p className="text-sm text-destructive">{state.errors.caption[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hashtags">Hashtags</Label>
                <Textarea 
                  id="hashtags" 
                  name="hashtags" 
                  defaultValue={content.hashtags || ''}
                  placeholder="#education #learning"
                  className="h-32" 
                />
                {state.errors?.hashtags && <p className="text-sm text-destructive">{state.errors.hashtags[0]}</p>}
              </div>
            </div>

            {/* Config */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border/50">
              <div className="space-y-2">
                <Label htmlFor="content_type">Content Type *</Label>
                <select 
                  id="content_type" 
                  name="content_type" 
                  defaultValue={content.content_type}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="lesson">Lesson</option>
                  <option value="short_video">Short Video (Reel/TikTok)</option>
                  <option value="long_video">Long Video (YouTube)</option>
                  <option value="social_post">Social Post</option>
                </select>
                {state.errors?.content_type && <p className="text-sm text-destructive">{state.errors.content_type[0]}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="platform">Platform *</Label>
                <select 
                  id="platform" 
                  name="platform" 
                  defaultValue={content.platform}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="general">General / Other</option>
                </select>
                {state.errors?.platform && <p className="text-sm text-destructive">{state.errors.platform[0]}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select 
                  id="status" 
                  name="status" 
                  defaultValue={content.status}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="draft">Draft</option>
                  <option value="processing">Processing</option>
                  <option value="ready">Ready</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="failed">Failed</option>
                </select>
                {state.errors?.status && <p className="text-sm text-destructive">{state.errors.status[0]}</p>}
              </div>
            </div>

            {/* Generated Media Assets */}
            {(content.thumbnail_url || content.video_url || content.audio_url) && (
              <div className="pt-4 border-t border-border/50">
                <h3 className="text-lg font-semibold mb-4">Generated Assets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {content.thumbnail_url && (
                    <div className="space-y-2">
                      <Label>Thumbnail</Label>
                      <div className="rounded-md overflow-hidden border border-border/50 bg-muted">
                        <img src={content.thumbnail_url} alt="Thumbnail" className="w-full h-auto object-cover" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    {content.video_url && (
                      <div className="space-y-2">
                        <Label>Video</Label>
                        <div className="rounded-md overflow-hidden border border-border/50 bg-muted aspect-video">
                          <video src={content.video_url} controls className="w-full h-full" />
                        </div>
                      </div>
                    )}
                    {content.audio_url && (
                      <div className="space-y-2">
                        <Label>Audio</Label>
                        <div className="rounded-md p-4 border border-border/50 bg-muted">
                          <audio src={content.audio_url} controls className="w-full" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/50 bg-muted/10 p-6">
            <Link href="/dashboard/media" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <SubmitButton label="Save Changes" />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
