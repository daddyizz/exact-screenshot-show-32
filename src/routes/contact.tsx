import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — BlogPilot AI" }, { name: "description", content: "Contact BlogPilot AI for product, account, privacy and support questions." }] }),
  component: ContactPage,
});

function ContactPage() {
  return <PublicPageLayout eyebrow="Contact" title="How to reach BlogPilot AI" description="Use the right support path so account, product and privacy questions can be handled without exposing passwords, tokens or other sensitive credentials.">
    <h2>Product and account support</h2>
    <p>If you already have an account, sign in and use the workspace so you can identify the affected blog, feature and error message. Never send your password, Google OAuth token, API key or recovery code.</p>
    <p><Link to="/auth" search={{ next: "/settings" }}>Sign in and open Settings</Link> to review your Blogger connection and workspace configuration.</p>
    <h2>Before contacting support</h2>
    <p>For common setup and publishing questions, check the <Link to="/help">Help & FAQ page</Link>. If Blogger publishing is failing, note the blog name, whether the connection shows as healthy, and the approximate time the error occurred.</p>
    <h2>Privacy and data requests</h2>
    <p>For privacy, account-access or deletion questions, use the authenticated account where possible so ownership can be verified. Do not include credentials in the request.</p>
    <h2>Business and advertising enquiries</h2>
    <p>Commercial partnerships and advertising placements are reviewed separately from product support. A dedicated public business contact channel will be added before third-party advertising campaigns are accepted.</p>
  </PublicPageLayout>;
}
