'use client';

import { useActionState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from 'next/link';
import { createContent, FormState } from '../actions';
import { ArrowLeft } from 'lucide-react';
import { SubmitButton } from '../submit-button';

export default function NewContentPage() {
  const initialState: FormState = { message: '', errors: {} };
  const [state, formAction] = useActionState(createContent, initialState);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/media" className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Content</h1>
          <p className="text-muted-foreground mt-1">Start a new educational content project.</p>
        </div>
      </div>

      <Card className="glass-card">
        <form action={formAction}>
          <CardHeader>
            <CardTitle>Content Details</CardTitle>
            <CardDescription>
              Basic information about the content you want to create.
            </CardDescription>
            {state.message && (
              <div className="text-sm font-medium text-destructive mt-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                {state.message}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" placeholder="e.g. Introduction to Quantum Physics" />
              {state.errors?.title && <p className="text-sm text-destructive">{state.errors.title[0]}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" name="topic" placeholder="e.g. Physics, Science" />
              {state.errors?.topic && <p className="text-sm text-destructive">{state.errors.topic[0]}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                name="description" 
                placeholder="Briefly describe what this content is about..."
                className="h-24" 
              />
              {state.errors?.description && <p className="text-sm text-destructive">{state.errors.description[0]}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="content_type">Content Type *</Label>
                <select 
                  id="content_type" 
                  name="content_type" 
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
            </div>
            <input type="hidden" name="status" value="draft" />
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/50 bg-muted/10 p-6">
            <Link href="/dashboard/media" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <SubmitButton label="Save Draft" />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
