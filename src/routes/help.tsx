import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & FAQ — BlogPilot AI" }, { name: "description", content: "Get answers about BlogPilot AI setup, Blogger connections, Autopilot, AI drafts, publishing and account usage." }] }),
  component: HelpPage,
});

function HelpPage() {
  return <PublicPageLayout eyebrow="Help center" title="Help & frequently asked questions" description="Quick answers for setup, Blogger publishing, AI generation and Autopilot. More detailed troubleshooting is available inside the workspace for signed-in users.">
    <h2>Getting started</h2>
    <h3>How do I create my first blog workspace?</h3>
    <p>Sign in, open the Overview page and add your blog. Choose a niche, target market, language and writing tone. These settings guide topic planning and article generation.</p>
    <h3>Do I need my own AI API key?</h3>
    <p>No. Supported AI generation is provided through BlogPilot AI. Usage limits depend on your plan.</p>
    <h2>Blogger</h2>
    <h3>How do I connect Blogger?</h3>
    <p>Open Settings, select your blog and choose Connect Blogger. Google will ask you to approve the required permissions. After authorisation, select the Blogger site you want BlogPilot to use.</p>
    <h3>Why does Blogger ask me to reconnect?</h3>
    <p>Google access tokens expire. BlogPilot normally refreshes them automatically when a valid refresh token is available. If the refresh token is missing or invalid, the workspace will ask you to reconnect.</p>
    <h3>Can I review a post before it goes live?</h3>
    <p>Yes. Keep automatic publishing off and generated articles remain in your workspace until you choose to publish them.</p>
    <h2>Autopilot</h2>
    <h3>What does Autopilot do?</h3>
    <p>Autopilot checks whether a blog is due for a new article, selects or creates a topic, drafts the article and can publish it when automatic publishing is enabled and Blogger is connected.</p>
    <h3>What happens if a run fails?</h3>
    <p>The failure is recorded so it can be diagnosed. Users may receive an in-app warning, and administrators can retry eligible failed runs from the Operations dashboard.</p>
    <h2>Plans and usage</h2>
    <h3>What is included in the Free plan?</h3>
    <p>The Free plan supports one blog, topic planning, outlines, up to five AI drafts per month and manual publishing. Paid features may include additional blogs, unlimited drafts, AI images and Autopilot.</p>
    <h2>Need more help?</h2>
    <p>Use the <Link to="/contact">Contact page</Link> for account, privacy, billing or product questions. Signed-in users should include the affected blog name and a short description of the issue, but never send passwords, OAuth tokens or API secrets.</p>
  </PublicPageLayout>;
}
