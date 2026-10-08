import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { EditContentForm } from './edit-form';
import { getCustomUser } from '@/lib/auth/session';

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const { data: { user } } = await getCustomUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !content) {
    notFound();
  }

  return <EditContentForm id={id} content={content} />;
}
