export const NICHES = [
  "Technology",
  "Personal Finance",
  "Health & Fitness",
  "Travel",
  "Food & Recipes",
  "Parenting",
  "Home & Garden",
  "Automotive",
  "Education",
  "Business & Marketing",
  "Gaming",
  "Beauty & Fashion",
] as const;

export const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "MY", label: "Malaysia" },
  { code: "SG", label: "Singapore" },
  { code: "ID", label: "Indonesia" },
  { code: "IN", label: "India" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "PH", label: "Philippines" },
  { code: "global", label: "Global / Worldwide" },
] as const;

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
] as const;

export const TONES = [
  "professional",
  "friendly",
  "authoritative",
  "conversational",
  "journalistic",
] as const;

export const POST_STATUSES = ["idea", "drafted", "approved", "published", "failed"] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export function statusLabel(status: string) {
  switch (status) {
    case "idea":
      return "Idea";
    case "drafted":
      return "Drafted";
    case "approved":
      return "Approved";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
