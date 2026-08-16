/**
 * CakeToHome Unified Knowledge Base & Hybrid RAG Retrieval Engine
 * 
 * Provides a structured, searchable knowledge index covering:
 * - Product catalog (ingredients, dietary attributes, variants, pricing, GST)
 * - Category taxonomy & hierarchy
 * - Occasion catalog & themes
 * - CMS pages, FAQs, brand story
 * - Delivery, cancellation, return, and refund policies
 * - Branch & kitchen hub logistics
 */

export interface KnowledgeDocument {
  id: string;
  source_type: "product" | "category" | "occasion" | "cms_page" | "faq" | "policy" | "branch" | "city" | "offer";
  source_id: string;
  title: string;
  content: string;
  metadata: {
    city_id?: string;
    branch_id?: string;
    category_id?: string;
    product_id?: string;
    occasion_ids?: string[];
    price?: number;
    eggless?: boolean;
    vegan?: boolean;
    sugar_free?: boolean;
    gluten_free?: boolean;
    rating?: number;
    handle?: string;
    coupon_code?: string;
    discount_value?: number;
    pincodes?: string[];
    [key: string]: any;
  };
  language: string;
  status: "active" | "archived";
  version: number;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  source_type: string;
  source_id: string;
  title: string;
  content: string;
  token_count: number;
  keywords: string[];
  metadata: Record<string, any>;
  updated_at: string;
}

export interface SearchKnowledgeResult {
  chunk: KnowledgeChunk;
  score: number;
  matchType: "exact_keyword" | "semantic_token" | "hybrid";
}

export class KnowledgeBase {
  private static documents: Map<string, KnowledgeDocument> = new Map();
  private static chunks: Map<string, KnowledgeChunk> = new Map();
  private static keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> chunkIds
  private static isInitialized = false;

  /**
   * Tokenize string into normalized lowercase keywords
   */
  public static tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s₹%-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Register or update a knowledge document and generate its chunks
   */
  public static upsertDocument(doc: KnowledgeDocument): void {
    this.documents.set(doc.id, doc);

    // Remove existing chunks for this document from keyword index
    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.document_id === doc.id) {
        for (const kw of chunk.keywords) {
          const set = this.keywordIndex.get(kw);
          if (set) {
            set.delete(chunkId);
            if (set.size === 0) this.keywordIndex.delete(kw);
          }
        }
        this.chunks.delete(chunkId);
      }
    }

    if (doc.status === "archived") return;

    // Create chunks (for compact documents, 1-2 chunks per doc)
    const rawContent = `${doc.title}\n${doc.content}`;
    const keywords = Array.from(new Set(this.tokenize(`${doc.title} ${doc.content} ${JSON.stringify(doc.metadata)}`)));
    const chunkId = `chk_${doc.id}_0`;

    const chunk: KnowledgeChunk = {
      id: chunkId,
      document_id: doc.id,
      source_type: doc.source_type,
      source_id: doc.source_id,
      title: doc.title,
      content: doc.content,
      token_count: keywords.length,
      keywords,
      metadata: doc.metadata,
      updated_at: doc.updated_at,
    };

    this.chunks.set(chunkId, chunk);

    // Index keywords
    for (const kw of keywords) {
      if (!this.keywordIndex.has(kw)) {
        this.keywordIndex.set(kw, new Set());
      }
      this.keywordIndex.get(kw)!.add(chunkId);
    }
  }

  /**
   * Delete a document and its chunks
   */
  public static deleteDocument(docId: string): boolean {
    if (!this.documents.has(docId)) return false;
    this.documents.delete(docId);

    for (const [chunkId, chunk] of this.chunks.entries()) {
      if (chunk.document_id === docId) {
        for (const kw of chunk.keywords) {
          const set = this.keywordIndex.get(kw);
          if (set) set.delete(chunkId);
        }
        this.chunks.delete(chunkId);
      }
    }
    return true;
  }

  /**
   * Hybrid Search: BM25/keyword ranking with metadata filtering
   */
  public static search(
    query: string,
    filters?: {
      source_type?: string;
      city_id?: string;
      category_id?: string;
      eggless?: boolean;
      maxPrice?: number;
    },
    limit = 6
  ): SearchKnowledgeResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores: Map<string, { score: number; matchType: "exact_keyword" | "semantic_token" | "hybrid" }> = new Map();

    // 1. Exact phrase / keyword matching
    const cleanQuery = query.toLowerCase().trim();

    for (const token of queryTokens) {
      const matchingChunkIds = this.keywordIndex.get(token) || new Set();
      for (const chunkId of matchingChunkIds) {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) continue;

        // Apply metadata filters
        if (filters?.source_type && chunk.source_type !== filters.source_type) continue;
        if (filters?.eggless !== undefined && chunk.metadata.eggless !== undefined && chunk.metadata.eggless !== filters.eggless) continue;
        if (filters?.maxPrice !== undefined && chunk.metadata.price && chunk.metadata.price > filters.maxPrice) continue;

        const current = scores.get(chunkId) || { score: 0, matchType: "semantic_token" };
        
        // Exact title match weight
        let weight = 1.0;
        if (chunk.title.toLowerCase().includes(token)) weight += 2.0;
        if (chunk.title.toLowerCase() === cleanQuery) weight += 5.0;
        if (chunk.metadata.coupon_code && chunk.metadata.coupon_code.toLowerCase() === token) weight += 8.0;

        current.score += weight;
        scores.set(chunkId, current);
      }
    }

    // Convert to sorted array
    const results: SearchKnowledgeResult[] = [];
    for (const [chunkId, { score, matchType }] of scores.entries()) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        results.push({
          chunk,
          score,
          matchType: score > 3 ? "hybrid" : matchType,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get all registered documents
   */
  public static getAllDocuments(): KnowledgeDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document count by source
   */
  public static getStats(): {
    totalDocuments: number;
    totalChunks: number;
    sourceBreakdown: Record<string, number>;
  } {
    const breakdown: Record<string, number> = {};
    for (const doc of this.documents.values()) {
      breakdown[doc.source_type] = (breakdown[doc.source_type] || 0) + 1;
    }
    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.size,
      sourceBreakdown: breakdown,
    };
  }

  /**
   * Clear all knowledge base entries
   */
  public static clear(): void {
    this.documents.clear();
    this.chunks.clear();
    this.keywordIndex.clear();
    this.isInitialized = false;
  }
}
