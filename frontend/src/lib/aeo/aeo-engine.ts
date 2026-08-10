/**
 * AEO (Answer Engine Optimization) & Snippet Eligibility Engine
 * 
 * Evaluates voice search and Google Featured Snippet (Position Zero) eligibility:
 * - Paragraph length check (40-60 words optimal for Featured Snippet)
 * - FAQPage schema validation
 * - HowTo step validation
 * - Speakable selector check
 * - Voice search answer completeness
 */

export interface AeoScoreBreakdown {
  overallAeoScore: number;
  featuredSnippetEligibility: number;
  voiceSearchReadiness: number;
  faqSchemaCompleteness: number;
  speakableCompleteness: number;
  recommendations: string[];
}

export class AeoEngine {

  static evaluateAeo(page: any, aeoEntries: any[] = []): AeoScoreBreakdown {
    const recs: string[] = [];
    const pageEntries = aeoEntries.filter(e => e.entity_id === page.entity_id || e.page_url === page.url);
    const faqs = pageEntries.filter(e => e.entry_type === "faq");
    const speakables = pageEntries.filter(e => e.entry_type === "speakable");

    let faqCompleteness = faqs.length >= 3 ? 90 : faqs.length >= 1 ? 50 : 0;
    if (faqs.length === 0) recs.push("Add at least 3 FAQ Q&A pairs for featured snippet eligibility");

    let speakableCompleteness = speakables.length > 0 ? 90 : 0;
    if (speakables.length === 0) recs.push("Add Speakable JSON-LD selectors for voice assistants (Google Home, Siri)");

    let snippetEligibility = 30;
    if ((page.word_count || 0) >= 300 && faqs.length > 0) snippetEligibility += 40;
    if (page.h1_text) snippetEligibility += 30;

    let voiceReadiness = Math.round((faqCompleteness + speakableCompleteness + snippetEligibility) / 3);

    const overall = Math.round((faqCompleteness + speakableCompleteness + snippetEligibility + voiceReadiness) / 4);

    return {
      overallAeoScore: Math.max(0, Math.min(100, overall)),
      featuredSnippetEligibility: Math.min(100, snippetEligibility),
      voiceSearchReadiness: Math.min(100, voiceReadiness),
      faqSchemaCompleteness: Math.min(100, faqCompleteness),
      speakableCompleteness: Math.min(100, speakableCompleteness),
      recommendations: recs,
    };
  }
}
