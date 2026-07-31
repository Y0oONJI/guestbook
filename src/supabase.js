import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key && !url.includes('your-project-ref'));
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;

export async function getAnonymousUser() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function fetchPosts() {
  const [{ data: postRows, error: postError }, { data: likeRows, error: likeError }] = await Promise.all([
    supabase.from('posts').select('*').order('created_at', { ascending: false }),
    supabase.from('post_likes').select('post_id')
  ]);
  if (postError) throw postError;
  if (likeError) throw likeError;
  const likedIds = new Set(likeRows.map(({ post_id }) => post_id));
  return postRows.map((row) => ({ id: row.id, alias: row.nickname, emoji: row.emoji, text: row.content, likes: row.likes_count, x: row.position_x, y: row.position_y, rotate: row.rotation, liked: likedIds.has(row.id), createdAt: row.created_at }));
}

export async function createPost(post, userId) {
  const { data, error } = await supabase.from('posts').insert({ author_id: userId, nickname: post.alias, emoji: post.emoji, content: post.text, position_x: post.x, position_y: post.y, rotation: post.rotate }).select().single();
  if (error) throw error;
  return { id: data.id, alias: data.nickname, emoji: data.emoji, text: data.content, likes: data.likes_count, x: data.position_x, y: data.position_y, rotate: data.rotation, liked: false, createdAt: data.created_at };
}

export async function toggleLike(postId) {
  const { data, error } = await supabase.rpc('toggle_post_like', { target_post_id: postId });
  if (error) throw error;
  return data;
}

export async function updatePostPosition(postId, x, y, rotate) {
  const { error } = await supabase.rpc('update_post_position', { target_post_id: postId, new_x: x, new_y: y, new_rotation: rotate });
  if (error) throw error;
}
