/**
 * Content sanitization layer.
 *
 * Cleans fetched web content before it is sent to the LLM, reducing:
 * - False-positive content-safety rejections (cookie banners, legal boilerplate)
 * - Token waste (navigation debris, ads, repeated whitespace)
 */

// ── Boilerplate patterns (case-insensitive) ──────────────────────────────────

const BOILERPLATE_PATTERNS: RegExp[] = [
  // Cookie / consent banners
  /we use cookies[^.]{0,200}\./gi,
  /by (?:continuing|using|clicking)[^.]{0,200}(?:cookie|consent|privacy)[^.]{0,200}\./gi,
  /this (?:site|website) uses cookies[^.]{0,300}\./gi,
  /accept (?:all )?cookies/gi,

  // Privacy / legal boilerplate
  /privacy policy/gi,
  /terms (?:of (?:service|use)|and conditions)/gi,
  /all rights reserved\.?/gi,
  /©\s*\d{4}[^.\n]{0,80}/g,
  /copyright\s*(?:©|\(c\))?\s*\d{4}[^.\n]{0,80}/gi,
  /(?:read|view|see) (?:our |the )?(?:full |complete )?(?:privacy|cookie|legal|terms)[^.\n]{0,60}/gi,
  /disclaimer[:\s][^.\n]{0,300}\./gi,

  // Newsletter / subscription CTAs
  /subscribe (?:to (?:our|the) )?(?:newsletter|mailing list|updates)[^.\n]{0,120}/gi,
  /sign up for (?:our|free|the)[^.\n]{0,120}/gi,
  /enter your email[^.\n]{0,80}/gi,
  /get (?:the latest|our) (?:news|updates)[^.\n]{0,80}/gi,

  // Navigation / UI debris
  /skip to (?:main |primary )?content/gi,
  /toggle (?:navigation|menu|sidebar)/gi,
  /(?:share|tweet|pin) (?:this|on) (?:facebook|twitter|linkedin|pinterest|x\.com)[^.\n]{0,40}/gi,
  /(?:follow us|connect with us) on[^.\n]{0,80}/gi,
  /(?:back to top|scroll to top|↑|⬆)/gi,
  /(?:print|email|share) this (?:article|page|post)/gi,
  /(?:previous|next) (?:article|post|page)/gi,
  /related (?:articles|posts|stories|reads)/gi,
  /you (?:may|might) also (?:like|enjoy)/gi,
  /(?:comments|leave a reply|join the (?:discussion|conversation))\s*$/gim,

  // Ads / sponsored
  /\b(?:advertisement|sponsored|promoted|ad)\b/gi,
  /click here to[^.\n]{0,80}/gi,

  // Login / paywall
  /(?:sign in|log in|create (?:an )?account) to (?:continue|read|access)[^.\n]{0,100}/gi,
  /(?:already a (?:subscriber|member))\??/gi,
];

// ── Sensitive-content dampening ──────────────────────────────────────────────
// Replace potentially sensitive phrases that might trigger LLM content filters
// with neutral placeholders. This is NOT censorship — the information is already
// captured in notes; we just avoid triggering API-level rejections.

const SENSITIVE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Weapons / violence descriptors (keep the noun, soften the context)
  [/\b(?:how to (?:build|make|create|assemble) (?:a )?(?:bomb|explosive|weapon))[^.\n]{0,60}/gi, "[weapons-related content removed]"],
  [/\b(?:suicide|self[- ]harm)[^.\n]{0,40}/gi, "[sensitive-health-content]"],

  // Explicit adult content markers
  [/\b(?:xxx|porn(?:ograph(?:y|ic))?|nsfw)\b/gi, "[adult-content-marker]"],

  // Extreme slurs / hate speech (broad catch — intentionally aggressive)
  [/\b(?:n[i1]gg(?:er|a)|f[a@]gg?(?:ot)?|k[i1]ke|ch[i1]nk|sp[i1]ck?|tr[a@]nn(?:y|ie))\b/gi, "[slur-removed]"],
];

// ── Structural cleanup ───────────────────────────────────────────────────────

/** Collapse 3+ newlines into 2 */
const collapseNewlines = (text: string) => text.replace(/\n{3,}/g, "\n\n");

/** Collapse runs of 3+ spaces (but keep single newlines) */
const collapseSpaces = (text: string) => text.replace(/[ \t]{3,}/g, "  ");

/** Remove lines that are just punctuation / symbols / single words (nav debris) */
const removeDebrisLines = (text: string) =>
  text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // keep empty lines (paragraph breaks)
      if (!trimmed) return true;
      // drop lines < 4 chars that are just symbols
      if (trimmed.length < 4 && /^[^\w\u4e00-\u9fff]+$/.test(trimmed)) return false;
      // drop lines that look like breadcrumbs: "Home > Products > ..."
      if (/^(?:[\w\u4e00-\u9fff]+\s*[>›»/|]\s*){2,}/.test(trimmed)) return false;
      return true;
    })
    .join("\n");

/** Remove duplicate consecutive lines (common in poorly stripped HTML) */
const deduplicateLines = (text: string) => {
  const lines = text.split("\n");
  const result: string[] = [];
  let prev = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === prev && trimmed.length > 0) continue;
    result.push(line);
    prev = trimmed;
  }
  return result.join("\n");
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sanitize raw extracted text before sending to LLM.
 *
 * @param text  Raw text extracted from a web page or search snippet
 * @param maxLength  Maximum output length in characters (default 5000)
 * @returns Cleaned text safe for LLM consumption
 */
export const sanitizeText = (text: string, maxLength = 5000): string => {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove boilerplate
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // 2. Dampen sensitive content
  for (const [pattern, replacement] of SENSITIVE_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // 3. Structural cleanup
  cleaned = removeDebrisLines(cleaned);
  cleaned = deduplicateLines(cleaned);
  cleaned = collapseSpaces(cleaned);
  cleaned = collapseNewlines(cleaned);
  cleaned = cleaned.trim();

  // 4. Truncate
  if (cleaned.length > maxLength) {
    // Try to cut at a sentence boundary
    const cutRegion = cleaned.slice(maxLength - 200, maxLength);
    const lastSentence = cutRegion.lastIndexOf(".");
    const cutPoint =
      lastSentence > 0 ? maxLength - 200 + lastSentence + 1 : maxLength;
    cleaned = cleaned.slice(0, cutPoint).trim();
  }

  return cleaned;
};

/**
 * Light sanitization for search snippets (shorter, less aggressive).
 */
export const sanitizeSnippet = (text: string, maxLength = 500): string => {
  if (!text) return "";

  let cleaned = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = collapseSpaces(cleaned).trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
};
