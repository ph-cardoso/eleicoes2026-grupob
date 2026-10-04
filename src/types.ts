export interface Candidate { id: string; number: string; name: string; party: string; votes: number; percent: number | null; status: string; voteStatus: string; }
export interface Result {
  uf: string; office: number; election: string; round: number; source: string;
  sourceTime: string | null; fetchedAt: string; stale: boolean; warning?: string; released: boolean; final: boolean;
  sections: { total: number; counted: number; percent: number | null };
  voters: { turnout: number; abstention: number; turnoutPercent: number | null; abstentionPercent: number | null };
  votes: { total: number; valid: number; blank: number; null: number; blankPercent: number | null; nullPercent: number | null; validPercent: number | null };
  candidates: Candidate[];
}
export interface ScopeProgress {
  uf: string; total: number; counted: number; percent: number | null;
  registered: number | null; pendingVoters: number | null;
}
export interface Overview {
  election: string; source: string; sourceTime: string | null; fetchedAt: string;
  stale: boolean; warning?: string; scopes: ScopeProgress[];
}
