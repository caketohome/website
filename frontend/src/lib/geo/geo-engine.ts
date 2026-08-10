/**
 * GEO (Generative Engine Optimization) Scoring Engine
 * 
 * Evaluates website readiness for AI LLM Search Engines (ChatGPT Search, Google Gemini, Perplexity, Claude):
 * - Entity Coverage Index (0-100)
 * - Topical Authority Score (0-100)
 * - AI Answer Readiness (0-100)
 * - Knowledge Graph Completeness (0-100)
 */

export interface GeoScoreBreakdown {
  overallGeoScore: number;
  entityCoverage: number;
  topicalAuthority: number;
  aiAnswerReadiness: number;
  knowledgeGraphCompleteness: number;
  recommendations: string[];
}

export class GeoEngine {

  static evaluateGeoPage(page: any): GeoScoreBreakdown {
    const recs: string[] = [];

    // Entity Coverage
    let entityCoverage = 40;
    if (page.has_schema) entityCoverage += 30;
    if (page.entity_type === "branch" || page.entity_type === "city" || page.entity_type === "geo_landing") entityCoverage += 30;
    else if (page.keywords) entityCoverage += 15;

    // Topical Authority
    let topicalAuthority = 30;
    if ((page.word_count || 0) >= 500) topicalAuthority += 40;
    else if ((page.word_count || 0) >= 300) topicalAuthority += 25;
    if (page.internal_links_count > 0) topicalAuthority += 30;
    else recs.push("Add internal contextual links to improve topical authority");

    // AI Answer Readiness
    let aiAnswerReadiness = 30;
    if (page.meta_title && page.meta_description) aiAnswerReadiness += 35;
    if (page.h1_text) aiAnswerReadiness += 35;
    else recs.push("Add clear H1 heading to define topic entity for AI crawlers");

    // Knowledge Graph Completeness
    let kgCompleteness = 30;
    if (page.schema_types) {
      try {
        const types = JSON.parse(page.schema_types);
        if (types.length >= 2) kgCompleteness += 50;
        else if (types.length === 1) kgCompleteness += 35;
      } catch { kgCompleteness += 20; }
    } else {
      recs.push("Add multi-type Schema.org JSON-LD (e.g. Bakery + LocalBusiness)");
    }

    const overall = Math.round((entityCoverage + topicalAuthority + aiAnswerReadiness + kgCompleteness) / 4);

    return {
      overallGeoScore: Math.max(0, Math.min(100, overall)),
      entityCoverage: Math.min(100, entityCoverage),
      topicalAuthority: Math.min(100, topicalAuthority),
      aiAnswerReadiness: Math.min(100, aiAnswerReadiness),
      knowledgeGraphCompleteness: Math.min(100, kgCompleteness),
      recommendations: recs,
    };
  }
}
