/**
 * Keyword Trend & Competitor Analyzer
 * 
 * Computes:
 * - 90-day ranking position trajectories
 * - Position change (gainers / losers)
 * - Keyword grouping (brand | product | city | competitor)
 * - Competitor rank comparison
 */

export interface KeywordTrajectory {
  id: string;
  keyword: string;
  group: string;
  currentPosition: number;
  previousPosition: number;
  delta: number; // positive = gained positions, negative = dropped
  trend: "improving" | "declining" | "stable";
  searchVolume: number;
  difficulty: number;
  rankingHistory: { date: string; position: number }[];
}

export class KeywordAnalyzer {

  static analyzeKeywords(keywords: any[]): {
    trajectories: KeywordTrajectory[];
    topGainers: KeywordTrajectory[];
    topLosers: KeywordTrajectory[];
    averagePosition: number;
  } {
    let totalPosition = 0;
    let counted = 0;

    const trajectories: KeywordTrajectory[] = keywords.map((k) => {
      let history: { date: string; position: number }[] = [];
      try {
        history = JSON.parse(k.ranking_history || "[]");
      } catch { history = []; }

      const curr = k.current_position || 0;
      const prev = k.previous_position || curr;
      const delta = prev - curr; // position 3 is better than 8, so 8 - 3 = +5 improvement

      let trend: "improving" | "declining" | "stable" = "stable";
      if (delta > 0) trend = "improving";
      else if (delta < 0) trend = "declining";

      if (curr > 0) {
        totalPosition += curr;
        counted++;
      }

      return {
        id: k.id,
        keyword: k.keyword,
        group: k.group_id || "general",
        currentPosition: curr,
        previousPosition: prev,
        delta,
        trend,
        searchVolume: k.search_volume || 0,
        difficulty: k.difficulty || 0,
        rankingHistory: history,
      };
    });

    const topGainers = [...trajectories].filter(t => t.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
    const topLosers = [...trajectories].filter(t => t.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

    return {
      trajectories,
      topGainers,
      topLosers,
      averagePosition: counted > 0 ? Math.round((totalPosition / counted) * 10) / 10 : 0,
    };
  }
}
