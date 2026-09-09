import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — BlogPilot AI" }, { name: "description", content: "Read how BlogPilot AI handles account, blog, authentication, analytics and advertising-related data." }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PublicPageLayout eyebrow="Legal" title="Privacy Policy" description="This policy explains the main categories of information BlogPilot AI processes and why they are needed to operate the service.">
    <p><strong>Effective date:</strong> September 10, 2026.</p>
    <h2>Information we process</h2>
    <p>When you use BlogPilot AI, the service may process account details such as your email address, profile name and authentication identifiers; blog configuration such as niche, language, publishing cadence and connected Blogger metadata; content you create or generate; and operational data such as feature usage, publishing status, errors and system events.</p>
    <h2>Google and Blogger connections</h2>
    <p>If you connect Blogger, BlogPilot AI uses Google OAuth to request the permissions needed to identify your Blogger blogs and publish content you authorise. Access and refresh tokens are treated as sensitive credentials and are used only to provide the connected publishing functionality.</p>
    <h2>How information is used</h2>
    <p>Information is used to provide the workspace, authenticate users, generate requested content, manage plan limits, publish to connected services, maintain security, troubleshoot failures, improve reliability and provide support.</p>
    <h2>Advertising, cookies and analytics</h2>
    <p>BlogPilot AI may display house advertising or third-party advertising. If Google advertising products such as AdSense are enabled, third-party vendors including Google may use cookies or similar technologies to serve and measure ads based on a visitor's prior visits to this site or other websites. Google's use of advertising cookies may allow Google and its partners to serve personalised advertising where permitted by law and by the visitor's consent choices.</p>
    <p>Visitors can manage or opt out of personalised Google advertising through Google's Ads Settings. Where additional third-party ad vendors or ad networks are used, BlogPilot AI will disclose those providers and provide appropriate opt-out information where available.</p>
    <p>Google and other advertising providers may also use technologies such as web beacons, IP addresses or other identifiers as part of ad delivery, measurement, fraud prevention and reporting. BlogPilot AI may separately collect aggregated ad impression and click counts for placement performance without intentionally storing visitor IP addresses or device fingerprints in its own ad analytics tables.</p>
    <p>Additional consent controls may be introduced where required by applicable law. You can learn more about Google's advertising and privacy practices from Google's own privacy and advertising resources.</p>
    <h2>Data sharing</h2>
    <p>Data is shared only with service providers and connected platforms to the extent needed to operate requested features, such as authentication, hosting, database services, AI generation and Blogger publishing. BlogPilot AI does not sell user account data as a standalone product.</p>
    <h2>Retention and account deletion</h2>
    <p>Information may be retained while an account is active and for a reasonable period afterwards where needed for security, dispute resolution, legal obligations or backups. Account deletion removes data according to the product's deletion workflow, subject to necessary retention obligations.</p>
    <h2>Your choices</h2>
    <p>You can disconnect Blogger, change publishing settings and stop using automated features at any time. You may also contact BlogPilot AI regarding privacy questions or account data requests through the <Link to="/contact">Contact page</Link>.</p>
    <h2>Policy updates</h2>
    <p>This policy may be updated as the product, advertising setup or legal requirements change. Material changes will be reflected by updating the effective date on this page.</p>
  </PublicPageLayout>;
}
