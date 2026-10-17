'use server';

import { createClient } from '@/lib/supabase/server';
import { hasVerifiedEmail } from './validation';

export async function getCustomUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !hasVerifiedEmail(user)) {
    return { data: { user: null }, error: error || new Error('A verified email session is required') };
  }

  return {
    data: {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }
    },
    error: null
  };
}
