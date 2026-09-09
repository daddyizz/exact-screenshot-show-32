import { createFileRoute } from "@tanstack/react-router";
import { PublicPageLayout } from "@/components/PublicPageLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — BlogPilot AI" }, { name: "description", content: "Terms governing the use of BlogPilot AI, including account responsibilities, AI-generated content, Blogger publishing and acceptable use." }] }),
  component: TermsPage,
});

function TermsPage() {
  return <PublicPageLayout eyebrow="Legal" title="Terms of Service" description="These terms describe the rules for using BlogPilot AI and the responsibilities that remain with each account owner.">
    <p><strong>Effective date:</strong> September 10, 2026.</p>
    <h2>Using the service</h2>
    <p>You may use BlogPilot AI to plan, draft, manage and publish content for blogs you own or are authorised to manage. You are responsible for maintaining the security of your account and connected services.</p>
    <h2>AI-generated content</h2>
    <p>AI output may contain errors, incomplete information or unsuitable wording. You are responsible for reviewing facts, claims, links, copyright considerations and compliance before publishing. BlogPilot AI does not guarantee rankings, traffic, advertising approval or revenue.</p>
    <h2>Connected Blogger accounts</h2>
    <p>When you connect Blogger, you authorise BlogPilot AI to perform actions within the permissions you grant. You are responsible for choosing the correct blog and for content published through manual or automatic workflows.</p>
    <h2>Acceptable use</h2>
    <p>You may not use the service to distribute unlawful content, malware, deceptive material, spam, abusive automation, or content that infringes the rights of others. Attempts to bypass plan limits, interfere with service security or access another user's data are prohibited.</p>
    <h2>Plans and feature limits</h2>
    <p>Features may differ by plan, including blog limits, AI usage, image generation and Autopilot access. Plan features can change as the product evolves, with reasonable notice for material changes where practical.</p>
    <h2>Availability</h2>
    <p>We aim to keep BlogPilot AI reliable, but uninterrupted access is not guaranteed. Third-party services such as Google, Blogger, hosting providers and AI providers may affect feature availability.</p>
    <h2>Termination</h2>
    <p>Accounts may be restricted or terminated for serious abuse, security threats, unlawful activity or repeated violations of these terms. Users may stop using the service at any time.</p>
    <h2>Changes to these terms</h2>
    <p>These terms may be updated as BlogPilot AI develops. Continued use after material changes takes effect constitutes acceptance of the updated terms.</p>
  </PublicPageLayout>;
}
