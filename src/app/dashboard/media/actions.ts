'use server'

import { getCustomUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod'

const contentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  topic: z.string().optional(),
  description: z.string().optional(),
  content_type: z.enum(['lesson', 'short_video', 'long_video', 'social_post'], {
    message: 'Invalid content type'
  }),
  platform: z.enum(['youtube', 'instagram', 'facebook', 'linkedin', 'general'], {
    message: 'Invalid platform'
  }),
  status: z.enum(['draft', 'processing', 'ready', 'scheduled', 'published', 'failed']).default('draft'),
  script: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.string().optional(),
})

export type FormState = {
  errors?: {
    title?: string[]
    topic?: string[]
    description?: string[]
    content_type?: string[]
    platform?: string[]
    status?: string[]
    script?: string[]
    caption?: string[]
    hashtags?: string[]
  }
  message?: string
}

export async function createContent(prevState: FormState, formData: FormData): Promise<FormState> {
  const { data: { user } } = await getCustomUser()

  if (!user) {
    return { message: 'Unauthorized' }
  }

  const supabase = await createClient();

  const validatedFields = contentSchema.safeParse({
    title: formData.get('title'),
    topic: formData.get('topic'),
    description: formData.get('description'),
    content_type: formData.get('content_type'),
    platform: formData.get('platform'),
    status: formData.get('status') || 'draft',
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create content. Please fix the errors below.',
    }
  }

  const { data, error } = await supabase
    .from('content')
    .insert({
      user_id: user.id,
      ...validatedFields.data,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating content:', error)
    return { message: 'Failed to create content in database.' }
  }

  revalidatePath('/dashboard/media')
  revalidatePath('/dashboard')
  redirect(`/dashboard/media/${data.id}`)
}

export async function updateContent(id: string, prevState: FormState, formData: FormData): Promise<FormState> {
  const { data: { user } } = await getCustomUser()

  if (!user) {
    return { message: 'Unauthorized' }
  }

  const supabase = await createClient();

  const validatedFields = contentSchema.safeParse({
    title: formData.get('title'),
    topic: formData.get('topic'),
    description: formData.get('description'),
    script: formData.get('script'),
    caption: formData.get('caption'),
    hashtags: formData.get('hashtags'),
    content_type: formData.get('content_type'),
    platform: formData.get('platform'),
    status: formData.get('status'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to update content. Please fix the errors below.',
    }
  }

  const { error } = await supabase
    .from('content')
    .update(validatedFields.data)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating content:', error)
    return { message: 'Failed to update content in database.' }
  }

  revalidatePath('/dashboard/media')
  revalidatePath(`/dashboard/media/${id}`)
  revalidatePath('/dashboard')
  
  return { message: 'Content updated successfully' }
}

export async function deleteContent(id: string) {
  const { data: { user } } = await getCustomUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting content:', error)
    throw new Error('Failed to delete content')
  }

  revalidatePath('/dashboard/media')
  revalidatePath('/dashboard')
  redirect('/dashboard/media')
}
