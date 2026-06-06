// Shared API + intent types for Galla. Import in the frontend; mirror in the backend.
// Source of truth = AGENTS.md §3. Change only by mutual agreement.

export type IntentType = "log_sale" | "log_udhaar" | "log_miss" | "query" | "mark_done" | "unknown";
export type PayType = "cash" | "upi" | null;
export type QueryKind = "today_total" | "what_owed" | "cash_vs_upi" | null;

export interface Intent {
  type: IntentType;
  amount: number | null;
  pay_type: PayType;
  item: string | null;
  customer: string | null; // matched against contacts when possible
  query_kind: QueryKind;
}

export interface Sale {
  id: string;
  ts: string;
  type: "cash" | "upi";
  amount: number;
  item: string;
  customer_id?: string;
  status: string;
}

export interface Todo {
  id: string;
  ts: string;
  kind: "restock" | "collect" | "pay";
  text: string;
  status: "open" | "done";
  due?: string;
  // `collect` todos (udhaar) also carry these:
  amount?: number;
  customer?: string;
  customer_id?: string;
  phone?: string | null;
  item?: string | null;
  reminded?: boolean;
}

export interface Message {
  id: string;
  ts: string;
  to: string | null;
  channel: "whatsapp";
  body: string;
  link?: string;
  mock: boolean;
}

export interface Eod {
  total: number;
  cash: number;
  upi: number;
  sale_count: number;
  busiest_hours: string | null;
  top_items: { name: string; count: number }[];
  misses: string[];
}

// POST /turn
export type TurnMode = "text" | "wake" | "ambient";
export interface TurnRequest {
  mode: TurnMode;
  text?: string;
  audioBase64?: string;
}
export interface TurnResponse {
  transcript: string;
  intent: Intent;
  reply_text: string;
  reply_audio_url: string | null;
  changed: boolean;
}

// GET /state
export interface StateResponse {
  sales: Sale[];
  todos: Todo[];
  messages: Message[];
  eod: Eod;
}

// POST /collect/confirm
export interface CollectRequest { udhaar_id: string; }
export interface CollectResponse { message: Message; }
