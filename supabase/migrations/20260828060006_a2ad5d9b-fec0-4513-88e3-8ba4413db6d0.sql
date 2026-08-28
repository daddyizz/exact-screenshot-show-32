CREATE TABLE public.blogger_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blog_id uuid NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  blogger_blog_id text,
  blogger_blog_name text,
  blogger_blog_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blog_id)
);

GRANT SELECT (id, user_id, blog_id, blogger_blog_id, blogger_blog_name, blogger_blog_url, created_at, updated_at) ON public.blogger_connections TO authenticated;
GRANT DELETE ON public.blogger_connections TO authenticated;
GRANT ALL ON public.blogger_connections TO service_role;

ALTER TABLE public.blogger_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blogger_connections_select_own" ON public.blogger_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "blogger_connections_delete_own" ON public.blogger_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_blogger_connections_updated_at
  BEFORE UPDATE ON public.blogger_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS blogger_post_id text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS blogger_url text;