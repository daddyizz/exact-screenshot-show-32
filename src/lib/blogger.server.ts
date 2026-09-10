export const BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";

type Creds = { clientId: string; clientSecret: string };

type BloggerApiError = Error & { status?: number };

function bloggerApiError(message: string, status: number): BloggerApiError {
  const error = new Error(message) as BloggerApiError;
  error.name = "BloggerApiError";
  error.status = status;
  return error;
}

export function isBloggerNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && (error as BloggerApiError).status === 404);
}

export function googleCreds(): Creds {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Blogger publishing is not configured yet (missing Google OAuth credentials).");
  }
  return { clientId, clientSecret };
}

export function bloggerRedirectUri(requested?: string): string {
  const configured = process.env["BLOGGER_REDIRECT_URI"]?.trim();
  if (configured) return configured;
  if (requested) return requested;
  throw new Error("Blogger publishing is not configured yet (missing BLOGGER_REDIRECT_URI).");
}

export function bloggerOAuthConfig(requested?: string) {
  const redirectUri = bloggerRedirectUri(requested);
  const configured = Boolean(
    process.env["GOOGLE_OAUTH_CLIENT_ID"] &&
      process.env["GOOGLE_OAUTH_CLIENT_SECRET"] &&
      redirectUri,
  );
  return { configured, redirectUri };
}

export function buildAuthUrl(redirectUri: string, state: string) {
  const { clientId } = googleCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: BLOGGER_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCreds();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google sign-in failed: ${(await response.text()).slice(0, 200)}`);
  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleCreds();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok)
    throw new Error("Your Blogger connection expired. Reconnect the blog to keep publishing.");
  return (await response.json()) as TokenResponse;
}

export type BloggerBlog = { id: string; name: string; url: string };

export async function listBlogs(accessToken: string): Promise<BloggerBlog[]> {
  const response = await fetch(
    "https://www.googleapis.com/blogger/v3/users/self/blogs?fetchUserInfo=false",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`Could not read your Blogger blogs: ${response.status}`);
  const payload = (await response.json()) as { items?: BloggerBlog[] };
  return (payload.items ?? []).map((b) => ({ id: b.id, name: b.name, url: b.url }));
}

export async function createBloggerPost(
  accessToken: string,
  bloggerBlogId: string,
  input: { title: string; content: string; labels?: string[] },
): Promise<{ id: string; url: string }> {
  const response = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${bloggerBlogId}/posts/?isDraft=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#post",
        title: input.title,
        content: input.content,
        labels: input.labels ?? [],
      }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw bloggerApiError(`Blogger rejected the post: ${detail}`, response.status);
  }
  const payload = (await response.json()) as { id: string; url: string };
  return { id: payload.id, url: payload.url };
}

export async function updateBloggerPost(
  accessToken: string,
  bloggerBlogId: string,
  bloggerPostId: string,
  input: { title: string; content: string; labels?: string[] },
): Promise<{ id: string; url: string }> {
  const response = await fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${bloggerBlogId}/posts/${bloggerPostId}?publish=true&revert=false`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "blogger#post",
        id: bloggerPostId,
        title: input.title,
        content: input.content,
        labels: input.labels ?? [],
      }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw bloggerApiError(`Blogger rejected the update: ${detail}`, response.status);
  }
  const payload = (await response.json()) as { id: string; url: string };
  return { id: payload.id, url: payload.url };
}

/** Minimal markdown -> HTML for Blogger post bodies. */
export function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (heading) {
        const level = Math.min(heading[1]!.length + 1, 6);
        return `<h${level}>${inline(heading[2]!)}</h${level}>`;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .map((line) => line.replace(/^[-*]\s+/, "").trim())
          .filter(Boolean)
          .map((line) => `<li>${inline(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(trimmed.replace(/\n/g, "<br />"))}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function inline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

export function tokenExpiry(expiresIn: number) {
  return new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
}
