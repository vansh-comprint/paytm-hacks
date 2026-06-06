// Shared API + intent types for Galla. Import in the frontend; mirror in the backend.
// Source of truth = AGENTS.md §3. Change only by mutual agreement.

export type IntentType =
  | "log_sale" | "log_udhaar" | "log_miss" | "set_reminder" | "query" | "mark_done" | "unknown";
export type PayType = "cash" | "upi" | null;
export type QueryKind = "today_total" | "what_owed" | "cash_vs_upi" | null;
export type Direction = "in" | "out" | "unclear" | null; // cash: received | paid out | ambiguous

export interface Intent {
  type: IntentType;
  amount: number | null;
  pay_type: PayType;
  item: string | null;
  customer: string | null; // matched against contacts when possible
  query_kind: QueryKind;
  direction: Direction;    // for cash; "unclear" -> goes to the review queue
  when: string | null;     // for set_reminder: "in N minutes" | "today HH:MM" | "tomorrow HH:MM" | ...
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
  total: number;        // gross sales (cash + upi)
  cash: number;
  upi: number;
  expenses: number;     // cash paid out
  net_cash: number;     // cash - expenses (drawer)
  sale_count: number;
  busiest_hours: string | null;
  top_items: { name: string; count: number }[];
  misses: string[];
  to_review: number;    // open ambiguous-cash entries
}

// --- agent state (additive beyond §3) ---
export interface Expense { id: string; ts: string; amount: number; note: string; }
export interface Review { id: string; ts: string; amount: number; raw: string | null; reason: string; status: "open" | "resolved"; resolution?: "in" | "out" | "ignore"; }
export interface Scheduled {
  id: string; ts: string; fireAt: string; kind: "collect";
  customer: string; customer_id?: string; phone?: string | null; amount: number; item?: string | null;
  status: "pending" | "fired" | "error" | "cancelled"; firedAt?: string; message_id?: string; call_id?: string;
}
export interface Call { id: string; ts: string; kind: "order" | "collection"; to: string | null; name: string; script: string; audio_url: string | null; }
export interface Supplier { id: string; name: string; phone: string; supplies?: string; }
export interface Contact { id: string; name: string; phone: string; }
export interface Item { id: string; name: string; unit: string; price: number; }

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

// GET /state  (first four are the §3 contract; the rest are additive agent state)
export interface StateResponse {
  sales: Sale[];
  todos: Todo[];
  messages: Message[];
  eod: Eod;
  expenses: Expense[];
  reviews: Review[];
  scheduled: Scheduled[];
  calls: Call[];
  suppliers: Supplier[];
  contacts: Contact[];
  items: Item[];
  upi_txns: { ts: string; amount: number; ref: string; customer?: string }[];
}

// POST /collect/confirm  (tap-to-send a collection reminder; WhatsApp only)
export interface CollectRequest { udhaar_id: string; } // udhaar_id = a `collect` Todo id
export interface CollectResponse { message: Message; }

// POST /procure/confirm  (approve a pending restock order -> WhatsApp + simulated call to the supplier)
export interface ProcureRequest { todo_id: string; }   // todo_id = a `restock` Todo id
export interface ProcureResponse { message: Message; call: Call; todo: Todo; }

// POST /review/resolve  (resolve an ambiguous-cash entry)
export interface ReviewResolveRequest { review_id: string; resolution: "in" | "out" | "ignore"; }
export interface ReviewResolveResponse { review: Review; eod: Eod; }

// POST /todo/done  (mark any todo — collect or restock — as done)
export interface TodoDoneRequest { todo_id: string; }  // todo_id = any Todo id
export interface TodoDoneResponse { todo: Todo; }

// POST /reminders  (schedule a collection reminder from the UI -> auto WhatsApp + simulated call at fireAt)
export interface ScheduleReminderRequest {
  udhaar_id?: string;   // a `collect` Todo id — reuses its customer/amount/phone/item
  customer?: string;    // OR pass customer + amount directly
  amount?: number;
  item?: string;
  phone?: string;
  when: string;         // "in N minutes" | "in N hours" | "in N days" | "today HH:MM" | "tomorrow HH:MM" | "6 baje"
}
export interface ScheduleReminderResponse { scheduled: Scheduled; }

// POST /reminders/cancel  (cancel a PENDING reminder; cancelled jobs never fire)
export interface CancelReminderRequest { id: string; }   // id = a Scheduled job id
export interface CancelReminderResponse { scheduled: Scheduled; }
