// Matching logic for auto-match suggestion
export interface MatchSuggestion {
  orderId: string;
  invoiceId: string;
  score: number;
  reason: string;
}

// TODO: Implement matching by supplier, date ±X days, total amount ±tolerance
