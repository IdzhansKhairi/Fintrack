"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

type ContributionType = "deposit" | "withdrawal";
type StatusFilter = "all" | "in_progress" | "completed";

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
  subaccounts: SubAccount[]; // active sub-accounts only
}

interface Contribution {
  tabung_contribution_id: string;
  tabung_id: string;
  contribution_type: ContributionType;
  amount: number;
  note: string;
  contribution_date: string; // YYYY-MM-DD
  account_id: string | null;
  subaccount_id: string | null;
  transaction_id: string | null;
  created_at: string;
}

interface Tabung {
  tabung_id: string;
  tabung_name: string;
  tabung_purpose: string;
  tabung_held_at: string;
  tabung_target_amount: number;
  tabung_target_date: string | null;
  tabung_notes: string | null;
  color: string;
  created_at: string;
  contributions: Contribution[]; // newest first
  saved: number;
}

// A contribution waiting for the user to confirm its effect on an account
interface PendingContribution {
  mode: "add" | "edit";
  type: ContributionType;
  tabung: Tabung;
  amount: number;
  note: string;
  date: string;
  account: Account | null;
  sub: SubAccount | null;
  editing: Contribution | null;
}

interface BalanceChange {
  accountId: string;
  subaccountId: string | null;
  delta: number;
}

const TABUNG_PURPOSES = [
  { label: "Emergency Fund", icon: "bi-shield-check" },
  { label: "Travel & Holiday", icon: "bi-airplane" },
  { label: "Marriage & Wedding", icon: "bi-heart" },
  { label: "Retirement", icon: "bi-piggy-bank" },
  { label: "Investment", icon: "bi-graph-up-arrow" },
  { label: "Home & Property", icon: "bi-house-heart" },
  { label: "Vehicle", icon: "bi-car-front" },
  { label: "Education", icon: "bi-mortarboard" },
  { label: "Wishlist & Gadgets", icon: "bi-bag-heart" },
  { label: "Medical & Health", icon: "bi-heart-pulse" },
  { label: "Hajj & Umrah", icon: "bi-moon-stars" },
  { label: "Festive & Raya", icon: "bi-stars" },
  { label: "Children & Family", icon: "bi-people" },
  { label: "Sinking Fund", icon: "bi-calendar2-check" },
  { label: "Others", icon: "bi-bookmark-star" },
];

const HELD_AT_GROUPS = [
  {
    group: "Banks",
    options: [
      "Maybank (MAE Tabung)",
      "Maybank",
      "CIMB Bank",
      "Bank Islam",
      "RHB Bank",
      "Public Bank",
      "Hong Leong Bank",
      "AmBank",
      "BSN",
      "Bank Rakyat",
      "Bank Muamalat",
      "Affin Bank",
      "Alliance Bank",
      "HSBC",
      "Standard Chartered",
      "UOB",
      "OCBC",
    ],
  },
  {
    group: "Digital banks & e-wallets",
    options: [
      "GXBank (Savings Pockets)",
      "AEON Bank (Savings Pot)",
      "Boost Bank (Savings Jar)",
      "Ryt Bank",
      "Touch 'n Go eWallet (GO+)",
      "BigPay (Stash)",
    ],
  },
  {
    group: "Statutory & investment funds",
    options: [
      "EPF (KWSP)",
      "ASNB (ASB / ASM)",
      "Tabung Haji",
      "PRS (Private Retirement Scheme)",
      "StashAway",
      "Wahed",
      "Versa",
      "Rakuten Trade",
      "Moomoo",
      "Luno",
    ],
  },
  {
    group: "Physical & offline",
    options: [
      "Physical Piggy Bank",
      "Cash at Home / Envelope",
      "Physical Gold",
      "Others",
    ],
  },
];

const RANDOM_COLORS = [
  "#1e4db7",
  "#0284c7",
  "#475569",
  "#dc2626",
  "#16a34a",
  "#0d9488",
  "#7c3aed",
  "#d97706",
  "#2563eb",
  "#059669",
];

// Categories used for the transactions created by Tabung contributions
const TABUNG_EXPENSE_CATEGORY = "Tabung / Savings";
const TABUNG_INCOME_CATEGORY = "Tabung Withdrawal";

// Contribution list: show 5 rows, scroll for the rest
const CONTRIBUTION_ROW_HEIGHT = 52;
const CONTRIBUTION_VISIBLE_ROWS = 5;

const panelStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #eef2ed",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
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

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function getPurposeIcon(purpose: string): string {
  return (
    TABUNG_PURPOSES.find((p) => p.label === purpose)?.icon || "bi-piggy-bank"
  );
}

// How a contribution changes the tabung balance (+ for deposit, - for withdrawal).
// The linked account always moves by the opposite amount.
function getTabungDelta(type: ContributionType, amount: number): number {
  return type === "deposit" ? amount : -amount;
}

function getUnallocated(account: Account): number {
  const allocated = account.subaccounts.reduce(
    (sum, s) => sum + Number(s.subaccount_value),
    0
  );
  return Math.max(0, round2(account.account_balance - allocated));
}

// Money that can be taken out of an account (or one of its sub-accounts)
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
      {message}
    </div>
  );
}

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#1a2e23",
  cursor: "pointer",
  userSelect: "none",
};

const checkboxInputStyle: React.CSSProperties = {
  accentColor: "#69a980",
  width: "15px",
  height: "15px",
  cursor: "pointer",
};

export default function TabungPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [tabungs, setTabungs] = useState<Tabung[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allSubAccounts, setAllSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [purposeFilter, setPurposeFilter] = useState<string>("all");

  // Create / Edit Fund Modal State
  const [fundModalOpen, setFundModalOpen] = useState<boolean>(false);
  const [fundModalMode, setFundModalMode] = useState<"add" | "edit">("add");
  const [editingFund, setEditingFund] = useState<Tabung | null>(null);
  const [fundName, setFundName] = useState<string>("");
  const [fundPurpose, setFundPurpose] = useState<string>(
    TABUNG_PURPOSES[0].label
  );
  const [fundHeldAt, setFundHeldAt] = useState<string>(
    HELD_AT_GROUPS[0].options[0]
  );
  const [fundTargetInput, setFundTargetInput] = useState<string>("");
  const [fundTargetDate, setFundTargetDate] = useState<string>("");
  const [fundNotes, setFundNotes] = useState<string>("");
  const [fundModalError, setFundModalError] = useState<string | null>(null);
  const [savingFund, setSavingFund] = useState<boolean>(false);

  // Add / Edit Contribution Modal State
  const [contribModalOpen, setContribModalOpen] = useState<boolean>(false);
  const [contribMode, setContribMode] = useState<"add" | "edit">("add");
  const [contribType, setContribType] = useState<ContributionType>("deposit");
  const [contribTabung, setContribTabung] = useState<Tabung | null>(null);
  const [editingContrib, setEditingContrib] = useState<Contribution | null>(
    null
  );
  const [contribAmountInput, setContribAmountInput] = useState<string>("");
  const [contribDate, setContribDate] = useState<string>(getTodayDateString());
  const [contribNote, setContribNote] = useState<string>("");
  const [reflectInAccount, setReflectInAccount] = useState<boolean>(true);
  const [contribAccountId, setContribAccountId] = useState<string>("");
  const [contribSubId, setContribSubId] = useState<string>("");
  const [contribModalError, setContribModalError] = useState<string | null>(
    null
  );
  const [savingContrib, setSavingContrib] = useState<boolean>(false);

  // Review (confirm effect on account) Modal State
  const [pending, setPending] = useState<PendingContribution | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Remove Contribution Modal State
  const [deletingContrib, setDeletingContrib] = useState<{
    contrib: Contribution;
    tabung: Tabung;
  } | null>(null);
  const [deleteContribError, setDeleteContribError] = useState<string | null>(
    null
  );
  const [deletingContribLoading, setDeletingContribLoading] =
    useState<boolean>(false);

  // Delete Fund Modal State
  const [deletingFund, setDeletingFund] = useState<Tabung | null>(null);
  const [reverseLinked, setReverseLinked] = useState<boolean>(false);
  const [deleteFundError, setDeleteFundError] = useState<string | null>(null);
  const [deletingFundLoading, setDeletingFundLoading] =
    useState<boolean>(false);

  // Bottom Toast Notification State
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
    () => allAccounts.filter((acc) => acc.is_active),
    [allAccounts]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserId(user.id);

      // Ensure user profile exists
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || null,
          preferred_name: user.user_metadata?.preferred_name || null,
        },
        { onConflict: "id" }
      );

      const [tabungRes, contribRes, accountsRes, subaccountsRes] =
        await Promise.all([
          supabase
            .from("tabung")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("tabung_contribution")
            .select("*")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("contribution_date", { ascending: false })
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

      if (tabungRes.error) throw tabungRes.error;
      if (contribRes.error) throw contribRes.error;
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
        subaccounts: subs.filter(
          (s) => s.account_id === acc.account_id && s.is_active
        ),
      }));

      const contributions: Contribution[] = (contribRes.data || []).map(
        (row) => ({
          tabung_contribution_id: row.tabung_contribution_id,
          tabung_id: row.tabung_id,
          contribution_type: row.contribution_type as ContributionType,
          amount: Number(row.tabung_contribution_amount),
          note: row.tabung_contribution_note,
          contribution_date: row.contribution_date,
          account_id: row.account_id,
          subaccount_id: row.subaccount_id,
          transaction_id: row.transaction_id,
          created_at: row.created_at,
        })
      );

      const funds: Tabung[] = (tabungRes.data || []).map((row) => {
        const fundContribs = contributions.filter(
          (c) => c.tabung_id === row.tabung_id
        );
        const saved = round2(
          fundContribs.reduce(
            (sum, c) => sum + getTabungDelta(c.contribution_type, c.amount),
            0
          )
        );
        return {
          tabung_id: row.tabung_id,
          tabung_name: row.tabung_name,
          tabung_purpose: row.tabung_purpose,
          tabung_held_at: row.tabung_held_at,
          tabung_target_amount: Number(row.tabung_target_amount),
          tabung_target_date: row.tabung_target_date,
          tabung_notes: row.tabung_notes,
          color: row.color || "#16a34a",
          created_at: row.created_at,
          contributions: fundContribs,
          saved,
        };
      });

      setAllSubAccounts(subs);
      setAllAccounts(accounts);
      setTabungs(funds);
    } catch (err) {
      console.error("Failed to load tabung:", err);
      setLoadError(getErrorMessage(err, "Failed to load your tabung."));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // DERIVED VALUES: SUMMARY & FILTERS
  // ==========================================
  const isCompleted = (t: Tabung) => t.saved >= t.tabung_target_amount - 0.001;

  const summary = useMemo(() => {
    const totalSaved = tabungs.reduce((sum, t) => sum + t.saved, 0);
    const totalTarget = tabungs.reduce(
      (sum, t) => sum + t.tabung_target_amount,
      0
    );
    const monthPrefix = getTodayDateString().slice(0, 7);
    let depositedThisMonth = 0;
    let withdrawnThisMonth = 0;
    tabungs.forEach((t) =>
      t.contributions.forEach((c) => {
        if (!c.contribution_date.startsWith(monthPrefix)) return;
        if (c.contribution_type === "deposit") depositedThisMonth += c.amount;
        else withdrawnThisMonth += c.amount;
      })
    );
    const completedCount = tabungs.filter(
      (t) => t.saved >= t.tabung_target_amount - 0.001
    ).length;
    return {
      totalSaved: round2(totalSaved),
      totalTarget: round2(totalTarget),
      overallPct: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      depositedThisMonth: round2(depositedThisMonth),
      withdrawnThisMonth: round2(withdrawnThisMonth),
      completedCount,
      inProgressCount: tabungs.length - completedCount,
    };
  }, [tabungs]);

  const filteredTabungs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tabungs.filter((t) => {
      const done = t.saved >= t.tabung_target_amount - 0.001;
      if (statusFilter === "completed" && !done) return false;
      if (statusFilter === "in_progress" && done) return false;
      if (purposeFilter !== "all" && t.tabung_purpose !== purposeFilter)
        return false;
      if (query) {
        const haystack = [
          t.tabung_name,
          t.tabung_purpose,
          t.tabung_held_at,
          t.tabung_notes || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [tabungs, searchQuery, statusFilter, purposeFilter]);

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

  // ==========================================
  // BALANCE HELPER
  // Applies account / sub-account balance changes, grouping changes to the
  // same account so each row is only updated once.
  // ==========================================
  const applyBalanceChanges = async (changes: BalanceChange[]) => {
    if (!userId) return;
    const accountDeltas = new Map<string, number>();
    const subDeltas = new Map<string, number>();

    changes.forEach((ch) => {
      accountDeltas.set(
        ch.accountId,
        (accountDeltas.get(ch.accountId) || 0) + ch.delta
      );
      if (ch.subaccountId) {
        subDeltas.set(
          ch.subaccountId,
          (subDeltas.get(ch.subaccountId) || 0) + ch.delta
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
  // HANDLERS: CREATE / EDIT FUND
  // ==========================================
  const openCreateFund = () => {
    setFundModalMode("add");
    setEditingFund(null);
    setFundName("");
    setFundPurpose(TABUNG_PURPOSES[0].label);
    setFundHeldAt(HELD_AT_GROUPS[0].options[0]);
    setFundTargetInput("");
    setFundTargetDate("");
    setFundNotes("");
    setFundModalError(null);
    setFundModalOpen(true);
  };

  const openEditFund = (t: Tabung) => {
    setFundModalMode("edit");
    setEditingFund(t);
    setFundName(t.tabung_name);
    setFundPurpose(t.tabung_purpose);
    setFundHeldAt(t.tabung_held_at);
    setFundTargetInput(t.tabung_target_amount.toFixed(2));
    setFundTargetDate(t.tabung_target_date || "");
    setFundNotes(t.tabung_notes || "");
    setFundModalError(null);
    setFundModalOpen(true);
  };

  const handleSaveFund = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundModalError(null);
    if (!userId) return;

    const name = fundName.trim();
    if (!name) {
      setFundModalError("Please enter a fund name.");
      return;
    }

    const parsedTarget = parseFloat(fundTargetInput);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setFundModalError("Please enter a target amount greater than RM 0.00.");
      return;
    }

    const targetDateChanged =
      fundTargetDate !== (editingFund?.tabung_target_date || "");
    if (
      fundTargetDate &&
      targetDateChanged &&
      fundTargetDate < getTodayDateString()
    ) {
      setFundModalError("Target date can't be in the past.");
      return;
    }

    const payload = {
      tabung_name: name,
      tabung_purpose: fundPurpose,
      tabung_held_at: fundHeldAt,
      tabung_target_amount: round2(parsedTarget),
      tabung_target_date: fundTargetDate || null,
      tabung_notes: fundNotes.trim() || null,
    };

    setSavingFund(true);
    try {
      if (fundModalMode === "add") {
        const { error } = await supabase.from("tabung").insert({
          ...payload,
          user_id: userId,
          color: RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)],
          is_active: true,
        });
        if (error) throw error;
        showToast(`Fund "${name}" created`, "success");
      } else if (editingFund) {
        const { error } = await supabase
          .from("tabung")
          .update(payload)
          .eq("tabung_id", editingFund.tabung_id)
          .eq("user_id", userId);
        if (error) throw error;
        showToast(`Fund "${name}" updated`, "success");
      }
      setFundModalOpen(false);
      await fetchData();
    } catch (err) {
      setFundModalError(getErrorMessage(err, "Failed to save fund."));
    } finally {
      setSavingFund(false);
    }
  };

  // ==========================================
  // HANDLERS: ADD / EDIT CONTRIBUTION
  // ==========================================
  const selectContribAccount = (
    accountId: string,
    type: ContributionType
  ) => {
    setContribAccountId(accountId);
    const acc = activeAccounts.find((a) => a.account_id === accountId);
    // For deposits from a fully allocated account, default to its first sub-account
    if (
      type === "deposit" &&
      acc &&
      acc.subaccounts.length > 0 &&
      getUnallocated(acc) <= 0.001
    ) {
      setContribSubId(acc.subaccounts[0].subaccount_id);
    } else {
      setContribSubId("");
    }
  };

  const openAddContribution = (t: Tabung, type: ContributionType) => {
    setContribMode("add");
    setContribType(type);
    setContribTabung(t);
    setEditingContrib(null);
    setContribAmountInput("");
    setContribDate(getTodayDateString());
    setContribNote("");
    setReflectInAccount(activeAccounts.length > 0);
    selectContribAccount(activeAccounts[0]?.account_id || "", type);
    setContribModalError(null);
    setContribModalOpen(true);
  };

  const openEditContribution = (t: Tabung, c: Contribution) => {
    setContribMode("edit");
    setContribType(c.contribution_type);
    setContribTabung(t);
    setEditingContrib(c);
    setContribAmountInput(c.amount.toFixed(2));
    setContribDate(c.contribution_date);
    setContribNote(c.note);
    setReflectInAccount(!!c.transaction_id);
    setContribAccountId(c.account_id || "");
    setContribSubId(c.subaccount_id || "");
    setContribModalError(null);
    setContribModalOpen(true);
  };

  const buildTransactionDescription = (
    type: ContributionType,
    fundName: string,
    note: string
  ) =>
    type === "deposit"
      ? `Tabung: ${fundName} — ${note}`
      : `Tabung withdrawal: ${fundName} — ${note}`;

  // Writes a contribution (and its linked transaction / balances) to Supabase
  const executeContribution = async (p: PendingContribution) => {
    if (!userId) return;
    const isDeposit = p.type === "deposit";
    const description = buildTransactionDescription(
      p.type,
      p.tabung.tabung_name,
      p.note
    );
    const txTime =
      p.date === getTodayDateString() ? getCurrentTimeString() : "23:59";

    if (p.mode === "add") {
      let transactionId: string | null = null;

      // 1. Record the transaction (deposit = expense, withdrawal = income)
      if (p.account) {
        const { data: txRow, error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: p.account.account_id,
            subaccount_id: p.sub ? p.sub.subaccount_id : null,
            transaction_type: isDeposit ? "expense" : "income",
            amount: p.amount,
            description,
            expense_category: isDeposit ? TABUNG_EXPENSE_CATEGORY : null,
            income_category: isDeposit ? null : TABUNG_INCOME_CATEGORY,
            transaction_date: p.date,
            transaction_time: txTime,
            is_active: true,
          })
          .select("transaction_id")
          .single();
        if (txError) throw txError;
        transactionId = txRow.transaction_id;
      }

      // 2. Record the contribution
      const { error: contribError } = await supabase
        .from("tabung_contribution")
        .insert({
          tabung_id: p.tabung.tabung_id,
          user_id: userId,
          contribution_type: p.type,
          tabung_contribution_amount: p.amount,
          tabung_contribution_note: p.note,
          contribution_date: p.date,
          account_id: p.account ? p.account.account_id : null,
          subaccount_id: p.sub ? p.sub.subaccount_id : null,
          transaction_id: transactionId,
          is_active: true,
        });

      if (contribError) {
        // Roll back the transaction so it doesn't exist without a contribution
        if (transactionId) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .eq("transaction_id", transactionId)
            .eq("user_id", userId);
        }
        throw contribError;
      }

      // 3. Move the money in the account
      if (p.account) {
        await applyBalanceChanges([
          {
            accountId: p.account.account_id,
            subaccountId: p.sub ? p.sub.subaccount_id : null,
            delta: -getTabungDelta(p.type, p.amount),
          },
        ]);
      }
    } else if (p.editing) {
      const c = p.editing;
      const amountDelta = round2(p.amount - c.amount);

      // 1. Keep the linked transaction in step with the contribution
      if (c.transaction_id) {
        const txUpdate: Record<string, string | number> = {
          amount: p.amount,
          description,
          transaction_date: p.date,
        };
        if (p.date !== c.contribution_date) {
          txUpdate.transaction_time = txTime;
        }
        const { error: txError } = await supabase
          .from("transactions")
          .update(txUpdate)
          .eq("transaction_id", c.transaction_id)
          .eq("user_id", userId);
        if (txError) throw txError;
      }

      // 2. Update the contribution
      const { error: contribError } = await supabase
        .from("tabung_contribution")
        .update({
          tabung_contribution_amount: p.amount,
          tabung_contribution_note: p.note,
          contribution_date: p.date,
        })
        .eq("tabung_contribution_id", c.tabung_contribution_id)
        .eq("user_id", userId);
      if (contribError) throw contribError;

      // 3. Adjust the account by the difference only
      if (c.transaction_id && c.account_id && Math.abs(amountDelta) > 0.001) {
        await applyBalanceChanges([
          {
            accountId: c.account_id,
            subaccountId: c.subaccount_id,
            delta: -getTabungDelta(c.contribution_type, amountDelta),
          },
        ]);
      }
    }
  };

  const contribSuccessMessage = (p: PendingContribution) => {
    if (p.mode === "edit") {
      return p.type === "deposit" ? "Contribution updated" : "Withdrawal updated";
    }
    return p.type === "deposit"
      ? `RM ${formatAmount(p.amount)} added to "${p.tabung.tabung_name}"`
      : `RM ${formatAmount(p.amount)} withdrawn from "${p.tabung.tabung_name}"`;
  };

  const handleContribSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribModalError(null);
    if (!userId || !contribTabung) return;

    const parsedAmount = parseFloat(contribAmountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setContribModalError("Please enter an amount greater than RM 0.00.");
      return;
    }
    const amount = round2(parsedAmount);

    const note = contribNote.trim();
    if (!note) {
      setContribModalError("Please add a short note (e.g. Monthly auto debit).");
      return;
    }

    if (!contribDate) {
      setContribModalError("Please select a date.");
      return;
    }
    if (contribDate > getTodayDateString()) {
      setContribModalError("Date can't be in the future.");
      return;
    }

    const tabung = contribTabung;
    const base = {
      type: contribType,
      tabung,
      amount,
      note,
      date: contribDate,
    };

    if (contribMode === "add") {
      if (contribType === "withdrawal" && amount > tabung.saved + 0.001) {
        setContribModalError(
          `You can only withdraw up to RM ${formatAmount(
            tabung.saved
          )} from this fund.`
        );
        return;
      }

      if (reflectInAccount) {
        const account = activeAccounts.find(
          (a) => a.account_id === contribAccountId
        );
        if (!account) {
          setContribModalError("Please select an account.");
          return;
        }
        const sub =
          account.subaccounts.find((s) => s.subaccount_id === contribSubId) ||
          null;

        if (contribType === "deposit") {
          if (account.subaccounts.length > 0 && !sub && getUnallocated(account) <= 0) {
            setContribModalError(
              `All funds in "${account.account_name}" are allocated to sub-accounts. Please pick a sub-account.`
            );
            return;
          }
          const available = getAvailableBalance(account, contribSubId);
          if (amount > available + 0.001) {
            setContribModalError(
              `Not enough balance in ${getAccountLabel(
                account.account_id,
                sub ? sub.subaccount_id : null
              )} (RM ${formatAmount(available)} available).`
            );
            return;
          }
        }

        // Ask the user to confirm the effect on the account first
        setReviewError(null);
        setPending({ ...base, mode: "add", account, sub, editing: null });
        setContribModalOpen(false);
        return;
      }

      setSavingContrib(true);
      const p: PendingContribution = {
        ...base,
        mode: "add",
        account: null,
        sub: null,
        editing: null,
      };
      try {
        await executeContribution(p);
        setContribModalOpen(false);
        showToast(contribSuccessMessage(p), "success");
        await fetchData();
      } catch (err) {
        setContribModalError(getErrorMessage(err, "Failed to save."));
      } finally {
        setSavingContrib(false);
      }
      return;
    }

    // Edit mode
    const c = editingContrib;
    if (!c) return;
    const amountDelta = round2(amount - c.amount);
    const savedAfter = round2(
      tabung.saved + getTabungDelta(c.contribution_type, amountDelta)
    );
    if (savedAfter < -0.001) {
      setContribModalError(
        "This change would bring the fund below RM 0.00 because of withdrawals already made."
      );
      return;
    }

    const linkedAccount = c.account_id
      ? allAccounts.find((a) => a.account_id === c.account_id) || null
      : null;

    if (c.transaction_id && linkedAccount && Math.abs(amountDelta) > 0.001) {
      const accountDelta = -getTabungDelta(c.contribution_type, amountDelta);
      if (accountDelta < 0) {
        const available = getAvailableBalance(
          linkedAccount,
          c.subaccount_id || ""
        );
        if (-accountDelta > available + 0.001) {
          setContribModalError(
            `Not enough balance in ${getAccountLabel(
              c.account_id,
              c.subaccount_id
            )} to cover the extra RM ${formatAmount(
              -accountDelta
            )} (RM ${formatAmount(available)} available).`
          );
          return;
        }
      }
      const sub = c.subaccount_id
        ? allSubAccounts.find((s) => s.subaccount_id === c.subaccount_id) ||
          null
        : null;
      setReviewError(null);
      setPending({
        ...base,
        mode: "edit",
        account: linkedAccount,
        sub,
        editing: c,
      });
      setContribModalOpen(false);
      return;
    }

    setSavingContrib(true);
    const p: PendingContribution = {
      ...base,
      mode: "edit",
      account: null,
      sub: null,
      editing: c,
    };
    try {
      await executeContribution(p);
      setContribModalOpen(false);
      showToast(contribSuccessMessage(p), "success");
      await fetchData();
    } catch (err) {
      setContribModalError(getErrorMessage(err, "Failed to save changes."));
    } finally {
      setSavingContrib(false);
    }
  };

  const handleConfirmPending = async () => {
    if (!pending) return;
    setReviewError(null);
    setSavingContrib(true);
    try {
      await executeContribution(pending);
      const message = contribSuccessMessage(pending);
      setPending(null);
      showToast(message, "success");
      await fetchData();
    } catch (err) {
      setReviewError(getErrorMessage(err, "Failed to save."));
    } finally {
      setSavingContrib(false);
    }
  };

  const handleReviewBack = () => {
    setPending(null);
    setContribModalOpen(true);
  };

  // Numbers shown in the review modal
  const reviewInfo = useMemo(() => {
    if (!pending) return null;
    const amountForBalance =
      pending.mode === "add"
        ? pending.amount
        : round2(pending.amount - (pending.editing?.amount || 0));
    const tabungDelta = getTabungDelta(pending.type, amountForBalance);
    const accountDelta = -tabungDelta;
    const freshAccount = pending.account
      ? allAccounts.find((a) => a.account_id === pending.account?.account_id) ||
        pending.account
      : null;
    const accountNow = freshAccount ? freshAccount.account_balance : 0;
    return {
      savedNow: pending.tabung.saved,
      savedAfter: round2(pending.tabung.saved + tabungDelta),
      accountDelta: round2(accountDelta),
      accountNow,
      accountAfter: round2(accountNow + accountDelta),
    };
  }, [pending, allAccounts]);

  // ==========================================
  // HANDLERS: REMOVE CONTRIBUTION
  // ==========================================
  const deleteContribInfo = useMemo(() => {
    if (!deletingContrib) return null;
    const { contrib: c, tabung } = deletingContrib;
    const tabungDelta = -getTabungDelta(c.contribution_type, c.amount);
    const acc = c.account_id
      ? allAccounts.find((a) => a.account_id === c.account_id) || null
      : null;
    const accountNow = acc ? acc.account_balance : 0;
    return {
      savedNow: tabung.saved,
      savedAfter: round2(tabung.saved + tabungDelta),
      linked: !!(c.transaction_id && acc),
      accountDelta: -tabungDelta,
      accountNow,
      accountAfter: round2(accountNow - tabungDelta),
    };
  }, [deletingContrib, allAccounts]);

  const handleConfirmDeleteContrib = async () => {
    if (!deletingContrib || !deleteContribInfo || !userId) return;
    const { contrib: c } = deletingContrib;
    setDeleteContribError(null);

    if (deleteContribInfo.savedAfter < -0.001) {
      setDeleteContribError(
        "Removing this would bring the fund below RM 0.00 because of later withdrawals. Remove a withdrawal first."
      );
      return;
    }

    setDeletingContribLoading(true);
    try {
      // 1. Soft-delete the contribution
      const { error: contribError } = await supabase
        .from("tabung_contribution")
        .update({ is_active: false })
        .eq("tabung_contribution_id", c.tabung_contribution_id)
        .eq("user_id", userId);
      if (contribError) throw contribError;

      if (c.transaction_id) {
        // 2. Cancel the linked transaction
        const { error: txError } = await supabase
          .from("transactions")
          .update({ is_active: false })
          .eq("transaction_id", c.transaction_id)
          .eq("user_id", userId);
        if (txError) throw txError;

        // 3. Return / take back the money in the account
        if (c.account_id) {
          await applyBalanceChanges([
            {
              accountId: c.account_id,
              subaccountId: c.subaccount_id,
              delta: getTabungDelta(c.contribution_type, c.amount),
            },
          ]);
        }
      }

      setDeletingContrib(null);
      showToast(
        c.contribution_type === "deposit"
          ? `Contribution "${c.note}" removed`
          : `Withdrawal "${c.note}" removed`,
        "danger"
      );
      await fetchData();
    } catch (err) {
      setDeleteContribError(getErrorMessage(err, "Failed to remove."));
    } finally {
      setDeletingContribLoading(false);
    }
  };

  // ==========================================
  // HANDLERS: DELETE FUND
  // ==========================================
  const deleteFundInfo = useMemo(() => {
    if (!deletingFund) return null;
    const linked = deletingFund.contributions.filter(
      (c) => c.transaction_id && c.account_id
    );
    const netToAccounts = round2(
      linked.reduce(
        (sum, c) => sum + getTabungDelta(c.contribution_type, c.amount),
        0
      )
    );
    const accountCount = new Set(linked.map((c) => c.account_id)).size;
    return { linked, netToAccounts, accountCount };
  }, [deletingFund]);

  const openDeleteFund = (t: Tabung) => {
    setDeleteFundError(null);
    setReverseLinked(false);
    setDeletingFund(t);
  };

  const handleConfirmDeleteFund = async () => {
    if (!deletingFund || !deleteFundInfo || !userId) return;
    setDeleteFundError(null);
    setDeletingFundLoading(true);
    try {
      // 1. Soft-delete the fund and its contributions
      const { error: fundError } = await supabase
        .from("tabung")
        .update({ is_active: false })
        .eq("tabung_id", deletingFund.tabung_id)
        .eq("user_id", userId);
      if (fundError) throw fundError;

      const { error: contribError } = await supabase
        .from("tabung_contribution")
        .update({ is_active: false })
        .eq("tabung_id", deletingFund.tabung_id)
        .eq("user_id", userId);
      if (contribError) throw contribError;

      // 2. Optionally cancel linked transactions and move the money back
      if (reverseLinked && deleteFundInfo.linked.length > 0) {
        const txIds = deleteFundInfo.linked
          .map((c) => c.transaction_id)
          .filter((id): id is string => !!id);
        const { error: txError } = await supabase
          .from("transactions")
          .update({ is_active: false })
          .in("transaction_id", txIds)
          .eq("user_id", userId);
        if (txError) throw txError;

        await applyBalanceChanges(
          deleteFundInfo.linked.map((c) => ({
            accountId: c.account_id as string,
            subaccountId: c.subaccount_id,
            delta: getTabungDelta(c.contribution_type, c.amount),
          }))
        );
      }

      const name = deletingFund.tabung_name;
      setDeletingFund(null);
      showToast(`Fund "${name}" deleted`, "danger");
      await fetchData();
    } catch (err) {
      setDeleteFundError(getErrorMessage(err, "Failed to delete fund."));
    } finally {
      setDeletingFundLoading(false);
    }
  };

  // ==========================================
  // CONTRIBUTION MODAL DERIVED VALUES
  // ==========================================
  const selectedContribAccount = useMemo(
    () => activeAccounts.find((a) => a.account_id === contribAccountId) || null,
    [activeAccounts, contribAccountId]
  );

  const contribModalTitle = (() => {
    const name = contribTabung?.tabung_name || "";
    if (contribMode === "edit") {
      return contribType === "deposit" ? "Edit contribution" : "Edit withdrawal";
    }
    return contribType === "deposit"
      ? `Contribute to ${name}`
      : `Withdraw from ${name}`;
  })();

  const contribSubmitLabel =
    contribMode === "edit"
      ? "Save changes"
      : contribType === "deposit"
      ? "Add contribution"
      : "Withdraw";

  // Keep the "Held at" select valid for funds saved with an older option
  const heldAtOptionExists = HELD_AT_GROUPS.some((g) =>
    g.options.includes(fundHeldAt)
  );

  return (
    <div>
      {/* Tabung Page Title, Subtitle, New Fund Button */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Tabung</h1>
          <p className="page-subtitle mb-3">
            Any goal you are putting money aside for — retirement, travel, a
            wedding, a wishlist item or an emergency buffer
          </p>
        </div>
        <div className="pt-1">
          <AddButton onClick={openCreateFund}>New fund</AddButton>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-6">
          <div
            className="h-100 p-4 rounded-4 text-white shadow-sm"
            style={{
              background:
                "linear-gradient(90deg, #1d5bbf 0%, #3e8879 55%, #5ba77b 100%)",
            }}
          >
            <span
              className="small text-white-50 fw-medium d-block"
              style={{ fontSize: "0.78rem" }}
            >
              Total saved
            </span>
            <h2
              className="text-white fw-bold my-1"
              style={{ fontSize: "2.1rem", letterSpacing: "-0.5px" }}
            >
              {formatSignedRM(summary.totalSaved)}
            </h2>
            <span className="small text-white-50" style={{ fontSize: "0.78rem" }}>
              of RM {formatAmount(summary.totalTarget)} targeted ·{" "}
              {Math.floor(summary.overallPct)}% overall
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="h-100" style={{ ...panelStyle, padding: "20px 24px" }}>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#6b7f72",
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              Contributed this month
            </div>
            <div
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#10b981",
                lineHeight: 1.2,
              }}
            >
              RM {formatAmount(summary.depositedThisMonth)}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#8b9d90", marginTop: "6px" }}>
              {summary.withdrawnThisMonth > 0
                ? `RM ${formatAmount(summary.withdrawnThisMonth)} withdrawn`
                : "No withdrawals this month"}
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="h-100" style={{ ...panelStyle, padding: "20px 24px" }}>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#6b7f72",
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              Active funds
            </div>
            <div
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#1a2e23",
                lineHeight: 1.2,
              }}
            >
              {tabungs.length}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#8b9d90", marginTop: "6px" }}>
              {summary.completedCount} completed
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ ...panelStyle, padding: "14px 18px", marginBottom: "24px" }}>
        <div className="row g-3 align-items-center justify-content-between">
          {/* Status Filter Pill Tabs */}
          <div className="col-12 col-lg-auto">
            <div
              className="d-inline-flex flex-wrap gap-1 p-1"
              style={{
                backgroundColor: "#f3f7f4",
                borderRadius: "14px",
                border: "1px solid #e4ece6",
              }}
            >
              {[
                { key: "all" as StatusFilter, label: `All (${tabungs.length})` },
                {
                  key: "in_progress" as StatusFilter,
                  label: `In progress (${summary.inProgressCount})`,
                },
                {
                  key: "completed" as StatusFilter,
                  label: `Completed (${summary.completedCount})`,
                },
              ].map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      border: "none",
                      borderRadius: "10px",
                      padding: "6px 14px",
                      fontSize: "0.8rem",
                      fontWeight: active ? 600 : 500,
                      backgroundColor: active ? "#69a980" : "transparent",
                      color: active ? "#fcf7dc" : "#4a5d52",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Purpose Filter */}
          <div className="col-12 col-lg-6">
            <div className="row g-2">
              <div className="col-12 col-sm-7">
                <div
                  className="fintrack-modal-input d-flex align-items-center"
                  style={{ gap: "10px", padding: "8px 14px" }}
                >
                  <i
                    className="bi bi-search"
                    style={{
                      color: "#8b9d90",
                      fontSize: "0.85rem",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search fund, purpose or where it's held"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      width: "100%",
                      fontSize: "0.84rem",
                      color: "#1a2e23",
                      padding: 0,
                    }}
                  />
                </div>
              </div>

              <div className="col-12 col-sm-5">
                <select
                  className="form-select fintrack-modal-input"
                  value={purposeFilter}
                  onChange={(e) => setPurposeFilter(e.target.value)}
                  style={{ fontSize: "0.84rem" }}
                >
                  <option value="all">All purposes</option>
                  {TABUNG_PURPOSES.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabung Cards Grid */}
      {loading ? (
        <div
          className="text-center py-5"
          style={{ ...panelStyle, color: "#6b7f72", fontSize: "0.9rem" }}
        >
          Loading your tabung...
        </div>
      ) : loadError ? (
        <div className="text-center py-5 px-3" style={panelStyle}>
          <h3 className="fw-bold mb-1">Couldn&apos;t load your tabung</h3>
          <p className="text-secondary small mb-0">{loadError}</p>
        </div>
      ) : filteredTabungs.length === 0 ? (
        <div className="text-center py-5 px-3" style={panelStyle}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              backgroundColor: "#eff6f1",
              color: "#69a980",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.4rem",
              marginBottom: "12px",
            }}
          >
            <i className="bi bi-piggy-bank" />
          </div>
          <h3 className="fw-bold mb-1">
            {tabungs.length === 0 ? "No tabung yet" : "No funds match your filters"}
          </h3>
          <p className="text-secondary small mb-0">
            {tabungs.length === 0
              ? 'Click "+ New fund" to start saving towards your first goal.'
              : "Try a different search, purpose or status."}
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {filteredTabungs.map((t) => {
            const completed = isCompleted(t);
            const pct =
              t.tabung_target_amount > 0
                ? (t.saved / t.tabung_target_amount) * 100
                : 0;
            const barPct = Math.min(100, Math.max(0, pct));
            const remaining = Math.max(0, round2(t.tabung_target_amount - t.saved));
            const contribCount = t.contributions.length;

            // Monthly pace needed to reach the target date
            let paceText: string | null = null;
            let paceOverdue = false;
            if (t.tabung_target_date && !completed) {
              const today = getTodayDateString();
              if (t.tabung_target_date < today) {
                paceText = `Target date ${formatDisplayDate(t.tabung_target_date)} has passed`;
                paceOverdue = true;
              } else {
                const days =
                  (new Date(`${t.tabung_target_date}T00:00:00`).getTime() -
                    new Date(`${today}T00:00:00`).getTime()) /
                  86400000;
                const months = Math.max(1, Math.ceil(days / 30.44));
                paceText = `Save ~RM ${formatAmount(
                  remaining / months
                )}/mo to reach by ${formatDisplayDate(t.tabung_target_date)}`;
              }
            }

            return (
              <div key={t.tabung_id} className="col-12 col-lg-6">
                <div
                  className="h-100 d-flex flex-column"
                  style={{ ...panelStyle, padding: "22px" }}
                >
                  {/* Card Header */}
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{ width: 38, height: 38, backgroundColor: t.color }}
                      >
                        <i className={`bi ${getPurposeIcon(t.tabung_purpose)}`} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h6
                          className="fw-bold mb-0 text-truncate"
                          style={{ fontSize: "0.92rem", color: "#1a2e23" }}
                        >
                          {t.tabung_name}
                        </h6>
                        <span
                          className="text-truncate d-block"
                          style={{ fontSize: "0.72rem", color: "#6b7f72" }}
                        >
                          {t.tabung_held_at}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {completed && (
                        <span
                          className="badge rounded-pill"
                          style={{
                            backgroundColor: "#dcfce7",
                            color: "#15803d",
                            fontSize: "0.62rem",
                            fontWeight: 600,
                            padding: "3px 9px",
                          }}
                        >
                          <i className="bi bi-check-circle-fill me-1" />
                          Completed
                        </span>
                      )}
                      <span
                        className="badge rounded-pill"
                        style={{
                          backgroundColor: "#1e4db7",
                          color: "#ffffff",
                          fontSize: "0.62rem",
                          fontWeight: 600,
                          padding: "3px 9px",
                        }}
                      >
                        {t.tabung_purpose}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditFund(t)}
                        className="btn btn-sm text-secondary p-0 border-0"
                        title="Edit fund"
                      >
                        <i className="bi bi-pencil" style={{ fontSize: "0.85rem" }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteFund(t)}
                        className="btn btn-sm p-0 border-0 text-danger"
                        title="Delete fund"
                      >
                        <i className="bi bi-trash3" style={{ fontSize: "0.85rem" }} />
                      </button>
                    </div>
                  </div>

                  {/* Saved vs Target */}
                  <div className="d-flex align-items-baseline gap-2 mb-2">
                    <span
                      className="fw-bold"
                      style={{
                        fontSize: "1.35rem",
                        color: t.saved < 0 ? "#dc2626" : "#1a2e23",
                      }}
                    >
                      {formatSignedRM(t.saved)}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                      / RM {formatAmount(t.tabung_target_amount)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div
                    style={{
                      height: 7,
                      borderRadius: 50,
                      backgroundColor: "#e9efe8",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${barPct}%`,
                        height: "100%",
                        borderRadius: 50,
                        backgroundColor: completed ? "#16a34a" : "#69a980",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div
                    className="d-flex justify-content-between mt-1"
                    style={{ fontSize: "0.72rem", color: "#6b7f72" }}
                  >
                    <span>{Math.floor(Math.max(0, pct))}% reached</span>
                    {completed ? (
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>
                        <i className="bi bi-check-circle-fill me-1" />
                        Goal reached
                      </span>
                    ) : (
                      <span>Remaining RM {formatAmount(remaining)}</span>
                    )}
                  </div>

                  {/* Target Date Pace */}
                  {paceText && (
                    <div
                      className="mt-2"
                      style={{
                        fontSize: "0.74rem",
                        color: paceOverdue ? "#b45309" : "#4a7d5e",
                        fontWeight: 500,
                      }}
                    >
                      <i className="bi bi-calendar-event me-1" />
                      {paceText}
                    </div>
                  )}

                  {/* Notes */}
                  {t.tabung_notes && (
                    <p
                      className="mb-0 mt-2"
                      style={{ fontSize: "0.78rem", color: "#4a5d52", lineHeight: 1.5 }}
                    >
                      {t.tabung_notes}
                    </p>
                  )}

                  {/* Contributions List (5 rows visible, scroll for more) */}
                  <div className="mt-3 flex-grow-1">
                    {contribCount === 0 ? (
                      <div
                        className="rounded-3 text-center py-3"
                        style={{
                          backgroundColor: "#f8faf7",
                          border: "1px dashed #dfe8de",
                          fontSize: "0.76rem",
                          color: "#8b9d90",
                        }}
                      >
                        No contributions yet
                      </div>
                    ) : (
                      <>
                        <div
                          className="rounded-3 px-2"
                          style={{
                            backgroundColor: "#f8faf7",
                            border: "1px solid #edf2ec",
                            maxHeight:
                              CONTRIBUTION_ROW_HEIGHT * CONTRIBUTION_VISIBLE_ROWS + 2,
                            overflowY: "auto",
                          }}
                        >
                          {t.contributions.map((c, idx) => {
                            const isDeposit = c.contribution_type === "deposit";
                            const isLinked = !!c.transaction_id;
                            const accountLabel = isLinked
                              ? getAccountLabel(c.account_id, c.subaccount_id)
                              : "";
                            return (
                              <div
                                key={c.tabung_contribution_id}
                                className="d-flex justify-content-between align-items-center gap-2 px-1"
                                style={{
                                  height: CONTRIBUTION_ROW_HEIGHT,
                                  borderBottom:
                                    idx < contribCount - 1
                                      ? "1px solid #e9efe8"
                                      : "none",
                                }}
                              >
                                <div
                                  className="d-flex align-items-center gap-2"
                                  style={{ minWidth: 0 }}
                                >
                                  <i
                                    className={`bi ${
                                      isLinked ? "bi-link-45deg" : "bi-piggy-bank"
                                    }`}
                                    title={
                                      isLinked
                                        ? `Linked to ${accountLabel}`
                                        : "Not linked to an account"
                                    }
                                    style={{
                                      color: "#6b7f72",
                                      fontSize: "0.9rem",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      className="fw-semibold text-truncate"
                                      style={{ fontSize: "0.8rem", color: "#1a2e23" }}
                                    >
                                      {c.note}
                                    </div>
                                    <div
                                      className="text-truncate"
                                      style={{ fontSize: "0.7rem", color: "#8b9d90" }}
                                    >
                                      {formatDisplayDate(c.contribution_date)}
                                      {isLinked ? ` · ${accountLabel}` : ""}
                                    </div>
                                  </div>
                                </div>

                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                  <span
                                    style={{
                                      fontSize: "0.8rem",
                                      fontWeight: 600,
                                      color: isDeposit ? "#16a34a" : "#dc2626",
                                    }}
                                  >
                                    {isDeposit ? "+" : "–"} RM {formatAmount(c.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openEditContribution(t, c)}
                                    className="btn btn-sm text-secondary p-0 border-0"
                                    title="Edit"
                                  >
                                    <i className="bi bi-pencil" style={{ fontSize: "0.78rem" }} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteContribError(null);
                                      setDeletingContrib({ contrib: c, tabung: t });
                                    }}
                                    className="btn btn-sm text-danger p-0 border-0"
                                    title="Remove"
                                  >
                                    <i className="bi bi-trash3" style={{ fontSize: "0.78rem" }} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {contribCount > CONTRIBUTION_VISIBLE_ROWS && (
                          <div
                            className="text-center mt-1"
                            style={{ fontSize: "0.7rem", color: "#8b9d90" }}
                          >
                            <i className="bi bi-arrow-down-short" />
                            Scroll to see all {contribCount} entries
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Card Footer Buttons */}
                  <div className="d-flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openAddContribution(t, "deposit")}
                      className="btn btn-sm flex-grow-1 rounded-pill fw-medium fintrack-subtle-btn"
                      style={{ fontSize: "0.78rem", padding: "7px 12px" }}
                    >
                      <i className="bi bi-plus-lg me-1" /> Add contribution
                    </button>
                    {t.saved > 0 && (
                      <button
                        type="button"
                        onClick={() => openAddContribution(t, "withdrawal")}
                        className="btn btn-sm rounded-pill fw-medium fintrack-subtle-btn"
                        style={{ fontSize: "0.78rem", padding: "7px 16px" }}
                      >
                        <i className="bi bi-dash-lg me-1" /> Withdraw
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
          MODAL 1: CREATE / EDIT FUND
          ========================================================= */}
      <Modal
        open={fundModalOpen}
        onCancel={() => setFundModalOpen(false)}
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
          {fundModalMode === "add"
            ? "Create a savings fund"
            : `Edit ${editingFund?.tabung_name || "fund"}`}
        </h3>

        <form onSubmit={handleSaveFund}>
          {fundModalError && <ErrorBox message={fundModalError} />}

          <div className="mb-3">
            <label className="fintrack-modal-label">Fund name</label>
            <input
              type="text"
              required
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              placeholder="Japan Trip 2027"
              className="form-control fintrack-modal-input"
            />
          </div>

          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fintrack-modal-label">Purpose</label>
              <select
                value={fundPurpose}
                onChange={(e) => setFundPurpose(e.target.value)}
                className="form-select fintrack-modal-input"
              >
                {TABUNG_PURPOSES.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">Held at</label>
              <select
                value={fundHeldAt}
                onChange={(e) => setFundHeldAt(e.target.value)}
                className="form-select fintrack-modal-input"
              >
                {!heldAtOptionExists && (
                  <option value={fundHeldAt}>{fundHeldAt}</option>
                )}
                {HELD_AT_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fintrack-modal-label">Target (RM)</label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={fundTargetInput}
                onChange={(e) => setFundTargetInput(formatCentsInput(e.target.value))}
                placeholder="20000.00"
                className="form-control fintrack-modal-input"
              />
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">Target date (optional)</label>
              <input
                type="date"
                value={fundTargetDate}
                onChange={(e) => setFundTargetDate(e.target.value)}
                className="form-control fintrack-modal-input"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="fintrack-modal-label">Notes</label>
            <textarea
              rows={3}
              value={fundNotes}
              onChange={(e) => setFundNotes(e.target.value)}
              placeholder="What is this fund for?"
              className="form-control fintrack-modal-input"
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setFundModalOpen(false)}
              disabled={savingFund}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingFund}
            >
              {fundModalMode === "add" ? "Create fund" : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 2: ADD / EDIT CONTRIBUTION OR WITHDRAWAL
          ========================================================= */}
      <Modal
        open={contribModalOpen}
        onCancel={() => setContribModalOpen(false)}
        footer={null}
        centered
        width={520}
        className="fintrack-modal"
        destroyOnHidden
      >
        <h3
          className="mb-1"
          style={{ fontSize: "1.18rem", fontWeight: 600, color: "#1a2e23" }}
        >
          {contribModalTitle}
        </h3>
        <p className="text-secondary mb-3" style={{ fontSize: "0.8rem" }}>
          {contribMode === "edit"
            ? "Update the amount, date or note."
            : contribType === "deposit"
            ? `Saved so far: RM ${formatAmount(contribTabung?.saved || 0)} of RM ${formatAmount(
                contribTabung?.tabung_target_amount || 0
              )}`
            : `Available to withdraw: RM ${formatAmount(contribTabung?.saved || 0)}`}
        </p>

        <form onSubmit={handleContribSubmit}>
          {contribModalError && <ErrorBox message={contribModalError} />}

          <div className="row g-3 mb-3">
            <div className="col-6">
              <div className="d-flex justify-content-between align-items-center">
                <label className="fintrack-modal-label">Amount (RM)</label>
                {contribMode === "add" &&
                  contribType === "withdrawal" &&
                  (contribTabung?.saved || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContribAmountInput((contribTabung?.saved || 0).toFixed(2))
                      }
                      className="btn btn-sm py-0 px-2 rounded-pill mb-1"
                      style={{
                        fontSize: "0.68rem",
                        backgroundColor: "#e8f3ec",
                        color: "#4a7d5e",
                        fontWeight: 600,
                        border: "none",
                      }}
                    >
                      Max
                    </button>
                  )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                required
                value={contribAmountInput}
                onChange={(e) => setContribAmountInput(formatCentsInput(e.target.value))}
                placeholder="500.00"
                className="form-control fintrack-modal-input"
              />
            </div>
            <div className="col-6">
              <label className="fintrack-modal-label">Date</label>
              <input
                type="date"
                required
                value={contribDate}
                max={getTodayDateString()}
                onChange={(e) => setContribDate(e.target.value)}
                className="form-control fintrack-modal-input"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="fintrack-modal-label">Note</label>
            <input
              type="text"
              required
              value={contribNote}
              onChange={(e) => setContribNote(e.target.value)}
              placeholder={
                contribType === "deposit" ? "Monthly auto debit" : "Paid for flight tickets"
              }
              className="form-control fintrack-modal-input"
            />
          </div>

          {contribMode === "add" ? (
            <div
              className="mb-3 p-3"
              style={{
                backgroundColor: "#f6faf7",
                border: "1px solid #e2ebe4",
                borderRadius: "12px",
              }}
            >
              <label
                style={{
                  ...checkboxLabelStyle,
                  cursor: activeAccounts.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={reflectInAccount}
                  disabled={activeAccounts.length === 0}
                  onChange={(e) => setReflectInAccount(e.target.checked)}
                  style={checkboxInputStyle}
                />
                Reflect in an account &amp; record a transaction
              </label>
              <div style={{ fontSize: "0.72rem", color: "#6b7f72", marginTop: "4px" }}>
                {activeAccounts.length === 0
                  ? "Add an account on the Accounts page to link contributions to it."
                  : contribType === "deposit"
                  ? "The amount is deducted from the account and recorded as an expense."
                  : "The amount is added back to the account and recorded as income."}
              </div>

              {reflectInAccount && activeAccounts.length > 0 && (
                <>
                  <div className="row g-3 mt-1">
                    <div className="col-6">
                      <label className="fintrack-modal-label">
                        {contribType === "deposit" ? "From account" : "To account"}
                      </label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={contribAccountId}
                        onChange={(e) => selectContribAccount(e.target.value, contribType)}
                      >
                        {activeAccounts.map((acc) => (
                          <option key={acc.account_id} value={acc.account_id}>
                            {acc.account_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="fintrack-modal-label">Sub-account</label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={contribSubId}
                        onChange={(e) => setContribSubId(e.target.value)}
                        disabled={
                          !selectedContribAccount ||
                          selectedContribAccount.subaccounts.length === 0
                        }
                      >
                        {!selectedContribAccount ||
                        selectedContribAccount.subaccounts.length === 0 ? (
                          <option value="">No sub-accounts</option>
                        ) : (
                          <>
                            {contribType === "withdrawal" ||
                            getUnallocated(selectedContribAccount) > 0 ? (
                              <option value="">None (Main account)</option>
                            ) : (
                              <option value="" disabled>
                                None (RM 0.00 unallocated)
                              </option>
                            )}
                            {selectedContribAccount.subaccounts.map((sub) => (
                              <option key={sub.subaccount_id} value={sub.subaccount_id}>
                                {sub.subaccount_name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {selectedContribAccount && contribType === "deposit" && (
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
                        Available in {contribSubId ? "sub-account" : "main account"}:
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            getAvailableBalance(selectedContribAccount, contribSubId) > 0
                              ? "#16a34a"
                              : "#dc2626",
                        }}
                      >
                        RM{" "}
                        {formatAmount(
                          getAvailableBalance(selectedContribAccount, contribSubId)
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div
              className="mb-3 px-3 py-2"
              style={{
                backgroundColor: "#f6faf7",
                border: "1px solid #e2ebe4",
                borderRadius: "10px",
                fontSize: "0.76rem",
                color: "#546e5f",
              }}
            >
              <i
                className={`bi ${
                  editingContrib?.transaction_id ? "bi-link-45deg" : "bi-piggy-bank"
                } me-1`}
              />
              {editingContrib?.transaction_id
                ? `Linked to ${getAccountLabel(
                    editingContrib.account_id,
                    editingContrib.subaccount_id
                  )}. Changing the amount also adjusts that account and its transaction.`
                : "Not linked to an account, so only the fund balance changes."}
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setContribModalOpen(false)}
              disabled={savingContrib}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingContrib}
            >
              {contribSubmitLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =========================================================
          MODAL 3: REVIEW EFFECT ON ACCOUNT BEFORE SAVING
          ========================================================= */}
      <Modal
        open={!!pending}
        onCancel={() => {
          if (!savingContrib) setPending(null);
        }}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        title={
          pending?.mode === "edit"
            ? "Confirm this change?"
            : pending?.type === "deposit"
            ? "Confirm this contribution?"
            : "Confirm this withdrawal?"
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
          Review the effect on your fund and account before confirming.
        </p>

        {reviewError && <ErrorBox message={reviewError} />}

        {pending && reviewInfo && (
          <>
            <SummaryTable>
              <SummaryRow label="Fund" value={pending.tabung.tabung_name} />
              <SummaryRow label="Note" value={pending.note} />
              <SummaryRow label="Date" value={formatDisplayDate(pending.date)} />
              <SummaryRow
                label="Amount"
                value={
                  pending.mode === "edit" && pending.editing
                    ? `RM ${formatAmount(pending.editing.amount)} → RM ${formatAmount(
                        pending.amount
                      )}`
                    : `RM ${formatAmount(pending.amount)}`
                }
              />
              <SummaryRow
                label="Fund balance"
                value={`${formatSignedRM(reviewInfo.savedNow)} → ${formatSignedRM(
                  reviewInfo.savedAfter
                )}`}
              />
              <SummaryRow
                label="Account"
                value={
                  pending.account
                    ? getAccountLabel(
                        pending.account.account_id,
                        pending.sub ? pending.sub.subaccount_id : null
                      )
                    : "—"
                }
              />
              <SummaryRow
                label="Effect on account"
                value={
                  reviewInfo.accountDelta < 0
                    ? `Deducting RM ${formatAmount(reviewInfo.accountDelta)}`
                    : `Adding RM ${formatAmount(reviewInfo.accountDelta)}`
                }
                valueColor={reviewInfo.accountDelta < 0 ? "#dc2626" : "#16a34a"}
              />
              <SummaryRow
                label="Balance now"
                value={formatSignedRM(reviewInfo.accountNow)}
              />
              <SummaryRow
                label="Balance after"
                value={formatSignedRM(reviewInfo.accountAfter)}
                bold
                last
              />
            </SummaryTable>

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={handleReviewBack}
                disabled={savingContrib}
              >
                Back
              </Button>
              <Button
                className="fintrack-modal-primary-btn"
                onClick={handleConfirmPending}
                loading={savingContrib}
              >
                {pending.mode === "edit"
                  ? "Save changes"
                  : pending.type === "deposit"
                  ? "Confirm contribution"
                  : "Confirm withdrawal"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* =========================================================
          MODAL 4: REMOVE CONTRIBUTION / WITHDRAWAL
          ========================================================= */}
      <Modal
        open={!!deletingContrib}
        onCancel={() => {
          if (!deletingContribLoading) setDeletingContrib(null);
        }}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        title={
          deletingContrib?.contrib.contribution_type === "withdrawal"
            ? "Remove this withdrawal?"
            : "Remove this contribution?"
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
          {deleteContribInfo?.linked
            ? "The linked transaction will be cancelled and the account balance restored."
            : "This only changes the fund balance."}
        </p>

        {deleteContribError && <ErrorBox message={deleteContribError} />}

        {deletingContrib && deleteContribInfo && (
          <>
            <SummaryTable>
              <SummaryRow label="Fund" value={deletingContrib.tabung.tabung_name} />
              <SummaryRow label="Note" value={deletingContrib.contrib.note} />
              <SummaryRow
                label="Date"
                value={formatDisplayDate(deletingContrib.contrib.contribution_date)}
              />
              <SummaryRow
                label="Amount"
                value={`${
                  deletingContrib.contrib.contribution_type === "deposit" ? "+" : "–"
                } RM ${formatAmount(deletingContrib.contrib.amount)}`}
              />
              <SummaryRow
                label="Fund balance"
                value={`${formatSignedRM(deleteContribInfo.savedNow)} → ${formatSignedRM(
                  deleteContribInfo.savedAfter
                )}`}
                last={!deleteContribInfo.linked}
              />
              {deleteContribInfo.linked && (
                <>
                  <SummaryRow
                    label="Account"
                    value={getAccountLabel(
                      deletingContrib.contrib.account_id,
                      deletingContrib.contrib.subaccount_id
                    )}
                  />
                  <SummaryRow
                    label="Effect on account"
                    value={
                      deleteContribInfo.accountDelta > 0
                        ? `Refunding RM ${formatAmount(deleteContribInfo.accountDelta)}`
                        : `Deducting RM ${formatAmount(deleteContribInfo.accountDelta)}`
                    }
                    valueColor={
                      deleteContribInfo.accountDelta > 0 ? "#16a34a" : "#dc2626"
                    }
                  />
                  <SummaryRow
                    label="Balance now"
                    value={formatSignedRM(deleteContribInfo.accountNow)}
                  />
                  <SummaryRow
                    label="Balance after"
                    value={formatSignedRM(deleteContribInfo.accountAfter)}
                    bold
                    last
                  />
                </>
              )}
            </SummaryTable>

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setDeletingContrib(null)}
                disabled={deletingContribLoading}
              >
                Keep it
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmDeleteContrib}
                loading={deletingContribLoading}
              >
                Remove
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* =========================================================
          MODAL 5: DELETE FUND
          ========================================================= */}
      <Modal
        open={!!deletingFund}
        onCancel={() => {
          if (!deletingFundLoading) setDeletingFund(null);
        }}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        title={deletingFund ? `Delete "${deletingFund.tabung_name}"?` : "Delete fund?"}
      >
        {deleteFundError && <ErrorBox message={deleteFundError} />}

        {deletingFund && deleteFundInfo && (
          <>
            <SummaryTable>
              <SummaryRow label="Saved balance" value={formatSignedRM(deletingFund.saved)} />
              <SummaryRow label="Entries" value={deletingFund.contributions.length} />
              <SummaryRow
                label="Linked to accounts"
                value={deleteFundInfo.linked.length}
                last={!(reverseLinked && deleteFundInfo.linked.length > 0)}
              />
              {reverseLinked && deleteFundInfo.linked.length > 0 && (
                <SummaryRow
                  label="Net effect on accounts"
                  value={`${deleteFundInfo.netToAccounts >= 0 ? "+" : "–"} RM ${formatAmount(
                    deleteFundInfo.netToAccounts
                  )}`}
                  valueColor={deleteFundInfo.netToAccounts >= 0 ? "#16a34a" : "#dc2626"}
                  bold
                  last
                />
              )}
            </SummaryTable>

            {deleteFundInfo.linked.length > 0 && (
              <div className="mb-3">
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={reverseLinked}
                    onChange={(e) => setReverseLinked(e.target.checked)}
                    style={checkboxInputStyle}
                  />
                  Also cancel the {deleteFundInfo.linked.length} linked transaction
                  {deleteFundInfo.linked.length > 1 ? "s" : ""}
                </label>
                <div style={{ fontSize: "0.74rem", color: "#6b7f72", marginTop: "4px" }}>
                  {reverseLinked
                    ? `The money goes back to ${deleteFundInfo.accountCount} account${
                        deleteFundInfo.accountCount > 1 ? "s" : ""
                      } it came from.`
                    : "Linked transactions stay on the Transactions page and account balances won't change."}
                </div>
              </div>
            )}

            <div className="d-flex justify-content-center gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setDeletingFund(null)}
                disabled={deletingFundLoading}
              >
                Keep fund
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmDeleteFund}
                loading={deletingFundLoading}
              >
                Delete fund
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
