"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

type DebtType = "lent" | "borrowed";
type DebtStatus = "pending" | "settled";
type TypeFilter = "all" | "lent" | "borrowed";
type StatusFilter = "pending" | "settled" | "all";

interface SubAccount {
  subaccount_id: string;
  account_id: string;
  subaccount_name: string;
  subaccount_value: number;
  is_active: boolean;
}

interface Account {
  account_id: string;
  account_name: string;
  account_type: string;
  account_balance: number;
  is_active: boolean;
  is_credit_card: boolean;
  subaccounts: SubAccount[];
}

interface DebtRecord {
  debts_id: string;
  user_id: string;
  debts_type: DebtType;
  debts_name: string;
  debts_person: string;
  debts_amount: number;
  debts_date: string; // YYYY-MM-DD
  debts_due_date: string | null; // YYYY-MM-DD
  debts_notes: string | null;
  status: DebtStatus;
  settled_at: string | null; // YYYY-MM-DD
  account_id: string | null;
  subaccount_id: string | null;
  transaction_id: string | null;
  settled_account_id: string | null;
  settled_subaccount_id: string | null;
  settled_transaction_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface BalanceChange {
  accountId: string;
  subaccountId: string | null;
  delta: number;
}

interface AccountImpactPreview {
  accountId: string;
  subaccountId: string | null;
  accountLabel: string;
  delta: number;
  balanceNow: number;
  balanceAfter: number;
}

interface PendingDebtSave {
  mode: "add" | "edit";
  type: DebtType;
  name: string;
  person: string;
  amount: number;
  date: string;
  dueDate: string | null;
  notes: string | null;
  reflectInAccount: boolean;
  account: Account | null;
  sub: SubAccount | null;
  editing: DebtRecord | null;
  balanceChanges: BalanceChange[];
  impacts: AccountImpactPreview[];
}

// Transaction categories used by Debts
const DEBT_LENT_EXPENSE_CATEGORY = "Debt / Lending";
const DEBT_BORROWED_INCOME_CATEGORY = "Debt Borrowed";
const DEBT_SETTLED_LENT_INCOME_CATEGORY = "Payback / Reimbursement";
const DEBT_SETTLED_BORROWED_EXPENSE_CATEGORY = "Debt Repayment";

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #eef2ed",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.78rem",
  fontWeight: 500,
  color: "#2e4738",
  cursor: "pointer",
  userSelect: "none",
};

const checkboxInputStyle: React.CSSProperties = {
  width: "15px",
  height: "15px",
  accentColor: "#69a980",
  cursor: "pointer",
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedRM(amount: number): string {
  if (amount < 0) {
    return `-RM ${formatAmount(amount)}`;
  }
  return `RM ${formatAmount(amount)}`;
}

function formatCentsInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (cents === 0) {
    return rawValue === "0" ? "0.00" : "";
  }
  return (cents / 100).toFixed(2);
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Strictly formats any YYYY-MM-DD date string into DD-MM-YYYY
function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// How creating a debt affects the linked account balance:
// - 'lent' (someone borrows from you): money leaves your account (-amount)
// - 'borrowed' (you borrow from someone): money enters your account (+amount)
function getCreationAccountDelta(type: DebtType, amount: number): number {
  return type === "lent" ? -amount : amount;
}

// How settling a debt affects the linked settlement account balance:
// - 'lent' settled (someone pays you back): money enters your account (+amount)
// - 'borrowed' settled (you pay someone back): money leaves your account (-amount)
function getSettlementAccountDelta(type: DebtType, amount: number): number {
  return type === "lent" ? amount : -amount;
}

function getUnallocated(account: Account): number {
  const allocated = account.subaccounts.reduce(
    (sum, s) => sum + Number(s.subaccount_value),
    0
  );
  return Math.max(0, round2(account.account_balance - allocated));
}

function getAvailableBalance(account: Account, subaccountId: string): number {
  if (subaccountId) {
    const sub = account.subaccounts.find(
      (s) => s.subaccount_id === subaccountId
    );
    return sub ? sub.subaccount_value : 0;
  }
  if (account.subaccounts.length > 0) {
    return getUnallocated(account);
  }
  return account.account_balance;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function getDueStatus(
  dueDate: string | null,
  status: DebtStatus,
  todayStr: string
): {
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  daysDiff: number | null;
} {
  if (!dueDate || status === "settled") {
    return {
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      daysDiff: null,
    };
  }
  const dueMs = new Date(`${dueDate}T00:00:00`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
  const daysDiff = Math.round((dueMs - todayMs) / 86400000);
  return {
    isOverdue: daysDiff < 0,
    isDueToday: daysDiff === 0,
    isDueSoon: daysDiff > 0 && daysDiff <= 7,
    daysDiff,
  };
}

// Custom Date Input that always displays DD-MM-YYYY while using native calendar picker
function DateInputDDMMYYYY({
  value,
  onChange,
  placeholder = "DD-MM-YYYY",
  required = false,
  allowClear = false,
  max,
  min,
}: {
  value: string;
  onChange: (newVal: string) => void;
  placeholder?: string;
  required?: boolean;
  allowClear?: boolean;
  max?: string;
  min?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Fallback to focus
      }
    }
    el.focus();
  };

  return (
    <div
      onClick={openPicker}
      className="fintrack-modal-input d-flex align-items-center justify-content-between position-relative"
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      <span
        style={{
          color: value ? "#1a2e23" : "#94a39a",
          fontSize: "0.88rem",
          fontWeight: value ? 500 : 400,
        }}
      >
        {value ? formatDisplayDate(value) : placeholder}
      </span>

      <div
        className="d-flex align-items-center gap-2"
        style={{ position: "relative", zIndex: 2 }}
      >
        {allowClear && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="btn btn-sm p-0 border-0 text-secondary"
            title="Clear date"
            style={{ lineHeight: 1 }}
          >
            <i className="bi bi-x-circle-fill" style={{ fontSize: "0.82rem" }} />
          </button>
        )}
        <i
          className="bi bi-calendar3"
          style={{ color: "#6b7f72", fontSize: "0.88rem" }}
        />
      </div>

      <input
        ref={inputRef}
        type="date"
        value={value}
        required={required}
        max={max}
        min={min}
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          width: "100%",
          height: "100%",
          cursor: "pointer",
          zIndex: 1,
        }}
      />
    </div>
  );
}

function SummaryTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "#f9fbf7",
        border: "1px solid #e6ece7",
        borderRadius: "14px",
        overflow: "hidden",
        marginBottom: "20px",
      }}
    >
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = "#1a2e23",
  bold = false,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="d-flex justify-content-between align-items-center gap-3"
      style={{
        padding: "11px 16px",
        borderBottom: last ? "none" : "1px solid #e9efe9",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "#6b7f72",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        className="text-end"
        style={{
          fontSize: "0.84rem",
          fontWeight: bold ? 700 : 600,
          color: valueColor,
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#dc2626",
        borderRadius: "10px",
        padding: "9px 12px",
        fontSize: "0.78rem",
        marginBottom: "14px",
      }}
    >
      <i className="bi bi-exclamation-circle me-1" />
      {message}
    </div>
  );
}

export default function DebtsPage() {
  const supabase = useMemo(() => createClient(), []);

  // ==========================================
  // CORE DATA STATE
  // ==========================================
  const [userId, setUserId] = useState<string | null>(null);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allSubAccounts, setAllSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ==========================================
  // FILTER & SEARCH STATE
  // ==========================================
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ==========================================
  // MODAL 1: ADD / EDIT DEBT STATE
  // ==========================================
  const [debtModalOpen, setDebtModalOpen] = useState<boolean>(false);
  const [debtModalMode, setDebtModalMode] = useState<"add" | "edit">("add");
  const [editingDebt, setEditingDebt] = useState<DebtRecord | null>(null);
  const [debtType, setDebtType] = useState<DebtType>("lent");
  const [debtAmountInput, setDebtAmountInput] = useState<string>("");
  const [debtPerson, setDebtPerson] = useState<string>("");
  const [debtName, setDebtName] = useState<string>("");
  const [debtDate, setDebtDate] = useState<string>(getTodayDateString());
  const [debtDueDate, setDebtDueDate] = useState<string>("");
  const [debtNotes, setDebtNotes] = useState<string>("");
  const [reflectInAccount, setReflectInAccount] = useState<boolean>(true);
  const [debtAccountId, setDebtAccountId] = useState<string>("");
  const [debtSubId, setDebtSubId] = useState<string>("");
  const [debtModalError, setDebtModalError] = useState<string | null>(null);
  const [savingDebt, setSavingDebt] = useState<boolean>(false);

  // ==========================================
  // MODAL 2: REVIEW ACCOUNT IMPACT BEFORE SAVING
  // ==========================================
  const [pendingSave, setPendingSave] = useState<PendingDebtSave | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ==========================================
  // MODAL 3: MARK SETTLED CONFIRMATION MODAL
  // ==========================================
  const [settlingDebt, setSettlingDebt] = useState<DebtRecord | null>(null);
  const [settleDate, setSettleDate] = useState<string>(getTodayDateString());
  const [settleReflectInAccount, setSettleReflectInAccount] =
    useState<boolean>(true);
  const [settleAccountId, setSettleAccountId] = useState<string>("");
  const [settleSubId, setSettleSubId] = useState<string>("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settlingLoading, setSettlingLoading] = useState<boolean>(false);

  // ==========================================
  // MODAL 4: REOPEN SETTLED DEBT MODAL
  // ==========================================
  const [reopeningDebt, setReopeningDebt] = useState<DebtRecord | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopeningLoading, setReopeningLoading] = useState<boolean>(false);

  // ==========================================
  // MODAL 5: DELETE DEBT MODAL
  // ==========================================
  const [deletingDebt, setDeletingDebt] = useState<DebtRecord | null>(null);
  const [reverseLinkedOnDelete, setReverseLinkedOnDelete] =
    useState<boolean>(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState<boolean>(false);

  // ==========================================
  // BOTTOM TOAST STATE
  // ==========================================
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<BottomToastType>("success");

  const showToast = useCallback(
    (message: string, type: BottomToastType = "success") => {
      setToastMessage(message);
      setToastType(type);
      setToastOpen(true);
    },
    []
  );

  const activeAccounts = useMemo(
    () =>
      allAccounts.filter(
        (a) =>
          a.is_active &&
          !a.is_credit_card &&
          a.account_type !== "Credit Card"
      ),
    [allAccounts]
  );

  // ==========================================
  // FETCH DATA FROM SUPABASE
  // ==========================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || null,
          preferred_name: user.user_metadata?.preferred_name || null,
        },
        { onConflict: "id" }
      );

      const [debtsRes, accountsRes, subaccountsRes] = await Promise.all([
        supabase
          .from("debts")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("subaccounts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (debtsRes.error) throw debtsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;

      const subs: SubAccount[] = (subaccountsRes.data || []).map((sub) => ({
        subaccount_id: sub.subaccount_id,
        account_id: sub.account_id,
        subaccount_name: sub.subaccount_name,
        subaccount_value: Number(sub.subaccount_value),
        is_active: sub.is_active,
      }));

      const accounts: Account[] = (accountsRes.data || []).map((acc) => ({
        account_id: acc.account_id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        account_balance: Number(acc.account_balance),
        is_active: acc.is_active,
        is_credit_card: Boolean(
          acc.is_credit_card || acc.account_type === "Credit Card"
        ),
        subaccounts: subs.filter(
          (s) => s.account_id === acc.account_id && s.is_active
        ),
      }));

      const mappedDebts: DebtRecord[] = (debtsRes.data || []).map((row) => ({
        debts_id: row.debts_id,
        user_id: row.user_id,
        debts_type: row.debts_type as DebtType,
        debts_name: row.debts_name,
        debts_person: row.debts_person,
        debts_amount: Number(row.debts_amount),
        debts_date: row.debts_date,
        debts_due_date: row.debts_due_date,
        debts_notes: row.debts_notes,
        status: row.status as DebtStatus,
        settled_at: row.settled_at,
        account_id: row.account_id,
        subaccount_id: row.subaccount_id,
        transaction_id: row.transaction_id,
        settled_account_id: row.settled_account_id,
        settled_subaccount_id: row.settled_subaccount_id,
        settled_transaction_id: row.settled_transaction_id,
        is_active: row.is_active,
        created_at: row.created_at,
      }));

      setAllSubAccounts(subs);
      setAllAccounts(accounts);
      setDebts(mappedDebts);
    } catch (err) {
      console.error("Failed to load debts:", err);
      setLoadError(getErrorMessage(err, "Failed to load your debts."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // LABELS & HELPERS
  // ==========================================
  const getAccountLabel = useCallback(
    (accountId: string | null, subaccountId: string | null): string => {
      if (!accountId) return "No account";
      const acc = allAccounts.find((a) => a.account_id === accountId);
      const sub = subaccountId
        ? allSubAccounts.find((s) => s.subaccount_id === subaccountId)
        : null;
      const accName = acc
        ? `${acc.account_name}${acc.is_active ? "" : " (removed)"}`
        : "Removed account";
      return sub ? `${accName} · ${sub.subaccount_name}` : accName;
    },
    [allAccounts, allSubAccounts]
  );

  // Build preview rows showing how each affected account's balance will change
  const buildAccountImpactPreviews = useCallback(
    (changes: BalanceChange[]): AccountImpactPreview[] => {
      const grouped = new Map<
        string,
        { accountId: string; subaccountId: string | null; delta: number }
      >();

      changes.forEach((ch) => {
        if (!ch.accountId || Math.abs(ch.delta) < 0.001) return;
        const existing = grouped.get(ch.accountId);
        if (existing) {
          existing.delta = round2(existing.delta + ch.delta);
          if (ch.subaccountId) existing.subaccountId = ch.subaccountId;
        } else {
          grouped.set(ch.accountId, {
            accountId: ch.accountId,
            subaccountId: ch.subaccountId,
            delta: round2(ch.delta),
          });
        }
      });

      const previews: AccountImpactPreview[] = [];
      grouped.forEach((item) => {
        if (Math.abs(item.delta) < 0.001) return;
        const acc = allAccounts.find((a) => a.account_id === item.accountId);
        const now = acc ? acc.account_balance : 0;
        previews.push({
          accountId: item.accountId,
          subaccountId: item.subaccountId,
          accountLabel: getAccountLabel(item.accountId, item.subaccountId),
          delta: item.delta,
          balanceNow: now,
          balanceAfter: round2(now + item.delta),
        });
      });

      return previews;
    },
    [allAccounts, getAccountLabel]
  );

  const applyBalanceChanges = async (changes: BalanceChange[]) => {
    if (!userId) return;
    const accountDeltas = new Map<string, number>();
    const subDeltas = new Map<string, number>();

    changes.forEach((ch) => {
      if (!ch.accountId || Math.abs(ch.delta) < 0.001) return;
      accountDeltas.set(
        ch.accountId,
        round2((accountDeltas.get(ch.accountId) || 0) + ch.delta)
      );
      if (ch.subaccountId) {
        subDeltas.set(
          ch.subaccountId,
          round2((subDeltas.get(ch.subaccountId) || 0) + ch.delta)
        );
      }
    });

    for (const [accountId, delta] of Array.from(accountDeltas.entries())) {
      const acc = allAccounts.find((a) => a.account_id === accountId);
      if (!acc || Math.abs(delta) < 0.001) continue;
      const { error } = await supabase
        .from("accounts")
        .update({ account_balance: round2(acc.account_balance + delta) })
        .eq("account_id", accountId)
        .eq("user_id", userId);
      if (error) throw error;
    }

    for (const [subId, delta] of Array.from(subDeltas.entries())) {
      const sub = allSubAccounts.find((s) => s.subaccount_id === subId);
      if (!sub || Math.abs(delta) < 0.001) continue;
      const { error } = await supabase
        .from("subaccounts")
        .update({
          subaccount_value: Math.max(0, round2(sub.subaccount_value + delta)),
        })
        .eq("subaccount_id", subId)
        .eq("user_id", userId);
      if (error) throw error;
    }
  };

  // ==========================================
  // DERIVED SUMMARY & FILTERED DEBTS
  // ==========================================
  const todayStr = getTodayDateString();

  const summary = useMemo(() => {
    let owedToYouPending = 0;
    let youOwePending = 0;
    let pendingLentCount = 0;
    let pendingBorrowedCount = 0;
    let pendingCount = 0;
    let settledCount = 0;
    let overdueCount = 0;

    debts.forEach((d) => {
      if (d.status === "pending") {
        pendingCount += 1;
        if (d.debts_type === "lent") {
          owedToYouPending += d.debts_amount;
          pendingLentCount += 1;
        } else {
          youOwePending += d.debts_amount;
          pendingBorrowedCount += 1;
        }
        const due = getDueStatus(d.debts_due_date, d.status, todayStr);
        if (due.isOverdue) overdueCount += 1;
      } else {
        settledCount += 1;
      }
    });

    return {
      owedToYouPending: round2(owedToYouPending),
      youOwePending: round2(youOwePending),
      netPosition: round2(owedToYouPending - youOwePending),
      pendingLentCount,
      pendingBorrowedCount,
      pendingCount,
      settledCount,
      overdueCount,
    };
  }, [debts, todayStr]);

  // Counts scoped to the active Type tab (All / Lent / Borrowed)
  const scopedStatusCounts = useMemo(() => {
    let pending = 0;
    let settled = 0;
    debts.forEach((d) => {
      if (typeFilter !== "all" && d.debts_type !== typeFilter) return;
      if (d.status === "pending") pending += 1;
      else settled += 1;
    });
    return { pending, settled, total: pending + settled };
  }, [debts, typeFilter]);

  const filteredDebts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return debts.filter((d) => {
      if (typeFilter !== "all" && d.debts_type !== typeFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (q) {
        const haystack = [
          d.debts_person,
          d.debts_name,
          d.debts_notes || "",
          d.debts_type,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [debts, typeFilter, statusFilter, searchQuery]);

  // ==========================================
  // TRANSACTION DESCRIPTION BUILDERS
  // ==========================================
  const buildCreationTxDescription = (
    type: DebtType,
    person: string,
    name: string
  ): string =>
    type === "lent"
      ? `Lent to ${person} — ${name}`
      : `Borrowed from ${person} — ${name}`;

  const buildSettlementTxDescription = (
    type: DebtType,
    person: string,
    name: string
  ): string =>
    type === "lent"
      ? `Debt settled by ${person} — ${name}`
      : `Paid back ${person} — ${name}`;

  // ==========================================
  // ACCOUNT SELECTION HELPERS FOR MODALS
  // ==========================================
  const selectDefaultSubForAccount = useCallback(
    (accountId: string, moneyLeavingAccount: boolean): string => {
      const acc = activeAccounts.find((a) => a.account_id === accountId);
      if (
        moneyLeavingAccount &&
        acc &&
        acc.subaccounts.length > 0 &&
        getUnallocated(acc) <= 0.001
      ) {
        return acc.subaccounts[0].subaccount_id;
      }
      return "";
    },
    [activeAccounts]
  );

  const handleDebtTypeChange = (newType: DebtType) => {
    setDebtType(newType);
    if (debtAccountId) {
      setDebtSubId(
        selectDefaultSubForAccount(debtAccountId, newType === "lent")
      );
    }
  };

  const handleDebtAccountChange = (newAccountId: string) => {
    setDebtAccountId(newAccountId);
    setDebtSubId(
      selectDefaultSubForAccount(newAccountId, debtType === "lent")
    );
  };

  const handleSettleAccountChange = (newAccountId: string) => {
    setSettleAccountId(newAccountId);
    const moneyLeaving = settlingDebt?.debts_type === "borrowed";
    setSettleSubId(selectDefaultSubForAccount(newAccountId, moneyLeaving));
  };

  // ==========================================
  // HANDLERS: OPEN ADD / EDIT DEBT MODAL
  // ==========================================
  const openCreateDebt = () => {
    const firstAccId = activeAccounts[0]?.account_id || "";
    setDebtModalMode("add");
    setEditingDebt(null);
    setDebtType("lent");
    setDebtAmountInput("");
    setDebtPerson("");
    setDebtName("");
    setDebtDate(getTodayDateString());
    setDebtDueDate("");
    setDebtNotes("");
    setReflectInAccount(activeAccounts.length > 0);
    setDebtAccountId(firstAccId);
    setDebtSubId(selectDefaultSubForAccount(firstAccId, true));
    setDebtModalError(null);
    setDebtModalOpen(true);
  };

  const openEditDebt = (d: DebtRecord) => {
    const fallbackAccId = activeAccounts[0]?.account_id || "";
    const initialAccId = d.account_id || fallbackAccId;
    setDebtModalMode("edit");
    setEditingDebt(d);
    setDebtType(d.debts_type);
    setDebtAmountInput(d.debts_amount.toFixed(2));
    setDebtPerson(d.debts_person);
    setDebtName(d.debts_name);
    setDebtDate(d.debts_date);
    setDebtDueDate(d.debts_due_date || "");
    setDebtNotes(d.debts_notes || "");
    setReflectInAccount(!!d.transaction_id);
    setDebtAccountId(initialAccId);
    setDebtSubId(
      d.account_id
        ? d.subaccount_id || ""
        : selectDefaultSubForAccount(initialAccId, d.debts_type === "lent")
    );
    setDebtModalError(null);
    setDebtModalOpen(true);
  };

  // ==========================================
  // EXECUTE CREATE / EDIT DEBT IN SUPABASE
  // ==========================================
  const executeDebtSave = async (p: PendingDebtSave) => {
    if (!userId) return;
    const txTime =
      p.date === getTodayDateString() ? getCurrentTimeString() : "23:59";
    const creationDesc = buildCreationTxDescription(p.type, p.person, p.name);
    const isLent = p.type === "lent";

    if (p.mode === "add") {
      let transactionId: string | null = null;

      // 1. Create linked transaction if reflecting in an account
      if (p.reflectInAccount && p.account) {
        const { data: txRow, error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: p.account.account_id,
            subaccount_id: p.sub ? p.sub.subaccount_id : null,
            transaction_type: isLent ? "expense" : "income",
            amount: p.amount,
            description: creationDesc,
            expense_category: isLent ? DEBT_LENT_EXPENSE_CATEGORY : null,
            income_category: isLent ? null : DEBT_BORROWED_INCOME_CATEGORY,
            transaction_date: p.date,
            transaction_time: txTime,
            is_active: true,
          })
          .select("transaction_id")
          .single();
        if (txError) throw txError;
        transactionId = txRow.transaction_id;
      }

      // 2. Insert the debt record
      const { error: debtErr } = await supabase.from("debts").insert({
        user_id: userId,
        debts_type: p.type,
        debts_name: p.name,
        debts_person: p.person,
        debts_amount: p.amount,
        debts_date: p.date,
        debts_due_date: p.dueDate,
        debts_notes: p.notes,
        status: "pending",
        settled_at: null,
        account_id: p.reflectInAccount && p.account ? p.account.account_id : null,
        subaccount_id:
          p.reflectInAccount && p.sub ? p.sub.subaccount_id : null,
        transaction_id: transactionId,
        is_active: true,
      });

      if (debtErr) {
        if (transactionId) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .eq("transaction_id", transactionId)
            .eq("user_id", userId);
        }
        throw debtErr;
      }

      // 3. Apply account & sub-account balance changes
      if (p.balanceChanges.length > 0) {
        await applyBalanceChanges(p.balanceChanges);
      }
      return;
    }

    // EDIT MODE
    const old = p.editing;
    if (!old) return;

    let newTransactionId: string | null = old.transaction_id;
    let newAccountId: string | null =
      p.reflectInAccount && p.account ? p.account.account_id : null;
    let newSubId: string | null =
      p.reflectInAccount && p.sub ? p.sub.subaccount_id : null;

    if (old.transaction_id && p.reflectInAccount && p.account) {
      // Update existing creation transaction
      const txUpdate: Record<string, string | number | null> = {
        account_id: p.account.account_id,
        subaccount_id: p.sub ? p.sub.subaccount_id : null,
        transaction_type: isLent ? "expense" : "income",
        amount: p.amount,
        description: creationDesc,
        expense_category: isLent ? DEBT_LENT_EXPENSE_CATEGORY : null,
        income_category: isLent ? null : DEBT_BORROWED_INCOME_CATEGORY,
        transaction_date: p.date,
      };
      if (p.date !== old.debts_date) {
        txUpdate.transaction_time = txTime;
      }
      const { error: txErr } = await supabase
        .from("transactions")
        .update(txUpdate)
        .eq("transaction_id", old.transaction_id)
        .eq("user_id", userId);
      if (txErr) throw txErr;
    } else if (old.transaction_id && !p.reflectInAccount) {
      // User unchecked account reflection: cancel the old creation transaction
      const { error: txErr } = await supabase
        .from("transactions")
        .update({ is_active: false })
        .eq("transaction_id", old.transaction_id)
        .eq("user_id", userId);
      if (txErr) throw txErr;
      newTransactionId = null;
      newAccountId = null;
      newSubId = null;
    } else if (!old.transaction_id && p.reflectInAccount && p.account) {
      // User newly enabled account reflection on an existing unlinked debt
      const { data: txRow, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          account_id: p.account.account_id,
          subaccount_id: p.sub ? p.sub.subaccount_id : null,
          transaction_type: isLent ? "expense" : "income",
          amount: p.amount,
          description: creationDesc,
          expense_category: isLent ? DEBT_LENT_EXPENSE_CATEGORY : null,
          income_category: isLent ? null : DEBT_BORROWED_INCOME_CATEGORY,
          transaction_date: p.date,
          transaction_time: txTime,
          is_active: true,
        })
        .select("transaction_id")
        .single();
      if (txErr) throw txErr;
      newTransactionId = txRow.transaction_id;
    }

    // If the debt is already settled and has a linked settlement transaction, keep it synced too
    if (old.status === "settled" && old.settled_transaction_id) {
      const settleDesc = buildSettlementTxDescription(
        p.type,
        p.person,
        p.name
      );
      const { error: settleTxErr } = await supabase
        .from("transactions")
        .update({
          transaction_type: isLent ? "income" : "expense",
          amount: p.amount,
          description: settleDesc,
          expense_category: isLent
            ? null
            : DEBT_SETTLED_BORROWED_EXPENSE_CATEGORY,
          income_category: isLent
            ? DEBT_SETTLED_LENT_INCOME_CATEGORY
            : null,
        })
        .eq("transaction_id", old.settled_transaction_id)
        .eq("user_id", userId);
      if (settleTxErr) throw settleTxErr;
    }

    // Update the debt row itself
    const { error: updateErr } = await supabase
      .from("debts")
      .update({
        debts_type: p.type,
        debts_name: p.name,
        debts_person: p.person,
        debts_amount: p.amount,
        debts_date: p.date,
        debts_due_date: p.dueDate,
        debts_notes: p.notes,
        account_id: newAccountId,
        subaccount_id: newSubId,
        transaction_id: newTransactionId,
      })
      .eq("debts_id", old.debts_id)
      .eq("user_id", userId);
    if (updateErr) throw updateErr;

    // Apply any account balance adjustments
    if (p.balanceChanges.length > 0) {
      await applyBalanceChanges(p.balanceChanges);
    }
  };

  const getSaveToastMessage = (p: PendingDebtSave): string => {
    if (p.mode === "edit") {
      return `Debt with "${p.person}" updated`;
    }
    return p.type === "lent"
      ? `Lent RM ${formatAmount(p.amount)} to "${p.person}" recorded`
      : `Borrowed RM ${formatAmount(p.amount)} from "${p.person}" recorded`;
  };

  // ==========================================
  // VALIDATE & PREPARE ADD / EDIT DEBT SUBMIT
  // ==========================================
  const handleDebtFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDebtModalError(null);
    if (!userId) return;

    const person = debtPerson.trim();
    if (!person) {
      setDebtModalError("Please enter the person's name.");
      return;
    }

    const name = debtName.trim();
    if (!name) {
      setDebtModalError(
        "Please enter a short title or reason (e.g. Car service)."
      );
      return;
    }

    const parsedAmount = parseFloat(debtAmountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setDebtModalError("Please enter an amount greater than RM 0.00.");
      return;
    }
    const amount = round2(parsedAmount);

    if (!debtDate) {
      setDebtModalError("Please select the date this debt occurred.");
      return;
    }
    if (debtDate > getTodayDateString()) {
      setDebtModalError("Debt date cannot be in the future.");
      return;
    }

    if (debtDueDate && debtDueDate < debtDate) {
      setDebtModalError(
        "Due date cannot be earlier than the date the debt was recorded."
      );
      return;
    }

    const selectedAcc = reflectInAccount
      ? allAccounts.find((a) => a.account_id === debtAccountId) || null
      : null;
    const selectedSub =
      reflectInAccount && selectedAcc && debtSubId
        ? allSubAccounts.find((s) => s.subaccount_id === debtSubId) || null
        : null;

    if (reflectInAccount && !selectedAcc) {
      setDebtModalError("Please select an account to reflect this debt in.");
      return;
    }

    // Calculate net balance changes across accounts
    const changes: BalanceChange[] = [];

    if (debtModalMode === "add") {
      if (reflectInAccount && selectedAcc) {
        if (debtType === "lent") {
          if (
            selectedAcc.subaccounts.length > 0 &&
            !selectedSub &&
            getUnallocated(selectedAcc) <= 0
          ) {
            setDebtModalError(
              `All funds in "${selectedAcc.account_name}" are allocated to sub-accounts. Please pick a sub-account.`
            );
            return;
          }
          const available = getAvailableBalance(selectedAcc, debtSubId);
          if (amount > available + 0.001) {
            setDebtModalError(
              `Not enough balance in ${getAccountLabel(
                selectedAcc.account_id,
                selectedSub ? selectedSub.subaccount_id : null
              )} to lend RM ${formatAmount(amount)} (RM ${formatAmount(
                available
              )} available).`
            );
            return;
          }
        }

        changes.push({
          accountId: selectedAcc.account_id,
          subaccountId: selectedSub ? selectedSub.subaccount_id : null,
          delta: getCreationAccountDelta(debtType, amount),
        });
      }
    } else if (editingDebt) {
      const old = editingDebt;

      // 1. Reverse old creation impact if it was linked to an account
      if (old.transaction_id && old.account_id) {
        changes.push({
          accountId: old.account_id,
          subaccountId: old.subaccount_id,
          delta: -getCreationAccountDelta(old.debts_type, old.debts_amount),
        });
      }

      // 2. Apply new creation impact if reflecting in an account
      if (reflectInAccount && selectedAcc) {
        changes.push({
          accountId: selectedAcc.account_id,
          subaccountId: selectedSub ? selectedSub.subaccount_id : null,
          delta: getCreationAccountDelta(debtType, amount),
        });
      }

      // 3. If the debt is already settled and linked to a settlement transaction, adjust settlement impact too
      if (
        old.status === "settled" &&
        old.settled_transaction_id &&
        old.settled_account_id
      ) {
        changes.push({
          accountId: old.settled_account_id,
          subaccountId: old.settled_subaccount_id,
          delta: -getSettlementAccountDelta(old.debts_type, old.debts_amount),
        });
        changes.push({
          accountId: old.settled_account_id,
          subaccountId: old.settled_subaccount_id,
          delta: getSettlementAccountDelta(debtType, amount),
        });
      }

      // Validate that no account or sub-account is overdrawn by the net change
      const netByKey = new Map<
        string,
        { accountId: string; subaccountId: string | null; delta: number }
      >();
      changes.forEach((ch) => {
        const key = `${ch.accountId}::${ch.subaccountId || ""}`;
        const prev = netByKey.get(key);
        if (prev) {
          prev.delta = round2(prev.delta + ch.delta);
        } else {
          netByKey.set(key, { ...ch, delta: round2(ch.delta) });
        }
      });

      for (const item of Array.from(netByKey.values())) {
        if (item.delta < -0.001) {
          const acc = allAccounts.find((a) => a.account_id === item.accountId);
          if (acc) {
            if (
              acc.subaccounts.length > 0 &&
              !item.subaccountId &&
              getUnallocated(acc) <= 0
            ) {
              setDebtModalError(
                `All funds in "${acc.account_name}" are allocated to sub-accounts. Please pick a sub-account.`
              );
              return;
            }
            const available = getAvailableBalance(
              acc,
              item.subaccountId || ""
            );
            if (-item.delta > available + 0.001) {
              setDebtModalError(
                `Not enough balance in ${getAccountLabel(
                  item.accountId,
                  item.subaccountId
                )} to cover RM ${formatAmount(
                  -item.delta
                )} (RM ${formatAmount(available)} available).`
              );
              return;
            }
          }
        }
      }
    }

    const impacts = buildAccountImpactPreviews(changes);
    const pendingPayload: PendingDebtSave = {
      mode: debtModalMode,
      type: debtType,
      name,
      person,
      amount,
      date: debtDate,
      dueDate: debtDueDate || null,
      notes: debtNotes.trim() || null,
      reflectInAccount,
      account: selectedAcc,
      sub: selectedSub,
      editing: editingDebt,
      balanceChanges: changes,
      impacts,
    };

    // If any account balance will move, show the Review & Confirm Modal first
    if (impacts.length > 0) {
      setReviewError(null);
      setPendingSave(pendingPayload);
      setDebtModalOpen(false);
      return;
    }

    // Otherwise save directly
    setSavingDebt(true);
    try {
      await executeDebtSave(pendingPayload);
      setDebtModalOpen(false);
      showToast(getSaveToastMessage(pendingPayload), "success");
      await fetchData();
    } catch (err) {
      setDebtModalError(getErrorMessage(err, "Failed to save debt record."));
    } finally {
      setSavingDebt(false);
    }
  };

  const handleConfirmPendingSave = async () => {
    if (!pendingSave) return;
    setReviewError(null);
    setSavingDebt(true);
    try {
      await executeDebtSave(pendingSave);
      const msg = getSaveToastMessage(pendingSave);
      setPendingSave(null);
      showToast(msg, "success");
      await fetchData();
    } catch (err) {
      setReviewError(getErrorMessage(err, "Failed to save debt record."));
    } finally {
      setSavingDebt(false);
    }
  };

  const handleReviewBack = () => {
    setPendingSave(null);
    setDebtModalOpen(true);
  };

  // ==========================================
  // HANDLERS: MARK SETTLED MODAL
  // ==========================================
  const openSettleModal = (d: DebtRecord) => {
    const defaultAccId =
      d.account_id && activeAccounts.some((a) => a.account_id === d.account_id)
        ? d.account_id
        : activeAccounts[0]?.account_id || "";

    let defaultSubId = "";
    if (defaultAccId === d.account_id && d.subaccount_id) {
      const acc = activeAccounts.find((a) => a.account_id === defaultAccId);
      if (acc?.subaccounts.some((s) => s.subaccount_id === d.subaccount_id)) {
        defaultSubId = d.subaccount_id;
      }
    }
    if (!defaultSubId && defaultAccId) {
      defaultSubId = selectDefaultSubForAccount(
        defaultAccId,
        d.debts_type === "borrowed"
      );
    }

    setSettlingDebt(d);
    setSettleDate(getTodayDateString());
    setSettleReflectInAccount(activeAccounts.length > 0);
    setSettleAccountId(defaultAccId);
    setSettleSubId(defaultSubId);
    setSettleError(null);
  };

  const settlePreview = useMemo(() => {
    if (!settlingDebt || !settleReflectInAccount || !settleAccountId) {
      return null;
    }
    const acc = allAccounts.find((a) => a.account_id === settleAccountId);
    if (!acc) return null;
    const delta = getSettlementAccountDelta(
      settlingDebt.debts_type,
      settlingDebt.debts_amount
    );
    return {
      account: acc,
      accountLabel: getAccountLabel(settleAccountId, settleSubId || null),
      delta,
      balanceNow: acc.account_balance,
      balanceAfter: round2(acc.account_balance + delta),
      available: getAvailableBalance(acc, settleSubId),
    };
  }, [
    settlingDebt,
    settleReflectInAccount,
    settleAccountId,
    settleSubId,
    allAccounts,
    getAccountLabel,
  ]);

  const handleConfirmSettleDebt = async () => {
    if (!settlingDebt || !userId) return;
    setSettleError(null);

    if (!settleDate) {
      setSettleError("Please select the settlement date.");
      return;
    }
    if (settleDate > getTodayDateString()) {
      setSettleError("Settlement date cannot be in the future.");
      return;
    }

    const isLent = settlingDebt.debts_type === "lent";
    const selectedAcc = settleReflectInAccount
      ? activeAccounts.find((a) => a.account_id === settleAccountId) || null
      : null;
    const selectedSub =
      selectedAcc && settleSubId
        ? selectedAcc.subaccounts.find((s) => s.subaccount_id === settleSubId) ||
        null
        : null;

    if (settleReflectInAccount) {
      if (!selectedAcc) {
        setSettleError("Please select an account for this settlement.");
        return;
      }

      // If settling a 'borrowed' debt, money is leaving the account to pay back the lender
      if (!isLent) {
        if (
          selectedAcc.subaccounts.length > 0 &&
          !selectedSub &&
          getUnallocated(selectedAcc) <= 0
        ) {
          setSettleError(
            `All funds in "${selectedAcc.account_name}" are allocated to sub-accounts. Please pick a sub-account.`
          );
          return;
        }
        const available = getAvailableBalance(selectedAcc, settleSubId);
        if (settlingDebt.debts_amount > available + 0.001) {
          setSettleError(
            `Not enough balance in ${getAccountLabel(
              selectedAcc.account_id,
              selectedSub ? selectedSub.subaccount_id : null
            )} to pay back RM ${formatAmount(
              settlingDebt.debts_amount
            )} (RM ${formatAmount(available)} available).`
          );
          return;
        }
      }
    }

    setSettlingLoading(true);
    try {
      let settledTxId: string | null = null;
      const txTime =
        settleDate === getTodayDateString() ? getCurrentTimeString() : "23:59";
      const settleDesc = buildSettlementTxDescription(
        settlingDebt.debts_type,
        settlingDebt.debts_person,
        settlingDebt.debts_name
      );

      // 1. Create the settlement transaction
      if (settleReflectInAccount && selectedAcc) {
        const { data: txRow, error: txErr } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: selectedAcc.account_id,
            subaccount_id: selectedSub ? selectedSub.subaccount_id : null,
            transaction_type: isLent ? "income" : "expense",
            amount: settlingDebt.debts_amount,
            description: settleDesc,
            expense_category: isLent
              ? null
              : DEBT_SETTLED_BORROWED_EXPENSE_CATEGORY,
            income_category: isLent
              ? DEBT_SETTLED_LENT_INCOME_CATEGORY
              : null,
            transaction_date: settleDate,
            transaction_time: txTime,
            is_active: true,
          })
          .select("transaction_id")
          .single();
        if (txErr) throw txErr;
        settledTxId = txRow.transaction_id;
      }

      // 2. Mark the debt as settled
      const { error: debtErr } = await supabase
        .from("debts")
        .update({
          status: "settled",
          settled_at: settleDate,
          settled_account_id:
            settleReflectInAccount && selectedAcc
              ? selectedAcc.account_id
              : null,
          settled_subaccount_id:
            settleReflectInAccount && selectedSub
              ? selectedSub.subaccount_id
              : null,
          settled_transaction_id: settledTxId,
        })
        .eq("debts_id", settlingDebt.debts_id)
        .eq("user_id", userId);

      if (debtErr) {
        if (settledTxId) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .eq("transaction_id", settledTxId)
            .eq("user_id", userId);
        }
        throw debtErr;
      }

      // 3. Update account balance
      if (settleReflectInAccount && selectedAcc) {
        await applyBalanceChanges([
          {
            accountId: selectedAcc.account_id,
            subaccountId: selectedSub ? selectedSub.subaccount_id : null,
            delta: getSettlementAccountDelta(
              settlingDebt.debts_type,
              settlingDebt.debts_amount
            ),
          },
        ]);
      }

      const person = settlingDebt.debts_person;
      setSettlingDebt(null);
      showToast(`Debt with "${person}" marked as settled`, "success");
      await fetchData();
    } catch (err) {
      setSettleError(getErrorMessage(err, "Failed to settle debt."));
    } finally {
      setSettlingLoading(false);
    }
  };

  // ==========================================
  // HANDLERS: REOPEN SETTLED DEBT MODAL
  // ==========================================
  const reopenPreview = useMemo(() => {
    if (!reopeningDebt) return null;
    if (
      !reopeningDebt.settled_transaction_id ||
      !reopeningDebt.settled_account_id
    ) {
      return { linked: false, impacts: [] as AccountImpactPreview[] };
    }
    const changes: BalanceChange[] = [
      {
        accountId: reopeningDebt.settled_account_id,
        subaccountId: reopeningDebt.settled_subaccount_id,
        delta: -getSettlementAccountDelta(
          reopeningDebt.debts_type,
          reopeningDebt.debts_amount
        ),
      },
    ];
    return {
      linked: true,
      impacts: buildAccountImpactPreviews(changes),
    };
  }, [reopeningDebt, buildAccountImpactPreviews]);

  const handleConfirmReopenDebt = async () => {
    if (!reopeningDebt || !userId) return;
    setReopenError(null);
    setReopeningLoading(true);
    try {
      const oldSettledTxId = reopeningDebt.settled_transaction_id;
      const oldSettledAccId = reopeningDebt.settled_account_id;
      const oldSettledSubId = reopeningDebt.settled_subaccount_id;

      // 1. Update debt status back to pending
      const { error: debtErr } = await supabase
        .from("debts")
        .update({
          status: "pending",
          settled_at: null,
          settled_account_id: null,
          settled_subaccount_id: null,
          settled_transaction_id: null,
        })
        .eq("debts_id", reopeningDebt.debts_id)
        .eq("user_id", userId);
      if (debtErr) throw debtErr;

      // 2. Cancel the settlement transaction and reverse its balance impact
      if (oldSettledTxId) {
        const { error: txErr } = await supabase
          .from("transactions")
          .update({ is_active: false })
          .eq("transaction_id", oldSettledTxId)
          .eq("user_id", userId);
        if (txErr) throw txErr;

        if (oldSettledAccId) {
          await applyBalanceChanges([
            {
              accountId: oldSettledAccId,
              subaccountId: oldSettledSubId,
              delta: -getSettlementAccountDelta(
                reopeningDebt.debts_type,
                reopeningDebt.debts_amount
              ),
            },
          ]);
        }
      }

      const person = reopeningDebt.debts_person;
      setReopeningDebt(null);
      showToast(`Debt with "${person}" reopened as pending`, "success");
      await fetchData();
    } catch (err) {
      setReopenError(getErrorMessage(err, "Failed to reopen debt."));
    } finally {
      setReopeningLoading(false);
    }
  };

  // ==========================================
  // HANDLERS: DELETE DEBT MODAL
  // ==========================================
  const deleteDebtInfo = useMemo(() => {
    if (!deletingDebt) return null;
    const txIds: string[] = [];
    const changes: BalanceChange[] = [];

    if (deletingDebt.transaction_id) {
      txIds.push(deletingDebt.transaction_id);
      if (deletingDebt.account_id) {
        changes.push({
          accountId: deletingDebt.account_id,
          subaccountId: deletingDebt.subaccount_id,
          delta: -getCreationAccountDelta(
            deletingDebt.debts_type,
            deletingDebt.debts_amount
          ),
        });
      }
    }

    if (deletingDebt.settled_transaction_id) {
      txIds.push(deletingDebt.settled_transaction_id);
      if (deletingDebt.settled_account_id) {
        changes.push({
          accountId: deletingDebt.settled_account_id,
          subaccountId: deletingDebt.settled_subaccount_id,
          delta: -getSettlementAccountDelta(
            deletingDebt.debts_type,
            deletingDebt.debts_amount
          ),
        });
      }
    }

    return {
      txIds,
      changes,
      impacts: buildAccountImpactPreviews(changes),
    };
  }, [deletingDebt, buildAccountImpactPreviews]);

  const openDeleteDebt = (d: DebtRecord) => {
    setDeleteError(null);
    setReverseLinkedOnDelete(true);
    setDeletingDebt(d);
  };

  const handleConfirmDeleteDebt = async () => {
    if (!deletingDebt || !deleteDebtInfo || !userId) return;
    setDeleteError(null);
    setDeletingLoading(true);
    try {
      // 1. Soft-delete the debt record
      const { error: debtErr } = await supabase
        .from("debts")
        .update({ is_active: false })
        .eq("debts_id", deletingDebt.debts_id)
        .eq("user_id", userId);
      if (debtErr) throw debtErr;

      // 2. Cancel linked transactions and restore account balances if checked
      if (reverseLinkedOnDelete && deleteDebtInfo.txIds.length > 0) {
        const { error: txErr } = await supabase
          .from("transactions")
          .update({ is_active: false })
          .in("transaction_id", deleteDebtInfo.txIds)
          .eq("user_id", userId);
        if (txErr) throw txErr;

        if (deleteDebtInfo.changes.length > 0) {
          await applyBalanceChanges(deleteDebtInfo.changes);
        }
      }

      const person = deletingDebt.debts_person;
      setDeletingDebt(null);
      showToast(`Debt with "${person}" deleted`, "danger");
      await fetchData();
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete debt."));
    } finally {
      setDeletingLoading(false);
    }
  };

  const selectedDebtModalAccount = useMemo(
    () => allAccounts.find((a) => a.account_id === debtAccountId) || null,
    [allAccounts, debtAccountId]
  );

  const selectedSettleModalAccount = useMemo(
    () => activeAccounts.find((a) => a.account_id === settleAccountId) || null,
    [activeAccounts, settleAccountId]
  );

  return (
    <div>
      {/* =========================================================
          PAGE HEADER
          ========================================================= */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Debts</h1>
          <p className="page-subtitle mb-3">
            Money you&apos;ve lent or borrowed
          </p>
        </div>
        <div className="pt-1">
          <AddButton onClick={openCreateDebt}>New debt</AddButton>
        </div>
      </div>

      {/* =========================================================
          SUMMARY CARDS (3-COLUMN ALIGNED)
          ========================================================= */}
      <div className="row g-4 mb-4">
        {/* Card 1: Owed to you (pending) */}
        <div className="col-12 col-md-6 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#6b7f72",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                Owed to you (pending)
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#16a34a",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summary.owedToYouPending)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                {summary.pendingLentCount === 0
                  ? "No active lent records"
                  : `${summary.pendingLentCount} pending lent ${summary.pendingLentCount === 1 ? "record" : "records"
                  }`}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor: "#dcfce7",
                color: "#16a34a",
              }}
            >
              <i
                className="bi bi-arrow-down-left"
                style={{ fontSize: "1.15rem" }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: You owe (pending) */}
        <div className="col-12 col-md-6 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#6b7f72",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                You owe (pending)
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#dc2626",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summary.youOwePending)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                {summary.pendingBorrowedCount === 0
                  ? "No active borrowed records"
                  : `${summary.pendingBorrowedCount} pending borrowed ${summary.pendingBorrowedCount === 1 ? "record" : "records"
                  }`}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor: "#fee2e2",
                color: "#dc2626",
              }}
            >
              <i
                className="bi bi-arrow-up-right"
                style={{ fontSize: "1.15rem" }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Net position & Overdue status */}
        <div className="col-12 col-md-12 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#6b7f72",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                Net debt position
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color:
                    summary.netPosition > 0
                      ? "#16a34a"
                      : summary.netPosition < 0
                        ? "#dc2626"
                        : "#1a2e23",
                  lineHeight: 1.2,
                }}
              >
                {summary.netPosition > 0
                  ? `+RM ${formatAmount(summary.netPosition)}`
                  : formatSignedRM(summary.netPosition)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: summary.overdueCount > 0 ? "#dc2626" : "#8b9d90",
                  fontWeight: summary.overdueCount > 0 ? 600 : 400,
                  marginTop: "6px",
                }}
              >
                {summary.overdueCount > 0 ? (
                  <>
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    {summary.overdueCount} overdue{" "}
                    {summary.overdueCount === 1 ? "debt" : "debts"} past due
                    date
                  </>
                ) : (
                  `${summary.settledCount} settled · No overdue debts`
                )}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor:
                  summary.overdueCount > 0 ? "#fef3c7" : "#edf4ef",
                color: summary.overdueCount > 0 ? "#d97706" : "#3a6b4e",
              }}
            >
              <i
                className={`bi ${summary.overdueCount > 0
                    ? "bi-clock-history"
                    : "bi-arrow-left-right"
                  }`}
                style={{ fontSize: "1.1rem" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================
          FILTER BAR (Type Tabs | Search | Status Pills)
          ========================================================= */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        {/* Left: All | Lent | Borrowed segmented pill */}
        <div
          className="d-inline-flex align-items-center p-1"
          style={{
            backgroundColor: "#eef3ed",
            borderRadius: "50px",
          }}
        >
          {(
            [
              { key: "all", label: "All" },
              { key: "lent", label: "Lent" },
              { key: "borrowed", label: "Borrowed" },
            ] as { key: TypeFilter; label: string }[]
          ).map((tab) => {
            const active = typeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTypeFilter(tab.key)}
                className="btn btn-sm rounded-pill border-0"
                style={{
                  backgroundColor: active ? "#ffffff" : "transparent",
                  color: active ? "#1a2e23" : "#52665a",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.78rem",
                  padding: "6px 16px",
                  boxShadow: active
                    ? "0 1px 4px rgba(0, 0, 0, 0.06)"
                    : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Search Input + Pending / Settled Pills */}
        <div className="d-flex align-items-center flex-wrap gap-2">
          <div className="position-relative" style={{ minWidth: 230 }}>
            <i
              className="bi bi-search position-absolute top-50 translate-middle-y"
              style={{ left: 13, color: "#8b9d90", fontSize: "0.8rem" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search person, title or notes..."
              className="form-control"
              style={{
                paddingLeft: 34,
                paddingRight: searchQuery ? 30 : 12,
                paddingTop: 6,
                paddingBottom: 6,
                fontSize: "0.78rem",
                borderRadius: "50px",
                border: "1px solid #dfe7e0",
                backgroundColor: "#ffffff",
                color: "#1a2e23",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="btn btn-sm p-0 border-0 position-absolute top-50 translate-middle-y text-secondary"
                style={{ right: 10 }}
                title="Clear search"
              >
                <i className="bi bi-x-circle-fill" style={{ fontSize: "0.8rem" }} />
              </button>
            )}
          </div>

          {(
            [
              {
                key: "pending",
                label: `Pending (${scopedStatusCounts.pending})`,
              },
              {
                key: "settled",
                label: `Settled (${scopedStatusCounts.settled})`,
              },
              {
                key: "all",
                label: `All (${scopedStatusCounts.total})`,
              },
            ] as { key: StatusFilter; label: string }[]
          ).map((pill) => {
            const active = statusFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setStatusFilter(pill.key)}
                className="btn btn-sm rounded-pill"
                style={{
                  backgroundColor: active ? "#69a980" : "#ffffff",
                  color: active ? "#ffffff" : "#4a5d52",
                  border: active ? "1px solid #69a980" : "1px solid #dfe7e0",
                  fontWeight: 600,
                  fontSize: "0.76rem",
                  padding: "6px 14px",
                  transition: "all 0.15s ease",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================
          DEBT CARDS — 3 COLUMN GRID
          ========================================================= */}
      {loadError ? (
        <div style={{ ...panelStyle, padding: "28px" }}>
          <ErrorBox message={loadError} />
          <Button className="fintrack-subtle-btn" onClick={fetchData}>
            Try again
          </Button>
        </div>
      ) : loading ? (
        <div
          className="text-center py-5"
          style={{ ...panelStyle, color: "#6b7f72", fontSize: "0.88rem" }}
        >
          <div
            className="spinner-border spinner-border-sm me-2"
            role="status"
          />
          Loading debts...
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="text-center py-5 px-3" style={panelStyle}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              backgroundColor: "#eff6f1",
              color: "#69a980",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.35rem",
              marginBottom: "12px",
            }}
          >
            <i className="bi bi-cash-coin" />
          </div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1a2e23", marginBottom: "4px" }}>
            {debts.length === 0
              ? "No debt records yet"
              : "No debts match your filters"}
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#6b7f72", marginBottom: 0 }}>
            {debts.length === 0
              ? 'Click "+ New debt" to record money you have lent or borrowed.'
              : "Try switching between Pending, Settled, or All tabs."}
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {filteredDebts.map((d) => {
            const isLent = d.debts_type === "lent";
            const isSettled = d.status === "settled";
            const dueInfo = getDueStatus(d.debts_due_date, d.status, todayStr);
            const hasCreatedLink = !!(d.transaction_id && d.account_id);
            const hasSettledLink = !!(
              d.settled_transaction_id && d.settled_account_id
            );

            // Subtitle text under Person name (all dates strictly DD-MM-YYYY)
            const typeLabel = isLent ? "Lent" : "Borrowed";
            let dateSubtitle = `${typeLabel} · Recorded ${formatDisplayDate(
              d.debts_date
            )}`;
            if (d.debts_due_date) {
              if (dueInfo.isOverdue) {
                dateSubtitle = `${typeLabel} · Overdue · Due ${formatDisplayDate(
                  d.debts_due_date
                )}`;
              } else if (dueInfo.isDueToday) {
                dateSubtitle = `${typeLabel} · Due today (${formatDisplayDate(
                  d.debts_due_date
                )})`;
              } else if (dueInfo.isDueSoon && dueInfo.daysDiff !== null) {
                dateSubtitle = `${typeLabel} · Due in ${dueInfo.daysDiff
                  }d (${formatDisplayDate(d.debts_due_date)})`;
              } else {
                dateSubtitle = `${typeLabel} · Due ${formatDisplayDate(
                  d.debts_due_date
                )}`;
              }
            }

            return (
              <div key={d.debts_id} className="col-12 col-md-6 col-xl-4">
                <div
                  className="h-100 d-flex flex-column"
                  style={{
                    ...panelStyle,
                    padding: "22px",
                    borderColor: dueInfo.isOverdue ? "#fecaca" : "#eef2ed",
                  }}
                >
                  {/* Card Header: Direction Icon + Person & Due Date + Status Badge & Edit/Delete */}
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                    <div
                      className="d-flex align-items-center gap-2"
                      style={{ minWidth: 0 }}
                    >
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: 40,
                          height: 40,
                          backgroundColor: isLent ? "#dcfce7" : "#fee2e2",
                          color: isLent ? "#16a34a" : "#dc2626",
                        }}
                      >
                        <i
                          className={`bi ${isLent ? "bi-arrow-down-left" : "bi-arrow-up-right"
                            }`}
                          style={{ fontSize: "1.05rem" }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h6
                          className="fw-bold mb-0 text-truncate"
                          style={{ fontSize: "0.95rem", color: "#1a2e23" }}
                          title={d.debts_person}
                        >
                          {d.debts_person}
                        </h6>
                        <span
                          className="text-truncate d-block"
                          style={{
                            fontSize: "0.73rem",
                            color: dueInfo.isOverdue
                              ? "#dc2626"
                              : dueInfo.isDueToday || dueInfo.isDueSoon
                                ? "#b45309"
                                : "#6b7f72",
                            fontWeight:
                              dueInfo.isOverdue || dueInfo.isDueToday
                                ? 600
                                : 400,
                          }}
                        >
                          {dateSubtitle}
                        </span>
                      </div>
                    </div>

                    {/* Right Badges + Edit & Delete Icons */}
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {isSettled ? (
                        <span
                          className="badge rounded-pill"
                          style={{
                            backgroundColor: "#dcfce7",
                            color: "#15803d",
                            fontSize: "0.66rem",
                            fontWeight: 600,
                            padding: "4px 10px",
                          }}
                        >
                          <i className="bi bi-check-circle-fill me-1" />
                          Settled
                        </span>
                      ) : dueInfo.isOverdue ? (
                        <span
                          className="badge rounded-pill"
                          style={{
                            backgroundColor: "#fee2e2",
                            color: "#b91c1c",
                            fontSize: "0.66rem",
                            fontWeight: 600,
                            padding: "4px 10px",
                          }}
                        >
                          <i className="bi bi-exclamation-circle-fill me-1" />
                          Overdue
                        </span>
                      ) : (
                        <span
                          className="badge rounded-pill"
                          style={{
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                            fontSize: "0.66rem",
                            fontWeight: 600,
                            padding: "4px 10px",
                          }}
                        >
                          Pending
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditDebt(d)}
                        className="btn btn-sm text-secondary p-0 border-0"
                        title="Edit debt"
                      >
                        <i
                          className="bi bi-pencil"
                          style={{ fontSize: "0.85rem" }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteDebt(d)}
                        className="btn btn-sm text-danger p-0 border-0"
                        title="Delete debt"
                      >
                        <i
                          className="bi bi-trash3"
                          style={{ fontSize: "0.85rem" }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Debt Amount */}
                  <div className="mb-1">
                    <span
                      className="fw-bold"
                      style={{
                        fontSize: "1.42rem",
                        color: "#1a2e23",
                        letterSpacing: "-0.3px",
                      }}
                    >
                      RM {formatAmount(d.debts_amount)}
                    </span>
                  </div>

                  {/* Debt Name / Purpose & Optional Notes */}
                  <div className="mb-3 flex-grow-1">
                    <div
                      style={{
                        fontSize: "0.83rem",
                        fontWeight: 500,
                        color: "#3b4f43",
                      }}
                    >
                      {d.debts_name}
                    </div>
                    {d.debts_notes && (
                      <div
                        className="mt-1"
                        style={{
                          fontSize: "0.75rem",
                          color: "#7a8e81",
                          lineHeight: 1.45,
                        }}
                      >
                        {d.debts_notes}
                      </div>
                    )}

                    {/* Account & Settlement Metadata Box */}
                    <div
                      className="mt-3 px-2 py-2 rounded-3"
                      style={{
                        backgroundColor: "#f8faf7",
                        border: "1px solid #edf2ec",
                        fontSize: "0.72rem",
                        color: "#5b7063",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <span className="text-truncate">
                          <i
                            className={`bi ${hasCreatedLink ? "bi-link-45deg" : "bi-journal-text"
                              } me-1`}
                          />
                          {hasCreatedLink
                            ? `${isLent ? "From" : "Into"}: ${getAccountLabel(
                              d.account_id,
                              d.subaccount_id
                            )}`
                            : "Not linked to an account"}
                        </span>
                        <span
                          className="flex-shrink-0"
                          style={{ color: "#8b9d90" }}
                        >
                          {formatDisplayDate(d.debts_date)}
                        </span>
                      </div>

                      {isSettled && (
                        <div
                          className="d-flex align-items-center justify-content-between gap-2 mt-1 pt-1"
                          style={{
                            borderTop: "1px dashed #e2ebe4",
                            color: "#15803d",
                          }}
                        >
                          <span className="text-truncate">
                            <i className="bi bi-check2-circle me-1" />
                            {hasSettledLink
                              ? `Settled ${isLent ? "into" : "from"
                              }: ${getAccountLabel(
                                d.settled_account_id,
                                d.settled_subaccount_id
                              )}`
                              : "Settled (no account link)"}
                          </span>
                          <span className="flex-shrink-0 fw-semibold">
                            {formatDisplayDate(d.settled_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Action Button */}
                  <div className="mt-auto pt-1">
                    {!isSettled ? (
                      <button
                        type="button"
                        onClick={() => openSettleModal(d)}
                        className="btn btn-sm w-100 rounded-pill fw-medium fintrack-subtle-btn"
                        style={{ fontSize: "0.8rem", padding: "8px 14px" }}
                      >
                        Mark settled
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReopenError(null);
                          setReopeningDebt(d);
                        }}
                        className="btn btn-sm w-100 rounded-pill fw-medium fintrack-subtle-btn"
                        style={{ fontSize: "0.8rem", padding: "8px 14px" }}
                      >
                        <i className="bi bi-arrow-counterclockwise me-1" />
                        Mark as pending
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          MODAL 1: CREATE / EDIT DEBT RECORD
          ========================================================= */}
      <Modal
        open={debtModalOpen}
        onCancel={() => setDebtModalOpen(false)}
        footer={null}
        centered
        width={520}
        className="fintrack-modal"
        destroyOnHidden
      >
        <h3
          className="mb-3"
          style={{ fontSize: "1.18rem", fontWeight: 600, color: "#1a2e23" }}
        >
          {debtModalMode === "add"
            ? "New debt record"
            : `Edit debt with ${editingDebt?.debts_person || ""}`}
        </h3>

        <form onSubmit={handleDebtFormSubmit}>
          {debtModalError && <ErrorBox message={debtModalError} />}

          {/* Row 1: Type & Amount (RM) */}
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fintrack-modal-label">Type</label>
              <select
                value={debtType}
                onChange={(e) =>
                  handleDebtTypeChange(e.target.value as DebtType)
                }
                className="form-select fintrack-modal-input"
              >
                <option value="lent">Lent (Owed to me)</option>
                <option value="borrowed">Borrowed (I owe)</option>
              </select>
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">Amount (RM)</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={debtAmountInput}
                onChange={(e) =>
                  setDebtAmountInput(formatCentsInput(e.target.value))
                }
                placeholder="0.00"
                className="form-control fintrack-modal-input"
              />
            </div>
          </div>

          {/* Row 2: Person & Debt Name */}
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fintrack-modal-label">Person</label>
              <input
                type="text"
                required
                value={debtPerson}
                onChange={(e) => setDebtPerson(e.target.value)}
                placeholder="e.g. Aiman"
                className="form-control fintrack-modal-input"
              />
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">Debt title / reason</label>
              <input
                type="text"
                required
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                placeholder="e.g. Car service"
                className="form-control fintrack-modal-input"
              />
            </div>
          </div>

          {/* Row 3: Date Recorded (DD-MM-YYYY) & Due Date (DD-MM-YYYY) */}
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fintrack-modal-label">Date (DD-MM-YYYY)</label>
              <DateInputDDMMYYYY
                value={debtDate}
                onChange={setDebtDate}
                required
                max={getTodayDateString()}
              />
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">
                Due date (optional)
              </label>
              <DateInputDDMMYYYY
                value={debtDueDate}
                onChange={setDebtDueDate}
                placeholder="Optional (DD-MM-YYYY)"
                allowClear
                min={debtDate || undefined}
              />
            </div>
          </div>

          {/* Row 4: Notes */}
          <div className="mb-3">
            <label className="fintrack-modal-label">Notes (optional)</label>
            <textarea
              rows={2}
              value={debtNotes}
              onChange={(e) => setDebtNotes(e.target.value)}
              placeholder="Untuk servis kereta..."
              className="form-control fintrack-modal-input"
            />
          </div>

          {/* Row 5: Account & Transaction Two-Way Sync Box */}
          <div
            className="mb-3 p-3"
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              borderRadius: "14px",
            }}
          >
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={reflectInAccount}
                disabled={activeAccounts.length === 0 && !editingDebt?.account_id}
                onChange={(e) => setReflectInAccount(e.target.checked)}
                style={checkboxInputStyle}
              />
              {debtType === "lent"
                ? "Deduct this lent amount from an account & record expense transaction"
                : "Add this borrowed amount into an account & record income transaction"}
            </label>

            {activeAccounts.length === 0 && !editingDebt?.account_id && (
              <div
                style={{
                  fontSize: "0.73rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                You don&apos;t have any active accounts yet.
              </div>
            )}

            {reflectInAccount && (
              <>
                <div className="row g-2 mt-2">
                  <div className="col-6">
                    <label className="fintrack-modal-label">
                      {debtType === "lent" ? "Lend from account" : "Deposit into account"}
                    </label>
                    <select
                      value={debtAccountId}
                      onChange={(e) => handleDebtAccountChange(e.target.value)}
                      className="form-select fintrack-modal-input"
                    >
                      {editingDebt?.account_id &&
                        !activeAccounts.some(
                          (a) => a.account_id === editingDebt.account_id
                        ) && (
                          <option value={editingDebt.account_id}>
                            {getAccountLabel(editingDebt.account_id, null)}
                          </option>
                        )}
                      {activeAccounts.map((acc) => (
                        <option key={acc.account_id} value={acc.account_id}>
                          {acc.account_name} (RM{" "}
                          {formatAmount(acc.account_balance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-6">
                    <label className="fintrack-modal-label">Sub-account</label>
                    <select
                      value={debtSubId}
                      onChange={(e) => setDebtSubId(e.target.value)}
                      disabled={
                        !selectedDebtModalAccount ||
                        selectedDebtModalAccount.subaccounts.length === 0
                      }
                      className="form-select fintrack-modal-input"
                    >
                      {!selectedDebtModalAccount ||
                        selectedDebtModalAccount.subaccounts.length === 0 ? (
                        <option value="">None</option>
                      ) : (
                        <>
                          {!(
                            debtType === "lent" &&
                            getUnallocated(selectedDebtModalAccount) <= 0.001
                          ) && (
                              <option value="">
                                Unallocated (RM{" "}
                                {formatAmount(
                                  getUnallocated(selectedDebtModalAccount)
                                )}
                                )
                              </option>
                            )}
                          {selectedDebtModalAccount.subaccounts.map((sub) => (
                            <option
                              key={sub.subaccount_id}
                              value={sub.subaccount_id}
                            >
                              {sub.subaccount_name} (RM{" "}
                              {formatAmount(sub.subaccount_value)})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {selectedDebtModalAccount && debtType === "lent" && (
                  <div
                    className="d-flex align-items-center justify-content-between px-3 py-2 mt-3"
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2ebe4",
                      borderRadius: "10px",
                      fontSize: "0.78rem",
                    }}
                  >
                    <span style={{ color: "#546e5f", fontWeight: 500 }}>
                      Available in {debtSubId ? "sub-account" : "main account"}:
                    </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          getAvailableBalance(
                            selectedDebtModalAccount,
                            debtSubId
                          ) > 0
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      RM{" "}
                      {formatAmount(
                        getAvailableBalance(selectedDebtModalAccount, debtSubId)
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setDebtModalOpen(false)}
              disabled={savingDebt}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingDebt}
            >
              {debtModalMode === "add" ? "Add debt" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 2: REVIEW EFFECT ON ACCOUNT BEFORE SAVING (ADD / EDIT)
          ========================================================= */}
      <Modal
        open={!!pendingSave}
        onCancel={() => {
          if (!savingDebt) setPendingSave(null);
        }}
        footer={null}
        centered
        width={470}
        className="fintrack-modal"
        title={
          pendingSave?.mode === "edit"
            ? "Confirm changes to this debt?"
            : pendingSave?.type === "lent"
              ? "Confirm lending record?"
              : "Confirm borrowing record?"
        }
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "#6b7f72",
            marginTop: "-4px",
            marginBottom: "16px",
          }}
        >
          Review how this will be reflected in your account and transactions.
        </p>

        {reviewError && <ErrorBox message={reviewError} />}

        {pendingSave && (
          <>
            <SummaryTable>
              <SummaryRow
                label="Type"
                value={
                  pendingSave.type === "lent"
                    ? "Lent (Owed to you)"
                    : "Borrowed (You owe)"
                }
                valueColor={pendingSave.type === "lent" ? "#16a34a" : "#dc2626"}
              />
              <SummaryRow label="Person" value={pendingSave.person} />
              <SummaryRow label="Title" value={pendingSave.name} />
              <SummaryRow
                label="Date"
                value={formatDisplayDate(pendingSave.date)}
              />
              {pendingSave.dueDate && (
                <SummaryRow
                  label="Due date"
                  value={formatDisplayDate(pendingSave.dueDate)}
                />
              )}
              <SummaryRow
                label="Amount"
                value={
                  pendingSave.mode === "edit" &&
                    pendingSave.editing &&
                    Math.abs(pendingSave.editing.debts_amount - pendingSave.amount) >
                    0.001
                    ? `RM ${formatAmount(
                      pendingSave.editing.debts_amount
                    )} → RM ${formatAmount(pendingSave.amount)}`
                    : `RM ${formatAmount(pendingSave.amount)}`
                }
                last={pendingSave.impacts.length === 0}
              />

              {pendingSave.impacts.map((imp, idx) => {
                const isLast = idx === pendingSave.impacts.length - 1;
                return (
                  <React.Fragment key={imp.accountId}>
                    <SummaryRow label="Account" value={imp.accountLabel} />
                    <SummaryRow
                      label="Effect on account"
                      value={
                        imp.delta < 0
                          ? `Deducting RM ${formatAmount(imp.delta)}`
                          : `Adding RM ${formatAmount(imp.delta)}`
                      }
                      valueColor={imp.delta < 0 ? "#dc2626" : "#16a34a"}
                    />
                    <SummaryRow
                      label="Balance now"
                      value={formatSignedRM(imp.balanceNow)}
                    />
                    <SummaryRow
                      label="Balance after"
                      value={formatSignedRM(imp.balanceAfter)}
                      bold
                      last={isLast}
                    />
                  </React.Fragment>
                );
              })}
            </SummaryTable>

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={handleReviewBack}
                disabled={savingDebt}
              >
                Back
              </Button>
              <Button
                className="fintrack-modal-primary-btn"
                onClick={handleConfirmPendingSave}
                loading={savingDebt}
              >
                {pendingSave.mode === "edit"
                  ? "Save changes"
                  : "Confirm & add debt"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* =========================================================
          MODAL 3: MARK SETTLED CONFIRMATION MODAL
          ========================================================= */}
      <Modal
        open={!!settlingDebt}
        onCancel={() => {
          if (!settlingLoading) setSettlingDebt(null);
        }}
        footer={null}
        centered
        width={480}
        className="fintrack-modal"
        title={
          settlingDebt
            ? `Mark debt with "${settlingDebt.debts_person}" as settled?`
            : "Mark debt as settled?"
        }
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "#6b7f72",
            marginTop: "-4px",
            marginBottom: "16px",
          }}
        >
          {settlingDebt?.debts_type === "lent"
            ? "Confirm that you have been paid back and select the account receiving the repayment."
            : "Confirm that you have paid back this debt and select the account used for payment."}
        </p>

        {settleError && <ErrorBox message={settleError} />}

        {settlingDebt && (
          <>
            <div className="mb-3">
              <label className="fintrack-modal-label">
                Settlement date (DD-MM-YYYY)
              </label>
              <DateInputDDMMYYYY
                value={settleDate}
                onChange={setSettleDate}
                required
                max={getTodayDateString()}
              />
            </div>

            <div
              className="mb-3 p-3"
              style={{
                backgroundColor: "#f6faf7",
                border: "1px solid #e2ebe4",
                borderRadius: "14px",
              }}
            >
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={settleReflectInAccount}
                  disabled={activeAccounts.length === 0}
                  onChange={(e) => setSettleReflectInAccount(e.target.checked)}
                  style={checkboxInputStyle}
                />
                {settlingDebt.debts_type === "lent"
                  ? "Add repayment into an account & record income transaction"
                  : "Deduct repayment from an account & record expense transaction"}
              </label>

              {settleReflectInAccount && (
                <>
                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <label className="fintrack-modal-label">
                        {settlingDebt.debts_type === "lent"
                          ? "Receive into account"
                          : "Pay from account"}
                      </label>
                      <select
                        value={settleAccountId}
                        onChange={(e) =>
                          handleSettleAccountChange(e.target.value)
                        }
                        className="form-select fintrack-modal-input"
                      >
                        {activeAccounts.map((acc) => (
                          <option key={acc.account_id} value={acc.account_id}>
                            {acc.account_name} (RM{" "}
                            {formatAmount(acc.account_balance)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-6">
                      <label className="fintrack-modal-label">Sub-account</label>
                      <select
                        value={settleSubId}
                        onChange={(e) => setSettleSubId(e.target.value)}
                        disabled={
                          !selectedSettleModalAccount ||
                          selectedSettleModalAccount.subaccounts.length === 0
                        }
                        className="form-select fintrack-modal-input"
                      >
                        {!selectedSettleModalAccount ||
                          selectedSettleModalAccount.subaccounts.length === 0 ? (
                          <option value="">None</option>
                        ) : (
                          <>
                            {!(
                              settlingDebt.debts_type === "borrowed" &&
                              getUnallocated(selectedSettleModalAccount) <=
                              0.001
                            ) && (
                                <option value="">
                                  Unallocated (RM{" "}
                                  {formatAmount(
                                    getUnallocated(selectedSettleModalAccount)
                                  )}
                                  )
                                </option>
                              )}
                            {selectedSettleModalAccount.subaccounts.map(
                              (sub) => (
                                <option
                                  key={sub.subaccount_id}
                                  value={sub.subaccount_id}
                                >
                                  {sub.subaccount_name} (RM{" "}
                                  {formatAmount(sub.subaccount_value)})
                                </option>
                              )
                            )}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {selectedSettleModalAccount &&
                    settlingDebt.debts_type === "borrowed" && (
                      <div
                        className="d-flex align-items-center justify-content-between px-3 py-2 mt-3"
                        style={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2ebe4",
                          borderRadius: "10px",
                          fontSize: "0.78rem",
                        }}
                      >
                        <span style={{ color: "#546e5f", fontWeight: 500 }}>
                          Available in{" "}
                          {settleSubId ? "sub-account" : "main account"}:
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              getAvailableBalance(
                                selectedSettleModalAccount,
                                settleSubId
                              ) >= settlingDebt.debts_amount
                                ? "#16a34a"
                                : "#dc2626",
                          }}
                        >
                          RM{" "}
                          {formatAmount(
                            getAvailableBalance(
                              selectedSettleModalAccount,
                              settleSubId
                            )
                          )}
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>

            <SummaryTable>
              <SummaryRow label="Person" value={settlingDebt.debts_person} />
              <SummaryRow label="Title" value={settlingDebt.debts_name} />
              <SummaryRow
                label="Type"
                value={
                  settlingDebt.debts_type === "lent"
                    ? "Lent (They pay you back)"
                    : "Borrowed (You pay them back)"
                }
              />
              {settlingDebt.debts_due_date && (
                <SummaryRow
                  label="Due date"
                  value={formatDisplayDate(settlingDebt.debts_due_date)}
                />
              )}
              <SummaryRow
                label="Amount"
                value={`RM ${formatAmount(settlingDebt.debts_amount)}`}
                last={!settlePreview}
              />
              {settlePreview && (
                <>
                  <SummaryRow
                    label="Account"
                    value={settlePreview.accountLabel}
                  />
                  <SummaryRow
                    label="Effect on account"
                    value={
                      settlePreview.delta >= 0
                        ? `Adding RM ${formatAmount(settlePreview.delta)}`
                        : `Deducting RM ${formatAmount(settlePreview.delta)}`
                    }
                    valueColor={
                      settlePreview.delta >= 0 ? "#16a34a" : "#dc2626"
                    }
                  />
                  <SummaryRow
                    label="Balance now"
                    value={formatSignedRM(settlePreview.balanceNow)}
                  />
                  <SummaryRow
                    label="Balance after"
                    value={formatSignedRM(settlePreview.balanceAfter)}
                    bold
                    last
                  />
                </>
              )}
            </SummaryTable>

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setSettlingDebt(null)}
                disabled={settlingLoading}
              >
                Cancel
              </Button>
              <Button
                className="fintrack-modal-primary-btn"
                onClick={handleConfirmSettleDebt}
                loading={settlingLoading}
              >
                Confirm settled
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* =========================================================
          MODAL 4: REOPEN SETTLED DEBT CONFIRMATION MODAL
          ========================================================= */}
      <Modal
        open={!!reopeningDebt}
        onCancel={() => {
          if (!reopeningLoading) setReopeningDebt(null);
        }}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        title={
          reopeningDebt
            ? `Reopen debt with "${reopeningDebt.debts_person}"?`
            : "Reopen debt?"
        }
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "#6b7f72",
            marginTop: "-4px",
            marginBottom: "16px",
          }}
        >
          {reopenPreview?.linked
            ? "The settlement transaction will be cancelled and your account balance restored."
            : "This debt will be moved back to Pending."}
        </p>

        {reopenError && <ErrorBox message={reopenError} />}

        {reopeningDebt && reopenPreview && (
          <>
            <SummaryTable>
              <SummaryRow label="Person" value={reopeningDebt.debts_person} />
              <SummaryRow label="Title" value={reopeningDebt.debts_name} />
              <SummaryRow
                label="Amount"
                value={`RM ${formatAmount(reopeningDebt.debts_amount)}`}
              />
              <SummaryRow
                label="Status"
                value="Settled → Pending"
                last={reopenPreview.impacts.length === 0}
              />
              {reopenPreview.impacts.map((imp, idx) => (
                <React.Fragment key={imp.accountId}>
                  <SummaryRow label="Account" value={imp.accountLabel} />
                  <SummaryRow
                    label="Effect on account"
                    value={
                      imp.delta >= 0
                        ? `Refunding RM ${formatAmount(imp.delta)}`
                        : `Deducting RM ${formatAmount(imp.delta)}`
                    }
                    valueColor={imp.delta >= 0 ? "#16a34a" : "#dc2626"}
                  />
                  <SummaryRow
                    label="Balance now"
                    value={formatSignedRM(imp.balanceNow)}
                  />
                  <SummaryRow
                    label="Balance after"
                    value={formatSignedRM(imp.balanceAfter)}
                    bold
                    last={idx === reopenPreview.impacts.length - 1}
                  />
                </React.Fragment>
              ))}
            </SummaryTable>

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setReopeningDebt(null)}
                disabled={reopeningLoading}
              >
                Keep settled
              </Button>
              <Button
                className="fintrack-modal-primary-btn"
                onClick={handleConfirmReopenDebt}
                loading={reopeningLoading}
              >
                Reopen debt
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* =========================================================
          MODAL 5: DELETE DEBT CONFIRMATION MODAL
          ========================================================= */}
      <Modal
        open={!!deletingDebt}
        onCancel={() => {
          if (!deletingLoading) setDeletingDebt(null);
        }}
        footer={null}
        centered
        width={470}
        className="fintrack-modal"
        title={
          deletingDebt
            ? `Delete debt with "${deletingDebt.debts_person}"?`
            : "Delete debt?"
        }
      >
        {deleteError && <ErrorBox message={deleteError} />}

        {deletingDebt && deleteDebtInfo && (
          <>
            <SummaryTable>
              <SummaryRow label="Person" value={deletingDebt.debts_person} />
              <SummaryRow label="Title" value={deletingDebt.debts_name} />
              <SummaryRow
                label="Type"
                value={
                  deletingDebt.debts_type === "lent"
                    ? "Lent (Owed to you)"
                    : "Borrowed (You owe)"
                }
              />
              <SummaryRow
                label="Amount"
                value={`RM ${formatAmount(deletingDebt.debts_amount)}`}
              />
              <SummaryRow
                label="Status"
                value={
                  deletingDebt.status === "settled"
                    ? `Settled (${formatDisplayDate(deletingDebt.settled_at)})`
                    : "Pending"
                }
                last={
                  !(reverseLinkedOnDelete && deleteDebtInfo.impacts.length > 0)
                }
              />

              {reverseLinkedOnDelete &&
                deleteDebtInfo.impacts.map((imp, idx) => (
                  <React.Fragment key={imp.accountId}>
                    <SummaryRow label="Account" value={imp.accountLabel} />
                    <SummaryRow
                      label="Effect on account"
                      value={
                        imp.delta >= 0
                          ? `Refunding RM ${formatAmount(imp.delta)}`
                          : `Deducting RM ${formatAmount(imp.delta)}`
                      }
                      valueColor={imp.delta >= 0 ? "#16a34a" : "#dc2626"}
                    />
                    <SummaryRow
                      label="Balance now"
                      value={formatSignedRM(imp.balanceNow)}
                    />
                    <SummaryRow
                      label="Balance after"
                      value={formatSignedRM(imp.balanceAfter)}
                      bold
                      last={idx === deleteDebtInfo.impacts.length - 1}
                    />
                  </React.Fragment>
                ))}
            </SummaryTable>

            {deleteDebtInfo.txIds.length > 0 && (
              <div className="mb-3">
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={reverseLinkedOnDelete}
                    onChange={(e) => setReverseLinkedOnDelete(e.target.checked)}
                    style={checkboxInputStyle}
                  />
                  Also cancel the {deleteDebtInfo.txIds.length} linked
                  transaction{deleteDebtInfo.txIds.length > 1 ? "s" : ""} and
                  restore account balance
                </label>
                <div
                  style={{
                    fontSize: "0.74rem",
                    color: "#6b7f72",
                    marginTop: "4px",
                  }}
                >
                  {reverseLinkedOnDelete
                    ? "Linked transaction(s) will be removed from Transactions and your account balance(s) adjusted accordingly."
                    : "Linked transaction(s) will stay on the Transactions page and account balances won't change."}
                </div>
              </div>
            )}

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setDeletingDebt(null)}
                disabled={deletingLoading}
              >
                Keep debt
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmDeleteDebt}
                loading={deletingLoading}
              >
                Delete debt
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Bottom Notification Toast */}
      <BottomToast
        open={toastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
