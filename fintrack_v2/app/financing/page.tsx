"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

type FinancingStatus = "active" | "settled";
type InstallmentStatus = "pending" | "paid";
type StatusFilter = "active" | "settled" | "all";

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
  credit_limit: number | null;
  subaccounts: SubAccount[];
}

interface FinancingInstallment {
  installment_id: string;
  financing_id: string;
  user_id: string;
  installment_number: number;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  status: InstallmentStatus;
  paid_at: string | null; // YYYY-MM-DD
  installment_notes: string | null;
  account_id: string | null;
  subaccount_id: string | null;
  transaction_id: string | null;
  is_active: boolean;
}

interface FinancingPlan {
  financing_id: string;
  user_id: string;
  financing_name: string;
  financing_provider: string;
  financing_category: string;
  total_amount: number;
  duration_months: number | null;
  start_date: string; // YYYY-MM-DD
  sync_to_commitments: boolean;
  status: FinancingStatus;
  financing_notes: string | null;
  account_id: string | null;
  is_active: boolean;
  created_at: string;
  installments: FinancingInstallment[];
}

const FINANCING_EXPENSE_CATEGORY = "Financing / Installment";

const FINANCING_CATEGORIES = [
  "Car",
  "Electronics",
  "Telco",
  "Home",
  "BNPL",
  "Credit Card",
  "Personal Loan",
  "Education",
  "Other",
];

const PROVIDER_SUGGESTIONS = [
  "Maybank",
  "CIMB",
  "Bank Islam",
  "RHB",
  "Public Bank",
  "BSN",
  "AmBank",
  "Hong Leong Bank",
  "SPayLater",
  "SFinancing",
  "Atome",
  "GrabPayLater",
  "AEON Credit",
  "Maxis",
  "CelcomDigi",
  "U Mobile",
  "Courts",
  "PTPTN",
  "Other",
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Car: { bg: "#173f8f", color: "#ffffff" },
  Electronics: { bg: "#173f8f", color: "#ffffff" },
  Telco: { bg: "#173f8f", color: "#ffffff" },
  Home: { bg: "#173f8f", color: "#ffffff" },
  BNPL: { bg: "#173f8f", color: "#ffffff" },
  "Credit Card": { bg: "#173f8f", color: "#ffffff" },
  "Personal Loan": { bg: "#173f8f", color: "#ffffff" },
  Education: { bg: "#173f8f", color: "#ffffff" },
  Other: { bg: "#173f8f", color: "#ffffff" },
};

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

function cleanDecimalInput(rawValue: string): string {
  if (!rawValue) return "";
  let cleaned = rawValue.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + "." + parts[1].slice(0, 2);
  }
  return cleaned;
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

// Adds `monthsToAdd` months to a YYYY-MM-DD date string safely
function addMonthsToDateString(dateStr: string, monthsToAdd: number): string {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const targetMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDayInTargetMonth = new Date(
    targetYear,
    normalizedMonth + 1,
    0
  ).getDate();
  const clampedDay = Math.min(day, maxDayInTargetMonth);
  const yyyy = String(targetYear);
  const mm = String(normalizedMonth + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setDayOfDateString(dateStr: string, targetDay: number): string {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3) return dateStr;
  const [year, month] = parts;
  const maxDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(targetDay, maxDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
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
  status: InstallmentStatus,
  todayStr: string
): {
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  daysDiff: number | null;
} {
  if (!dueDate || status === "paid") {
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
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  allowClear?: boolean;
  max?: string;
  min?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Fallback to focus/click
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        className="form-control fintrack-modal-input"
        placeholder={placeholder}
        value={value ? formatDisplayDate(value) : ""}
        readOnly
        required={required}
        onClick={openPicker}
        style={{
          cursor: "pointer",
          backgroundColor: "#ffffff",
          paddingRight: allowClear && value ? "62px" : "38px",
        }}
      />
      {allowClear && value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
          title="Clear date"
          style={{
            position: "absolute",
            right: "32px",
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            color: "#94a39b",
            padding: "2px 6px",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          <i className="bi bi-x-circle-fill" />
        </button>
      )}
      <i
        className="bi bi-calendar3"
        onClick={openPicker}
        style={{
          position: "absolute",
          right: "13px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "#6b7f72",
          fontSize: "0.85rem",
          cursor: "pointer",
          pointerEvents: "none",
        }}
      />
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          border: "none",
          padding: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function FinancingPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create / Edit Plan Modal State
  const [planModalOpen, setPlanModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<FinancingPlan | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formProviderSelect, setFormProviderSelect] = useState<string>("Maybank");
  const [formCustomProvider, setFormCustomProvider] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Car");
  const [formTotalInput, setFormTotalInput] = useState<string>("");
  const [formDurationInput, setFormDurationInput] = useState<string>("12");
  const [formMonthlyInput, setFormMonthlyInput] = useState<string>("");
  const [formIsFlexibleDuration, setFormIsFlexibleDuration] = useState<boolean>(false);
  const [formStartDate, setFormStartDate] = useState<string>(getTodayDateString());
  const [formRealignDates, setFormRealignDates] = useState<boolean>(true);
  const [formSyncCommitments, setFormSyncCommitments] = useState<boolean>(false);
  const [formLinkCreditCard, setFormLinkCreditCard] = useState<boolean>(false);
  const [formCreditCardId, setFormCreditCardId] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [planModalError, setPlanModalError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState<boolean>(false);

  // Detail & Installment Schedule Modal State (opened when clicking a card)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [togglingSyncPlanId, setTogglingSyncPlanId] = useState<string | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "pending" | "paid">("all");
  const [realigningSchedule, setRealigningSchedule] = useState<boolean>(false);

  // Sub-modal Edit Installment State inside Detail Modal
  const [editingInstallment, setEditingInstallment] =
    useState<FinancingInstallment | null>(null);
  const [editInstDueDate, setEditInstDueDate] = useState<string>("");
  const [editInstAmountInput, setEditInstAmountInput] = useState<string>("");
  const [editInstNotes, setEditInstNotes] = useState<string>("");
  const [editInstSyncTotal, setEditInstSyncTotal] = useState<boolean>(true);
  const [editInstApplyToFuture, setEditInstApplyToFuture] = useState<boolean>(false);
  const [editInstSyncDayToFuture, setEditInstSyncDayToFuture] = useState<boolean>(false);
  const [editInstSyncStartDate, setEditInstSyncStartDate] = useState<boolean>(true);
  const [savingInstallmentEdit, setSavingInstallmentEdit] = useState<boolean>(false);
  const [editInstError, setEditInstError] = useState<string | null>(null);

  // Add New Month / Bill Modal State (inside Detail Modal)
  const [addMonthModalOpen, setAddMonthModalOpen] = useState<boolean>(false);
  const [newMonthDueDate, setNewMonthDueDate] = useState<string>(getTodayDateString());
  const [newMonthAmountInput, setNewMonthAmountInput] = useState<string>("");
  const [newMonthNotes, setNewMonthNotes] = useState<string>("");
  const [newMonthAddToTotal, setNewMonthAddToTotal] = useState<boolean>(true);
  const [savingNewMonth, setSavingNewMonth] = useState<boolean>(false);
  const [addMonthError, setAddMonthError] = useState<string | null>(null);

  // Pay Installment Confirmation Modal State
  const [payingInstallment, setPayingInstallment] =
    useState<FinancingInstallment | null>(null);
  const [payDate, setPayDate] = useState<string>(getTodayDateString());
  const [payAmountInput, setPayAmountInput] = useState<string>("");
  const [payReflectAccount, setPayReflectAccount] = useState<boolean>(true);
  const [payAccountId, setPayAccountId] = useState<string>("");
  const [paySubAccountId, setPaySubAccountId] = useState<string>("");
  const [payNotes, setPayNotes] = useState<string>("");
  const [payingLoading, setPayingLoading] = useState<boolean>(false);
  const [payModalError, setPayModalError] = useState<string | null>(null);

  // Unpay (Mark as Pending) Installment Confirmation Modal State
  const [unpayingInstallment, setUnpayingInstallment] =
    useState<FinancingInstallment | null>(null);
  const [unpayingLoading, setUnpayingLoading] = useState<boolean>(false);
  const [unpayError, setUnpayError] = useState<string | null>(null);

  // Delete Plan Modal State
  const [deletingPlan, setDeletingPlan] = useState<FinancingPlan | null>(null);
  const [refundPaidOnDelete, setRefundPaidOnDelete] = useState<boolean>(false);
  const [deletingLoading, setDeletingLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast State
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

  const fetchData = useCallback(async () => {
    setLoading(true);
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

      const [plansRes, instRes, accountsRes, subaccountsRes] = await Promise.all([
        supabase
          .from("financing")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("financing_installments")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("installment_number", { ascending: true })
          .order("due_date", { ascending: true }),
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("subaccounts")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (instRes.error) throw instRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;

      const rawSubs = subaccountsRes.data || [];
      const mergedAccounts: Account[] = (accountsRes.data || []).map((acc) => ({
        account_id: acc.account_id,
        account_name: acc.account_name,
        account_type: acc.account_type,
        account_balance: Number(acc.account_balance),
        is_active: acc.is_active,
        is_credit_card: Boolean(
          acc.is_credit_card || acc.account_type === "Credit Card"
        ),
        credit_limit:
          acc.credit_limit !== null && acc.credit_limit !== undefined
            ? Number(acc.credit_limit)
            : null,
        subaccounts: rawSubs
          .filter((s) => s.account_id === acc.account_id)
          .map((s) => ({
            subaccount_id: s.subaccount_id,
            account_id: s.account_id,
            subaccount_name: s.subaccount_name,
            subaccount_value: Number(s.subaccount_value),
            is_active: s.is_active,
          })),
      }));

      const rawInstallments: FinancingInstallment[] = (instRes.data || []).map(
        (row) => ({
          installment_id: row.installment_id,
          financing_id: row.financing_id,
          user_id: row.user_id,
          installment_number: Number(row.installment_number),
          due_date: row.due_date,
          amount_due: Number(row.amount_due),
          amount_paid: Number(row.amount_paid),
          status: row.status as InstallmentStatus,
          paid_at: row.paid_at || null,
          installment_notes: row.installment_notes || null,
          account_id: row.account_id || null,
          subaccount_id: row.subaccount_id || null,
          transaction_id: row.transaction_id || null,
          is_active: row.is_active,
        })
      );

      const mappedPlans: FinancingPlan[] = (plansRes.data || []).map((p) => {
        const planInstallments = rawInstallments
          .filter((i) => i.financing_id === p.financing_id)
          .sort((a, b) => {
            if (a.installment_number !== b.installment_number) {
              return a.installment_number - b.installment_number;
            }
            return a.due_date.localeCompare(b.due_date);
          });

        return {
          financing_id: p.financing_id,
          user_id: p.user_id,
          financing_name: p.financing_name,
          financing_provider: p.financing_provider,
          financing_category: p.financing_category || "Other",
          total_amount: Number(p.total_amount),
          duration_months:
            p.duration_months !== null && p.duration_months !== undefined
              ? Number(p.duration_months)
              : null,
          start_date: p.start_date,
          sync_to_commitments: Boolean(p.sync_to_commitments),
          status: p.status as FinancingStatus,
          financing_notes: p.financing_notes || null,
          account_id: p.account_id || null,
          is_active: p.is_active,
          created_at: p.created_at,
          installments: planInstallments,
        };
      });

      setAccounts(mergedAccounts);
      setPlans(mappedPlans);
    } catch (err: unknown) {
      showToast(
        getErrorMessage(err, "Failed to load financing records."),
        "danger"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const todayStr = useMemo(() => getTodayDateString(), []);
  const currentYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Currently selected plan for the Detail & Schedule Modal
  const selectedPlan = useMemo(
    () => plans.find((p) => p.financing_id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  // Filtered installments for the Schedule Modal tabs
  const filteredInstallments = useMemo(() => {
    if (!selectedPlan) return [];
    if (scheduleFilter === "pending") {
      return selectedPlan.installments.filter((i) => i.status === "pending");
    }
    if (scheduleFilter === "paid") {
      return selectedPlan.installments.filter((i) => i.status === "paid");
    }
    return selectedPlan.installments;
  }, [selectedPlan, scheduleFilter]);

  const nextDueInstId = useMemo(() => {
    if (!selectedPlan) return null;
    return (
      selectedPlan.installments.find((i) => i.status === "pending")?.installment_id ||
      null
    );
  }, [selectedPlan]);

  const futurePendingCount = useMemo(() => {
    if (!selectedPlan || !editingInstallment) return 0;
    return selectedPlan.installments.filter(
      (i) =>
        i.installment_number > editingInstallment.installment_number &&
        i.status === "pending"
    ).length;
  }, [selectedPlan, editingInstallment]);

  const editDayOfMonth = useMemo(() => {
    if (!editInstDueDate) return null;
    const parts = editInstDueDate.slice(0, 10).split("-").map(Number);
    return parts.length === 3 ? parts[2] : null;
  }, [editInstDueDate]);

  // Helper to compute plan metrics
  const getPlanStats = useCallback(
    (plan: FinancingPlan) => {
      const totalPaid = round2(
        plan.installments
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + i.amount_paid, 0)
      );
      const totalAmount = round2(plan.total_amount);
      const remaining = Math.max(0, round2(totalAmount - totalPaid));
      const pct =
        totalAmount > 0
          ? Math.min(100, Math.round((totalPaid / totalAmount) * 100))
          : plan.installments.length > 0 &&
            plan.installments.every((i) => i.status === "paid")
            ? 100
            : 0;
      const pendingInstallments = plan.installments.filter(
        (i) => i.status === "pending"
      );
      const paidInstallments = plan.installments.filter(
        (i) => i.status === "paid"
      );
      const nextInstallment = pendingInstallments[0] || null;
      const overdueCount = pendingInstallments.filter(
        (i) => getDueStatus(i.due_date, i.status, todayStr).isOverdue
      ).length;
      const isFullySettled =
        plan.status === "settled" ||
        (totalAmount > 0 &&
          totalPaid >= totalAmount &&
          pendingInstallments.length === 0);

      // Monthly display amount
      let monthlyDisplay = 0;
      if (nextInstallment) {
        monthlyDisplay = nextInstallment.amount_due;
      } else if (plan.installments.length > 0) {
        monthlyDisplay = plan.installments[0].amount_due;
      } else if (plan.duration_months && plan.duration_months > 0) {
        monthlyDisplay = round2(totalAmount / plan.duration_months);
      }

      return {
        totalPaid,
        totalAmount,
        remaining,
        pct,
        pendingInstallments,
        paidInstallments,
        nextInstallment,
        overdueCount,
        isFullySettled,
        monthlyDisplay,
      };
    },
    [todayStr]
  );

  // Summary metrics across all plans
  const summaryStats = useMemo(() => {
    let activeRemaining = 0;
    let activeCount = 0;
    let settledCount = 0;
    let totalPaidAll = 0;
    let totalAmountAll = 0;
    let dueThisMonth = 0;
    let overdueInstallmentsCount = 0;

    plans.forEach((p) => {
      const stats = getPlanStats(p);
      totalPaidAll = round2(totalPaidAll + stats.totalPaid);
      totalAmountAll = round2(totalAmountAll + stats.totalAmount);

      if (stats.isFullySettled) {
        settledCount += 1;
      } else {
        activeCount += 1;
        activeRemaining = round2(activeRemaining + stats.remaining);
      }

      p.installments.forEach((inst) => {
        if (inst.status === "pending") {
          if (inst.due_date.slice(0, 7) === currentYearMonth) {
            dueThisMonth = round2(dueThisMonth + inst.amount_due);
          }
          if (getDueStatus(inst.due_date, inst.status, todayStr).isOverdue) {
            overdueInstallmentsCount += 1;
          }
        }
      });
    });

    const overallPct =
      totalAmountAll > 0
        ? Math.min(100, Math.round((totalPaidAll / totalAmountAll) * 100))
        : 0;

    return {
      activeRemaining,
      activeCount,
      settledCount,
      allCount: plans.length,
      totalPaidAll,
      overallPct,
      dueThisMonth,
      overdueInstallmentsCount,
    };
  }, [plans, getPlanStats, currentYearMonth, todayStr]);

  const nonCreditAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => !a.is_credit_card && a.account_type !== "Credit Card"
      ),
    [accounts]
  );

  const creditCardAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.is_credit_card || a.account_type === "Credit Card"
      ),
    [accounts]
  );

  // Computes a credit card's available limit:
  // credit_limit - unpaid_financing_holds (excluding optional excludePlanId) + account_balance
  const getCreditCardAvailableLimit = useCallback(
    (card: Account, excludePlanId?: string | null): number => {
      const limit = Number(card.credit_limit || 0);
      const unpaidHolds = plans.reduce((sum, p) => {
        if (
          !p.is_active ||
          p.status !== "active" ||
          p.account_id !== card.account_id ||
          (excludePlanId && p.financing_id === excludePlanId)
        ) {
          return sum;
        }
        const stats = getPlanStats(p);
        if (stats.isFullySettled) return sum;
        return round2(sum + stats.remaining);
      }, 0);
      return Math.max(0, round2(limit - unpaidHolds + card.account_balance));
    },
    [plans, getPlanStats]
  );

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const stats = getPlanStats(p);
      if (statusFilter === "active" && stats.isFullySettled) return false;
      if (statusFilter === "settled" && !stats.isFullySettled) return false;
      if (categoryFilter !== "all" && p.financing_category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = p.financing_name.toLowerCase().includes(q);
        const matchProvider = p.financing_provider.toLowerCase().includes(q);
        const matchCategory = p.financing_category.toLowerCase().includes(q);
        const matchNotes = (p.financing_notes || "").toLowerCase().includes(q);
        if (!matchName && !matchProvider && !matchCategory && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [plans, getPlanStats, statusFilter, categoryFilter, searchQuery]);

  // Open Create Plan Modal
  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormName("");
    setFormProviderSelect("Maybank");
    setFormCustomProvider("");
    setFormCategory("Car");
    setFormTotalInput("");
    setFormDurationInput("12");
    setFormMonthlyInput("");
    setFormIsFlexibleDuration(false);
    setFormStartDate(getTodayDateString());
    setFormRealignDates(true);
    setFormSyncCommitments(false);
    const defaultCC = creditCardAccounts[0] || null;
    setFormLinkCreditCard(Boolean(defaultCC));
    setFormCreditCardId(defaultCC ? defaultCC.account_id : "");
    setFormNotes("");
    setPlanModalError(null);
    setPlanModalOpen(true);
  };

  // Open Edit Plan Modal
  const handleOpenEditModal = (plan: FinancingPlan, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPlan(plan);
    setFormName(plan.financing_name);
    if (PROVIDER_SUGGESTIONS.includes(plan.financing_provider)) {
      setFormProviderSelect(plan.financing_provider);
      setFormCustomProvider("");
    } else {
      setFormProviderSelect("Other");
      setFormCustomProvider(plan.financing_provider);
    }
    setFormCategory(
      FINANCING_CATEGORIES.includes(plan.financing_category)
        ? plan.financing_category
        : "Other"
    );
    setFormTotalInput(plan.total_amount.toFixed(2));
    if (plan.duration_months === null) {
      setFormIsFlexibleDuration(true);
      setFormDurationInput("");
      setFormMonthlyInput("");
    } else {
      setFormIsFlexibleDuration(false);
      setFormDurationInput(String(plan.duration_months));
      const firstInst = plan.installments[0];
      const monthlyVal =
        firstInst && firstInst.amount_due > 0
          ? firstInst.amount_due
          : plan.duration_months > 0
            ? round2(plan.total_amount / plan.duration_months)
            : 0;
      setFormMonthlyInput(monthlyVal > 0 ? monthlyVal.toFixed(2) : "");
    }
    setFormStartDate(plan.start_date);
    setFormRealignDates(true);
    setFormSyncCommitments(plan.sync_to_commitments);
    const defaultCC = creditCardAccounts[0] || null;
    setFormLinkCreditCard(Boolean(plan.account_id));
    setFormCreditCardId(
      plan.account_id || (defaultCC ? defaultCC.account_id : "")
    );
    setFormNotes(plan.financing_notes || "");
    setPlanModalError(null);
    setPlanModalOpen(true);
  };

  // Bi-directional calculations for Plan modal inputs (with cents auto-formatting)
  const handleMonthlyInputChange = (rawVal: string) => {
    const cleaned = formatCentsInput(rawVal);
    setFormMonthlyInput(cleaned);
    const monthly = parseFloat(cleaned);
    const duration = parseInt(formDurationInput, 10);
    if (!isNaN(monthly) && monthly > 0 && !isNaN(duration) && duration > 0) {
      setFormTotalInput(round2(monthly * duration).toFixed(2));
    }
  };

  const handleTotalInputChange = (rawVal: string) => {
    const cleaned = formatCentsInput(rawVal);
    setFormTotalInput(cleaned);
    const total = parseFloat(cleaned);
    const duration = parseInt(formDurationInput, 10);
    if (!isNaN(total) && total > 0 && !isNaN(duration) && duration > 0) {
      setFormMonthlyInput((total / duration).toFixed(2));
    } else if (!cleaned) {
      setFormMonthlyInput("");
    }
  };

  const handleDurationInputChange = (val: string) => {
    setFormDurationInput(val);
    const duration = parseInt(val, 10);
    const total = parseFloat(formTotalInput);
    const monthly = parseFloat(formMonthlyInput);

    if (!isNaN(duration) && duration > 0) {
      if (!isNaN(total) && total > 0) {
        setFormMonthlyInput((total / duration).toFixed(2));
      } else if (!isNaN(monthly) && monthly > 0) {
        setFormTotalInput(round2(monthly * duration).toFixed(2));
      }
    } else {
      setFormMonthlyInput("");
    }
  };

  // Save (Create or Edit) Financing Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanModalError(null);

    if (!userId) return;
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setPlanModalError("Please enter a plan name.");
      return;
    }

    const finalProvider =
      formProviderSelect === "Other"
        ? formCustomProvider.trim() || "Other"
        : formProviderSelect;

    const totalAmount = round2(parseFloat(formTotalInput || "0"));
    if (isNaN(totalAmount) || totalAmount < 0) {
      setPlanModalError("Please enter a valid total amount.");
      return;
    }

    let durationMonths: number | null = null;
    if (!formIsFlexibleDuration && formDurationInput.trim() !== "") {
      const parsedDuration = parseInt(formDurationInput, 10);
      if (isNaN(parsedDuration) || parsedDuration <= 0 || parsedDuration > 600) {
        setPlanModalError(
          "Please enter a valid duration in months (1–600), or tick Flexible duration."
        );
        return;
      }
      durationMonths = parsedDuration;
    }

    if (durationMonths !== null && totalAmount <= 0) {
      setPlanModalError(
        "Please enter a total amount greater than RM 0.00 for a fixed-duration plan."
      );
      return;
    }

    if (!formStartDate) {
      setPlanModalError("Please select a start date.");
      return;
    }

    // Credit Card link validation
    let linkedCardId: string | null = null;
    if (formCategory === "Credit Card" && formLinkCreditCard) {
      if (!formCreditCardId) {
        setPlanModalError(
          "Please select a Credit Card account to link, or untick the link option."
        );
        return;
      }
      const chosenCard = creditCardAccounts.find(
        (c) => c.account_id === formCreditCardId
      );
      if (!chosenCard) {
        setPlanModalError("Selected Credit Card account was not found.");
        return;
      }
      const paidAlready = editingPlan
        ? round2(
            editingPlan.installments
              .filter((i) => i.status === "paid")
              .reduce((sum, i) => sum + i.amount_paid, 0)
          )
        : 0;
      const unpaidPortion = Math.max(0, round2(totalAmount - paidAlready));
      const availableLimit = getCreditCardAvailableLimit(
        chosenCard,
        editingPlan ? editingPlan.financing_id : null
      );
      if (unpaidPortion > availableLimit) {
        setPlanModalError(
          `Remaining installment balance (RM ${formatAmount(
            unpaidPortion
          )}) exceeds ${chosenCard.account_name}'s available credit limit (RM ${formatAmount(
            availableLimit
          )}).`
        );
        return;
      }
      linkedCardId = chosenCard.account_id;
    }

    setSavingPlan(true);
    try {
      if (!editingPlan) {
        // CREATE NEW PLAN
        const { data: insertedPlan, error: insertErr } = await supabase
          .from("financing")
          .insert({
            user_id: userId,
            financing_name: trimmedName,
            financing_provider: finalProvider,
            financing_category: formCategory,
            total_amount: totalAmount,
            duration_months: durationMonths,
            start_date: formStartDate,
            sync_to_commitments: formSyncCommitments,
            status: "active",
            financing_notes: formNotes.trim() || null,
            account_id: linkedCardId,
          })
          .select("*")
          .single();

        if (insertErr) throw insertErr;

        // Generate monthly installment rows if duration_months is provided
        if (durationMonths && durationMonths > 0 && insertedPlan) {
          const customMonthly = parseFloat(formMonthlyInput || "0");
          const hasCustomMonthly = !isNaN(customMonthly) && customMonthly > 0;
          const baseMonthly = hasCustomMonthly
            ? round2(customMonthly)
            : Math.floor((totalAmount / durationMonths) * 100) / 100;
          const rowsToInsert = [];

          for (let i = 1; i <= durationMonths; i++) {
            const isLast = i === durationMonths;
            const expectedTotal = round2(baseMonthly * durationMonths);
            const amountDue =
              isLast && Math.abs(expectedTotal - totalAmount) > 0.001
                ? round2(totalAmount - round2(baseMonthly * (durationMonths - 1)))
                : baseMonthly;
            const dueDate = addMonthsToDateString(formStartDate, i - 1);

            rowsToInsert.push({
              financing_id: insertedPlan.financing_id,
              user_id: userId,
              installment_number: i,
              due_date: dueDate,
              amount_due: amountDue,
              amount_paid: 0.0,
              status: "pending",
              installment_notes: null,
            });
          }

          if (rowsToInsert.length > 0) {
            const { error: instErr } = await supabase
              .from("financing_installments")
              .insert(rowsToInsert);
            if (instErr) throw instErr;
          }
        }

        setPlanModalOpen(false);
        await fetchData();
        showToast(`Financing plan "${trimmedName}" created.`);
      } else {
        // UPDATE EXISTING PLAN
        const paidSoFar = round2(
          editingPlan.installments
            .filter((i) => i.status === "paid")
            .reduce((sum, i) => sum + i.amount_paid, 0)
        );
        const pendingCount = editingPlan.installments.filter(
          (i) => i.status === "pending"
        ).length;
        const newStatus: FinancingStatus =
          totalAmount > 0 && paidSoFar >= totalAmount && pendingCount === 0
            ? "settled"
            : "active";

        const { error: updateErr } = await supabase
          .from("financing")
          .update({
            financing_name: trimmedName,
            financing_provider: finalProvider,
            financing_category: formCategory,
            total_amount: totalAmount,
            duration_months: durationMonths,
            start_date: formStartDate,
            sync_to_commitments: formSyncCommitments,
            status: newStatus,
            financing_notes: formNotes.trim() || null,
            account_id: linkedCardId,
          })
          .eq("financing_id", editingPlan.financing_id)
          .eq("user_id", userId);

        if (updateErr) throw updateErr;

        // If the start date changed and realignment is checked, update installment due dates
        if (
          formStartDate !== editingPlan.start_date &&
          formRealignDates &&
          editingPlan.installments.length > 0
        ) {
          const hasPaid = editingPlan.installments.some((i) => i.status === "paid");
          if (!hasPaid) {
            const updatePromises = editingPlan.installments.map((inst, idx) => {
              const newDueDate = addMonthsToDateString(formStartDate, idx);
              return supabase
                .from("financing_installments")
                .update({ due_date: newDueDate })
                .eq("installment_id", inst.installment_id)
                .eq("user_id", userId);
            });
            await Promise.all(updatePromises);
          } else {
            const pendingInsts = editingPlan.installments.filter(
              (i) => i.status === "pending"
            );
            if (pendingInsts.length > 0) {
              const updatePromises = pendingInsts.map((inst) => {
                const newDueDate = addMonthsToDateString(
                  formStartDate,
                  inst.installment_number - 1
                );
                return supabase
                  .from("financing_installments")
                  .update({ due_date: newDueDate })
                  .eq("installment_id", inst.installment_id)
                  .eq("user_id", userId);
              });
              await Promise.all(updatePromises);
            }
          }
        }

        // If the plan previously had 0 installments and the user just added a fixed duration, generate them
        if (
          editingPlan.installments.length === 0 &&
          durationMonths &&
          durationMonths > 0 &&
          totalAmount > 0
        ) {
          const customMonthly = parseFloat(formMonthlyInput || "0");
          const hasCustomMonthly = !isNaN(customMonthly) && customMonthly > 0;
          const baseMonthly = hasCustomMonthly
            ? round2(customMonthly)
            : Math.floor((totalAmount / durationMonths) * 100) / 100;
          const rowsToInsert = [];
          for (let i = 1; i <= durationMonths; i++) {
            const isLast = i === durationMonths;
            const expectedTotal = round2(baseMonthly * durationMonths);
            const amountDue =
              isLast && Math.abs(expectedTotal - totalAmount) > 0.001
                ? round2(totalAmount - round2(baseMonthly * (durationMonths - 1)))
                : baseMonthly;
            const dueDate = addMonthsToDateString(formStartDate, i - 1);
            rowsToInsert.push({
              financing_id: editingPlan.financing_id,
              user_id: userId,
              installment_number: i,
              due_date: dueDate,
              amount_due: amountDue,
              amount_paid: 0.0,
              status: "pending",
            });
          }
          const { error: instErr } = await supabase
            .from("financing_installments")
            .insert(rowsToInsert);
          if (instErr) throw instErr;
        }

        setPlanModalOpen(false);
        await fetchData();
        showToast(`Financing plan "${trimmedName}" updated.`);
      }
    } catch (err: unknown) {
      setPlanModalError(
        getErrorMessage(err, "Failed to save financing plan.")
      );
    } finally {
      setSavingPlan(false);
    }
  };

  // Quick toggle Sync to Commitments inside Detail Modal
  const handleToggleSyncCommitments = async (plan: FinancingPlan) => {
    if (!userId) return;
    setTogglingSyncPlanId(plan.financing_id);
    const nextValue = !plan.sync_to_commitments;
    try {
      const { error } = await supabase
        .from("financing")
        .update({ sync_to_commitments: nextValue })
        .eq("financing_id", plan.financing_id)
        .eq("user_id", userId);
      if (error) throw error;

      await fetchData();
      showToast(
        nextValue
          ? `"${plan.financing_name}" linked to Commitments page.`
          : `"${plan.financing_name}" unlinked from Commitments page.`
      );
    } catch (err: unknown) {
      showToast(
        getErrorMessage(err, "Failed to update Commitments link."),
        "danger"
      );
    } finally {
      setTogglingSyncPlanId(null);
    }
  };

  // Open Edit Installment inside Detail Modal (opens the stacked sub-modal)
  const handleOpenEditInstallment = (inst: FinancingInstallment) => {
    setEditingInstallment(inst);
    setEditInstDueDate(inst.due_date);
    setEditInstAmountInput(inst.amount_due.toFixed(2));
    setEditInstNotes(inst.installment_notes || "");
    setEditInstSyncTotal(true);
    setEditInstApplyToFuture(false);
    setEditInstSyncDayToFuture(false);
    setEditInstSyncStartDate(inst.installment_number === 1);
    setEditInstError(null);
  };

  // Save Edited Installment (Due Date / Amount Due / Notes with bulk update support)
  const handleSaveInstallmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !editingInstallment || !selectedPlan) return;
    setEditInstError(null);

    if (!editInstDueDate) {
      setEditInstError("Please select a due date (DD-MM-YYYY).");
      return;
    }

    const newAmountDue = round2(parseFloat(editInstAmountInput || "0"));
    if (isNaN(newAmountDue) || newAmountDue < 0) {
      setEditInstError("Please enter a valid amount due.");
      return;
    }

    const targetParts = editInstDueDate.slice(0, 10).split("-").map(Number);
    const targetDay = targetParts.length === 3 ? targetParts[2] : null;

    if (selectedPlan.account_id) {
      const linkedCard = creditCardAccounts.find(
        (c) => c.account_id === selectedPlan.account_id
      );
      if (linkedCard) {
        const paidSum = round2(
          selectedPlan.installments
            .filter((i) => i.status === "paid")
            .reduce((sum, i) => sum + i.amount_paid, 0)
        );
        const newPendingSum = round2(
          selectedPlan.installments
            .filter((i) => i.status === "pending")
            .reduce((sum, i) => {
              if (i.installment_id === editingInstallment.installment_id) {
                return sum + newAmountDue;
              }
              if (
                editInstApplyToFuture &&
                i.installment_number > editingInstallment.installment_number
              ) {
                return sum + newAmountDue;
              }
              return sum + i.amount_due;
            }, 0)
        );
        const projectedTotal = editInstSyncTotal
          ? round2(paidSum + newPendingSum)
          : selectedPlan.total_amount;
        const projectedUnpaidHold = Math.max(
          round2(Math.max(0, projectedTotal - paidSum)),
          newPendingSum
        );
        const availLimit = getCreditCardAvailableLimit(
          linkedCard,
          selectedPlan.financing_id
        );
        if (projectedUnpaidHold > availLimit + 0.001) {
          setEditInstError(
            `Updated unpaid installment balance (RM ${formatAmount(
              projectedUnpaidHold
            )}) exceeds ${linkedCard.account_name}'s available credit limit (RM ${formatAmount(
              availLimit
            )}).`
          );
          return;
        }
      }
    }

    setSavingInstallmentEdit(true);
    try {
      // 1. Update this specific installment
      const { error: updErr } = await supabase
        .from("financing_installments")
        .update({
          due_date: editInstDueDate,
          amount_due: newAmountDue,
          installment_notes: editInstNotes.trim() || null,
        })
        .eq("installment_id", editingInstallment.installment_id)
        .eq("user_id", userId);

      if (updErr) throw updErr;

      // 2. Future pending installments
      const futurePending = selectedPlan.installments.filter(
        (i) =>
          i.installment_number > editingInstallment.installment_number &&
          i.status === "pending"
      );

      // Apply amount to all future pending installments
      if (editInstApplyToFuture && futurePending.length > 0) {
        const ids = futurePending.map((i) => i.installment_id);
        const { error: batchAmtErr } = await supabase
          .from("financing_installments")
          .update({ amount_due: newAmountDue })
          .in("installment_id", ids)
          .eq("user_id", userId);
        if (batchAmtErr) throw batchAmtErr;
      }

      // Shift future pending due dates to match this payment day
      if (
        editInstSyncDayToFuture &&
        targetDay !== null &&
        futurePending.length > 0
      ) {
        const dateUpdates = futurePending.map((inst) => {
          const newDueDate = setDayOfDateString(inst.due_date, targetDay);
          return supabase
            .from("financing_installments")
            .update({ due_date: newDueDate })
            .eq("installment_id", inst.installment_id)
            .eq("user_id", userId);
        });
        await Promise.all(dateUpdates);
      }

      // 3. If editing Month #1 and sync start date requested, update parent plan start_date
      if (
        editingInstallment.installment_number === 1 &&
        editInstSyncStartDate
      ) {
        await supabase
          .from("financing")
          .update({ start_date: editInstDueDate })
          .eq("financing_id", selectedPlan.financing_id)
          .eq("user_id", userId);
      }

      // 4. Optionally recalculate parent plan's total_amount from sum of all installments
      if (editInstSyncTotal) {
        const updatedSum = round2(
          selectedPlan.installments.reduce((sum, i) => {
            if (i.installment_id === editingInstallment.installment_id) {
              return sum + newAmountDue;
            }
            if (
              editInstApplyToFuture &&
              i.installment_number > editingInstallment.installment_number &&
              i.status === "pending"
            ) {
              return sum + newAmountDue;
            }
            return sum + (i.status === "paid" ? i.amount_paid : i.amount_due);
          }, 0)
        );
        await supabase
          .from("financing")
          .update({ total_amount: updatedSum })
          .eq("financing_id", selectedPlan.financing_id)
          .eq("user_id", userId);
      }

      setEditingInstallment(null);
      await fetchData();
      showToast(
        editInstApplyToFuture
          ? `Month #${editingInstallment.installment_number} and all ${futurePending.length} future pending months updated.`
          : `Month #${editingInstallment.installment_number} updated (${formatDisplayDate(
            editInstDueDate
          )} · RM ${formatAmount(newAmountDue)}).`
      );
    } catch (err: unknown) {
      setEditInstError(
        getErrorMessage(err, "Failed to update installment details.")
      );
    } finally {
      setSavingInstallmentEdit(false);
    }
  };

  // Realign entire schedule starting from the plan's start date
  const handleRealignEntireSchedule = async () => {
    if (!userId || !selectedPlan) return;
    const planStart = selectedPlan.start_date;
    if (!planStart) {
      showToast("Financing plan does not have a valid start date.", "danger");
      return;
    }
    setRealigningSchedule(true);
    try {
      const hasPaid = selectedPlan.installments.some((i) => i.status === "paid");
      const targetInsts = hasPaid
        ? selectedPlan.installments.filter((i) => i.status === "pending")
        : selectedPlan.installments;

      if (targetInsts.length === 0) {
        showToast(
          "All installments are already paid; no pending dates to realign.",
          "info"
        );
        return;
      }

      const promises = targetInsts.map((inst) => {
        const newDueDate = addMonthsToDateString(
          planStart,
          inst.installment_number - 1
        );
        return supabase
          .from("financing_installments")
          .update({ due_date: newDueDate })
          .eq("installment_id", inst.installment_id)
          .eq("user_id", userId);
      });

      await Promise.all(promises);
      await fetchData();
      showToast(
        `Installment schedule dates realigned starting from ${formatDisplayDate(
          planStart
        )}.`
      );
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Failed to realign schedule."), "danger");
    } finally {
      setRealigningSchedule(false);
    }
  };

  // Open Add Month / Bill Modal inside Detail Modal
  const handleOpenAddMonthModal = () => {
    if (!selectedPlan) return;
    const lastInst =
      selectedPlan.installments[selectedPlan.installments.length - 1];
    const nextDate = lastInst
      ? addMonthsToDateString(lastInst.due_date, 1)
      : getTodayDateString();
    const defaultAmt =
      lastInst && lastInst.amount_due > 0
        ? lastInst.amount_due.toFixed(2)
        : "";
    setNewMonthDueDate(nextDate);
    setNewMonthAmountInput(defaultAmt);
    setNewMonthNotes("");
    setNewMonthAddToTotal(true);
    setAddMonthError(null);
    setAddMonthModalOpen(true);
  };

  // Save New Month / Bill
  const handleSaveNewMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !selectedPlan) return;
    setAddMonthError(null);

    if (!newMonthDueDate) {
      setAddMonthError("Please select a due date (DD-MM-YYYY).");
      return;
    }

    const amtDue = round2(parseFloat(newMonthAmountInput || "0"));
    if (isNaN(amtDue) || amtDue <= 0) {
      setAddMonthError("Please enter an amount greater than RM 0.00.");
      return;
    }

    if (selectedPlan.account_id) {
      const linkedCard = creditCardAccounts.find(
        (c) => c.account_id === selectedPlan.account_id
      );
      if (linkedCard) {
        const paidSum = round2(
          selectedPlan.installments
            .filter((i) => i.status === "paid")
            .reduce((sum, i) => sum + i.amount_paid, 0)
        );
        const currentPendingSum = round2(
          selectedPlan.installments
            .filter((i) => i.status === "pending")
            .reduce((sum, i) => sum + i.amount_due, 0)
        );
        const newPendingSum = round2(currentPendingSum + amtDue);
        const projectedTotal = newMonthAddToTotal
          ? round2(selectedPlan.total_amount + amtDue)
          : selectedPlan.total_amount;
        const projectedUnpaidHold = Math.max(
          round2(Math.max(0, projectedTotal - paidSum)),
          newPendingSum
        );
        const availLimit = getCreditCardAvailableLimit(
          linkedCard,
          selectedPlan.financing_id
        );
        if (projectedUnpaidHold > availLimit + 0.001) {
          setAddMonthError(
            `Adding RM ${formatAmount(
              amtDue
            )} brings the unpaid installment balance to RM ${formatAmount(
              projectedUnpaidHold
            )}, which exceeds ${linkedCard.account_name}'s available credit limit (RM ${formatAmount(
              availLimit
            )}).`
          );
          return;
        }
      }
    }

    setSavingNewMonth(true);
    try {
      const nextNum =
        selectedPlan.installments.length > 0
          ? Math.max(
            ...selectedPlan.installments.map((i) => i.installment_number)
          ) + 1
          : 1;

      const { error: insErr } = await supabase
        .from("financing_installments")
        .insert({
          financing_id: selectedPlan.financing_id,
          user_id: userId,
          installment_number: nextNum,
          due_date: newMonthDueDate,
          amount_due: amtDue,
          amount_paid: 0.0,
          status: "pending",
          installment_notes: newMonthNotes.trim() || null,
        });

      if (insErr) throw insErr;

      // Update parent plan total_amount and duration_months if requested
      const updatedTotal = newMonthAddToTotal
        ? round2(selectedPlan.total_amount + amtDue)
        : selectedPlan.total_amount;
      const updatedDuration =
        selectedPlan.duration_months !== null
          ? selectedPlan.installments.length + 1
          : null;

      await supabase
        .from("financing")
        .update({
          total_amount: updatedTotal,
          duration_months: updatedDuration,
          status: "active",
        })
        .eq("financing_id", selectedPlan.financing_id)
        .eq("user_id", userId);

      setAddMonthModalOpen(false);
      await fetchData();
      showToast(
        `Added Month #${nextNum} (${formatDisplayDate(
          newMonthDueDate
        )} · RM ${formatAmount(amtDue)}).`
      );
    } catch (err: unknown) {
      setAddMonthError(
        getErrorMessage(err, "Failed to add monthly installment.")
      );
    } finally {
      setSavingNewMonth(false);
    }
  };

  // Delete an unpaid installment row
  const handleDeletePendingInstallment = async (inst: FinancingInstallment) => {
    if (!userId || !selectedPlan || inst.status === "paid") return;
    if (
      inst.installment_notes &&
      /\[Cascaded from #\d+: RM [0-9.]+\]/.test(inst.installment_notes)
    ) {
      showToast(
        `Month #${inst.installment_number} has a cascaded balance reduction. Revert the source installment payment first before deleting this row.`,
        "danger"
      );
      return;
    }
    try {
      const { error } = await supabase
        .from("financing_installments")
        .update({ is_active: false })
        .eq("installment_id", inst.installment_id)
        .eq("user_id", userId);

      if (error) throw error;

      // Recalculate total cleanly from remaining active installments
      const remaining = selectedPlan.installments.filter(
        (i) => i.installment_id !== inst.installment_id
      );
      const paidSum = round2(
        remaining
          .filter((i) => i.status === "paid")
          .reduce((s, i) => s + i.amount_paid, 0)
      );
      const pendingSum = round2(
        remaining
          .filter((i) => i.status === "pending")
          .reduce((s, i) => s + i.amount_due, 0)
      );
      const newTotal = round2(paidSum + pendingSum);
      const newDuration =
        selectedPlan.duration_months !== null ? remaining.length : null;
      const hasPaid = remaining.some((i) => i.status === "paid");
      const hasPending = remaining.some((i) => i.status === "pending");
      const newStatus =
        hasPaid && !hasPending && newTotal > 0
          ? "settled"
          : selectedPlan.status;

      await supabase
        .from("financing")
        .update({
          total_amount: newTotal,
          duration_months: newDuration,
          status: newStatus,
        })
        .eq("financing_id", selectedPlan.financing_id)
        .eq("user_id", userId);

      await fetchData();
      showToast(`Removed Month #${inst.installment_number} from schedule.`);
    } catch (err: unknown) {
      showToast(
        getErrorMessage(err, "Failed to remove installment."),
        "danger"
      );
    }
  };

  // Open Mark Paid Confirmation Modal
  const handleOpenPayModal = (inst: FinancingInstallment) => {
    setPayingInstallment(inst);
    setPayDate(getTodayDateString());
    setPayAmountInput(inst.amount_due.toFixed(2));
    setPayNotes(inst.installment_notes || "");
    const defaultAccount = nonCreditAccounts[0] || null;
    setPayReflectAccount(Boolean(defaultAccount));
    setPayAccountId(defaultAccount ? defaultAccount.account_id : "");
    setPaySubAccountId("");
    setPayModalError(null);
  };

  const selectedPayAccount = useMemo(
    () =>
      nonCreditAccounts.find((a) => a.account_id === payAccountId) || null,
    [nonCreditAccounts, payAccountId]
  );

  // Confirm Mark Installment Paid (with Account & Transaction sync + Overpayment Cascading)
  const handleConfirmPayInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !payingInstallment || !selectedPlan) return;
    setPayModalError(null);

    const amountToPay = round2(parseFloat(payAmountInput || "0"));
    if (isNaN(amountToPay) || amountToPay <= 0) {
      setPayModalError(
        "Please enter a valid payment amount greater than RM 0.00."
      );
      return;
    }

    if (!payDate) {
      setPayModalError("Please select a payment date (DD-MM-YYYY).");
      return;
    }

    const alreadyPaidSum = round2(
      selectedPlan.installments
        .filter(
          (i) =>
            i.installment_id !== payingInstallment.installment_id &&
            i.status === "paid"
        )
        .reduce((sum, i) => sum + i.amount_paid, 0)
    );
    const pendingRemainingSum = round2(
      selectedPlan.installments
        .filter((i) => i.status === "pending")
        .reduce((sum, i) => sum + i.amount_due, 0)
    );
    const maxPayableForPlan = Math.max(
      payingInstallment.amount_due,
      round2(Math.max(0, selectedPlan.total_amount - alreadyPaidSum)),
      pendingRemainingSum
    );
    if (maxPayableForPlan > 0 && amountToPay > maxPayableForPlan + 0.001) {
      setPayModalError(
        `Payment amount (RM ${formatAmount(
          amountToPay
        )}) cannot exceed the total remaining balance of this financing plan (RM ${formatAmount(
          maxPayableForPlan
        )}). Note: Daily credit card swipes are paid separately via "+ Pay card" on the Accounts page.`
      );
      return;
    }

    let chosenAccount: Account | null = null;
    let chosenSub: SubAccount | null = null;

    if (payReflectAccount) {
      chosenAccount =
        nonCreditAccounts.find((a) => a.account_id === payAccountId) || null;
      if (!chosenAccount) {
        setPayModalError(
          "Please select a cash/bank account to deduct this payment from."
        );
        return;
      }
      if (paySubAccountId) {
        chosenSub =
          chosenAccount.subaccounts.find(
            (s) => s.subaccount_id === paySubAccountId
          ) || null;
      }
      const available = getAvailableBalance(chosenAccount, paySubAccountId);
      if (amountToPay > available) {
        setPayModalError(
          `Insufficient balance in ${
            chosenSub
              ? `${chosenAccount.account_name} (${chosenSub.subaccount_name})`
              : chosenAccount.account_name
          }. Available: RM ${formatAmount(available)}.`
        );
        return;
      }
    }

    setPayingLoading(true);
    try {
      let createdTransactionId: string | null = null;

      if (payReflectAccount && chosenAccount) {
        const newAccBalance = round2(chosenAccount.account_balance - amountToPay);
        const { error: accErr } = await supabase
          .from("accounts")
          .update({ account_balance: newAccBalance })
          .eq("account_id", chosenAccount.account_id)
          .eq("user_id", userId);
        if (accErr) throw accErr;

        if (chosenSub) {
          const newSubBalance = round2(chosenSub.subaccount_value - amountToPay);
          const { error: subErr } = await supabase
            .from("subaccounts")
            .update({ subaccount_value: newSubBalance })
            .eq("subaccount_id", chosenSub.subaccount_id)
            .eq("user_id", userId);
          if (subErr) throw subErr;
        }

        const txDescription = `${selectedPlan.financing_name} (${selectedPlan.financing_provider}) — Installment #${payingInstallment.installment_number}`;
        const { data: txRow, error: txErr } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: chosenAccount.account_id,
            subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
            transaction_type: "expense",
            amount: amountToPay,
            description: txDescription,
            expense_category: FINANCING_EXPENSE_CATEGORY,
            income_category: null,
            transaction_date: payDate,
            transaction_time: getCurrentTimeString(),
            is_active: true,
          })
          .select("transaction_id")
          .single();

        if (txErr) throw txErr;
        createdTransactionId = txRow?.transaction_id || null;
      }

      // 1. Update the target installment row
      const { error: instErr } = await supabase
        .from("financing_installments")
        .update({
          status: "paid",
          amount_paid: amountToPay,
          paid_at: payDate,
          installment_notes: payNotes.trim() || null,
          account_id: chosenAccount ? chosenAccount.account_id : null,
          subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
          transaction_id: createdTransactionId,
        })
        .eq("installment_id", payingInstallment.installment_id)
        .eq("user_id", userId);

      if (instErr) throw instErr;

      // 2. Calculate total paid after this payment & cascade any excess forward
      const totalPaidAfter = round2(alreadyPaidSum + amountToPay);
      const isPlan100PctPaid =
        selectedPlan.total_amount > 0 &&
        totalPaidAfter >= round2(selectedPlan.total_amount - 0.001);

      const sortedOtherPending = [
        ...selectedPlan.installments
          .filter(
            (i) =>
              i.installment_id !== payingInstallment.installment_id &&
              i.status === "pending" &&
              i.installment_number > payingInstallment.installment_number
          )
          .sort((a, b) => a.installment_number - b.installment_number),
        ...selectedPlan.installments
          .filter(
            (i) =>
              i.installment_id !== payingInstallment.installment_id &&
              i.status === "pending" &&
              i.installment_number <= payingInstallment.installment_number
          )
          .sort((a, b) => a.installment_number - b.installment_number),
      ];

      let remainingExcess = round2(
        Math.max(0, amountToPay - payingInstallment.amount_due)
      );
      let stillPendingCount = sortedOtherPending.length;
      let cascadedSettledCount = 0;

      for (const nextInst of sortedOtherPending) {
        if (isPlan100PctPaid || remainingExcess >= nextInst.amount_due - 0.001) {
          const coveredAmt = round2(nextInst.amount_due);
          remainingExcess = round2(Math.max(0, remainingExcess - coveredAmt));
          const tag = `Settled early via Installment #${payingInstallment.installment_number} [Cascaded from #${payingInstallment.installment_number}: RM ${coveredAmt.toFixed(2)}]`;
          const updatedNote = nextInst.installment_notes
            ? `${nextInst.installment_notes} | ${tag}`
            : tag;

          const { error: cascadeErr } = await supabase
            .from("financing_installments")
            .update({
              status: "paid",
              amount_due: 0.0,
              amount_paid: 0.0,
              paid_at: payDate,
              installment_notes: updatedNote,
            })
            .eq("installment_id", nextInst.installment_id)
            .eq("user_id", userId);
          if (cascadeErr) throw cascadeErr;

          stillPendingCount -= 1;
          cascadedSettledCount += 1;
        } else if (remainingExcess > 0.001) {
          const reducedBy = remainingExcess;
          const newDue = round2(Math.max(0, nextInst.amount_due - reducedBy));
          remainingExcess = 0;
          const tag = `Reduced by RM ${formatAmount(reducedBy)} from Installment #${payingInstallment.installment_number} [Cascaded from #${payingInstallment.installment_number}: RM ${reducedBy.toFixed(2)}]`;
          const updatedNote = nextInst.installment_notes
            ? `${nextInst.installment_notes} | ${tag}`
            : tag;

          const { error: partialErr } = await supabase
            .from("financing_installments")
            .update({
              amount_due: newDue,
              installment_notes: updatedNote,
            })
            .eq("installment_id", nextInst.installment_id)
            .eq("user_id", userId);
          if (partialErr) throw partialErr;
        }
      }

      const newPlanTotal = Math.max(selectedPlan.total_amount, totalPaidAfter);
      const shouldSettlePlan =
        (stillPendingCount === 0 || isPlan100PctPaid) &&
        newPlanTotal > 0 &&
        totalPaidAfter >= round2(newPlanTotal - 0.001);

      await supabase
        .from("financing")
        .update({
          total_amount: newPlanTotal,
          status: shouldSettlePlan ? "settled" : "active",
        })
        .eq("financing_id", selectedPlan.financing_id)
        .eq("user_id", userId);

      setPayingInstallment(null);
      await fetchData();
      showToast(
        shouldSettlePlan
          ? `Installment #${payingInstallment.installment_number} paid! "${selectedPlan.financing_name}" is now 100% settled.`
          : cascadedSettledCount > 0
            ? `Installment #${payingInstallment.installment_number} paid (RM ${formatAmount(
                amountToPay
              )}) · ${cascadedSettledCount} future ${
                cascadedSettledCount === 1 ? "month" : "months"
              } settled early!`
            : `Installment #${payingInstallment.installment_number} marked as paid (RM ${formatAmount(
                amountToPay
              )}).`
      );
    } catch (err: unknown) {
      setPayModalError(
        getErrorMessage(err, "Failed to record installment payment.")
      );
    } finally {
      setPayingLoading(false);
    }
  };

  // Confirm Unpay (Revert Paid Installment back to Pending + reverse any cascaded reductions)
  const handleConfirmUnpayInstallment = async () => {
    if (!userId || !unpayingInstallment || !selectedPlan) return;
    setUnpayError(null);

    if (selectedPlan.account_id && unpayingInstallment.amount_paid > 0) {
      const linkedCard = creditCardAccounts.find(
        (c) => c.account_id === selectedPlan.account_id
      );
      if (linkedCard) {
        const remainingCardLimit = getCreditCardAvailableLimit(
          linkedCard,
          null
        );
        if (unpayingInstallment.amount_paid > remainingCardLimit + 0.001) {
          setUnpayError(
            `Cannot revert this installment to pending because restoring RM ${formatAmount(
              unpayingInstallment.amount_paid
            )} to the financing hold would exceed ${
              linkedCard.account_name
            }'s remaining available credit limit (RM ${formatAmount(
              remainingCardLimit
            )}). Pay down the card's swipe balance first.`
          );
          return;
        }
      }
    }

    setUnpayingLoading(true);

    try {
      // If linked to an account & transaction, refund the account and cancel the transaction
      if (unpayingInstallment.account_id && unpayingInstallment.amount_paid > 0) {
        const linkedAcc = accounts.find(
          (a) => a.account_id === unpayingInstallment.account_id
        );
        if (linkedAcc) {
          const refundedAccBalance = round2(
            linkedAcc.account_balance + unpayingInstallment.amount_paid
          );
          await supabase
            .from("accounts")
            .update({ account_balance: refundedAccBalance })
            .eq("account_id", linkedAcc.account_id)
            .eq("user_id", userId);

          if (unpayingInstallment.subaccount_id) {
            const linkedSub = linkedAcc.subaccounts.find(
              (s) => s.subaccount_id === unpayingInstallment.subaccount_id
            );
            if (linkedSub) {
              const refundedSubBalance = round2(
                linkedSub.subaccount_value + unpayingInstallment.amount_paid
              );
              await supabase
                .from("subaccounts")
                .update({ subaccount_value: refundedSubBalance })
                .eq("subaccount_id", linkedSub.subaccount_id)
                .eq("user_id", userId);
            }
          }
        }
      }

      if (unpayingInstallment.transaction_id) {
        await supabase
          .from("transactions")
          .update({ is_active: false })
          .eq("transaction_id", unpayingInstallment.transaction_id)
          .eq("user_id", userId);
      }

      // Reverse any cascaded overpayment effects on other installments in this plan
      const cascadeTagRegex = new RegExp(
        `(?:\\s*\\|\\s*)?(?:Settled early via Installment #${unpayingInstallment.installment_number}\\s*|Reduced by RM [0-9,.]+ from Installment #${unpayingInstallment.installment_number}\\s*)?\\[Cascaded from #${unpayingInstallment.installment_number}: RM ([0-9.]+)\\]`
      );

      for (const otherInst of selectedPlan.installments) {
        if (
          otherInst.installment_id === unpayingInstallment.installment_id ||
          !otherInst.installment_notes
        ) {
          continue;
        }
        const match = otherInst.installment_notes.match(cascadeTagRegex);
        if (match) {
          const cascadedAmt = round2(parseFloat(match[1] || "0"));
          const restoredDue = round2(otherInst.amount_due + cascadedAmt);
          const cleanedNote =
            otherInst.installment_notes.replace(cascadeTagRegex, "").trim() ||
            null;
          const wasSettledByCascade =
            otherInst.status === "paid" && otherInst.amount_paid === 0;

          await supabase
            .from("financing_installments")
            .update({
              amount_due: restoredDue,
              status: wasSettledByCascade ? "pending" : otherInst.status,
              paid_at: wasSettledByCascade ? null : otherInst.paid_at,
              installment_notes: cleanedNote,
            })
            .eq("installment_id", otherInst.installment_id)
            .eq("user_id", userId);
        }
      }

      const { error: instErr } = await supabase
        .from("financing_installments")
        .update({
          status: "pending",
          amount_paid: 0.0,
          paid_at: null,
          account_id: null,
          subaccount_id: null,
          transaction_id: null,
        })
        .eq("installment_id", unpayingInstallment.installment_id)
        .eq("user_id", userId);

      if (instErr) throw instErr;

      await supabase
        .from("financing")
        .update({ status: "active" })
        .eq("financing_id", selectedPlan.financing_id)
        .eq("user_id", userId);

      setUnpayingInstallment(null);
      await fetchData();
      showToast(
        `Installment #${unpayingInstallment.installment_number} reverted to pending.`
      );
    } catch (err: unknown) {
      setUnpayError(
        getErrorMessage(err, "Failed to revert installment payment.")
      );
    } finally {
      setUnpayingLoading(false);
    }
  };

  // Delete Plan
  const handleConfirmDeletePlan = async () => {
    if (!userId || !deletingPlan) return;
    setDeleteError(null);
    setDeletingLoading(true);

    try {
      if (refundPaidOnDelete) {
        // Refund any paid installments that were linked to accounts and cancel their transactions
        const accountRefunds = new Map<string, number>();
        const subRefunds = new Map<string, number>();
        const txIdsToCancel: string[] = [];

        deletingPlan.installments.forEach((inst) => {
          if (inst.status === "paid" && inst.amount_paid > 0) {
            if (inst.account_id) {
              accountRefunds.set(
                inst.account_id,
                round2((accountRefunds.get(inst.account_id) || 0) + inst.amount_paid)
              );
            }
            if (inst.subaccount_id) {
              subRefunds.set(
                inst.subaccount_id,
                round2((subRefunds.get(inst.subaccount_id) || 0) + inst.amount_paid)
              );
            }
            if (inst.transaction_id) {
              txIdsToCancel.push(inst.transaction_id);
            }
          }
        });

        for (const [accId, refundAmt] of accountRefunds.entries()) {
          const acc = accounts.find((a) => a.account_id === accId);
          if (acc) {
            await supabase
              .from("accounts")
              .update({ account_balance: round2(acc.account_balance + refundAmt) })
              .eq("account_id", accId)
              .eq("user_id", userId);
          }
        }

        for (const [subId, refundAmt] of subRefunds.entries()) {
          for (const acc of accounts) {
            const sub = acc.subaccounts.find((s) => s.subaccount_id === subId);
            if (sub) {
              await supabase
                .from("subaccounts")
                .update({
                  subaccount_value: round2(sub.subaccount_value + refundAmt),
                })
                .eq("subaccount_id", subId)
                .eq("user_id", userId);
            }
          }
        }

        if (txIdsToCancel.length > 0) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .in("transaction_id", txIdsToCancel)
            .eq("user_id", userId);
        }
      }

      // Soft-delete installments and financing plan
      await supabase
        .from("financing_installments")
        .update({ is_active: false })
        .eq("financing_id", deletingPlan.financing_id)
        .eq("user_id", userId);

      const { error } = await supabase
        .from("financing")
        .update({ is_active: false })
        .eq("financing_id", deletingPlan.financing_id)
        .eq("user_id", userId);

      if (error) throw error;

      if (selectedPlanId === deletingPlan.financing_id) {
        setSelectedPlanId(null);
      }
      setDeletingPlan(null);
      await fetchData();
      showToast(`Financing plan "${deletingPlan.financing_name}" deleted.`);
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, "Failed to delete financing plan."));
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Financing</h1>
          <p className="page-subtitle mb-3">
            Loans, Buy Now Pay Later (BNPL), hire purchase and credit card installments
          </p>
        </div>
        <div className="pt-1">
          <AddButton onClick={handleOpenCreateModal}>New financing</AddButton>
        </div>
      </div>

      {/* 3-Column Summary Cards */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#6b7f72",
                  marginBottom: "6px",
                }}
              >
                Remaining balance (active)
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#1a2e23",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryStats.activeRemaining)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                {summaryStats.activeCount === 0
                  ? "No active financing plans"
                  : `Across ${summaryStats.activeCount} active ${summaryStats.activeCount === 1 ? "plan" : "plans"
                  }`}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor: "#edf4ef",
                color: "#3a6b4e",
              }}
            >
              <i
                className="bi bi-credit-card-2-front"
                style={{ fontSize: "1.1rem" }}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#6b7f72",
                  marginBottom: "6px",
                }}
              >
                Total paid so far
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#16a34a",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryStats.totalPaidAll)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                {summaryStats.overallPct}% repaid across all plans
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
                className="bi bi-check2-circle"
                style={{ fontSize: "1.15rem" }}
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-md-12 col-xl-4">
          <div
            className="h-100 d-flex justify-content-between align-items-center"
            style={{ ...panelStyle, padding: "22px 24px" }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#6b7f72",
                  marginBottom: "6px",
                }}
              >
                Due this month
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color:
                    summaryStats.overdueInstallmentsCount > 0
                      ? "#dc2626"
                      : "#1a2e23",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryStats.dueThisMonth)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color:
                    summaryStats.overdueInstallmentsCount > 0
                      ? "#dc2626"
                      : "#8b9d90",
                  fontWeight:
                    summaryStats.overdueInstallmentsCount > 0 ? 600 : 400,
                  marginTop: "6px",
                }}
              >
                {summaryStats.overdueInstallmentsCount > 0 ? (
                  <>
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    {summaryStats.overdueInstallmentsCount} overdue{" "}
                    {summaryStats.overdueInstallmentsCount === 1
                      ? "installment"
                      : "installments"}
                  </>
                ) : (
                  "Unpaid installments scheduled this month"
                )}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor:
                  summaryStats.overdueInstallmentsCount > 0
                    ? "#fef3c7"
                    : "#eef2ff",
                color:
                  summaryStats.overdueInstallmentsCount > 0
                    ? "#d97706"
                    : "#1d4ed8",
              }}
            >
              <i
                className={`bi ${summaryStats.overdueInstallmentsCount > 0
                  ? "bi-clock-history"
                  : "bi-calendar2-event"
                  }`}
                style={{ fontSize: "1.1rem" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          ...panelStyle,
          padding: "14px 18px",
          marginBottom: "24px",
        }}
      >
        <div className="row g-3 align-items-center justify-content-between">
          {/* Status Pills */}
          <div className="col-12 col-lg-auto">
            <div
              className="d-inline-flex flex-wrap gap-1 p-1"
              style={{
                backgroundColor: "#f3f7f4",
                borderRadius: "14px",
                border: "1px solid #e4ece6",
              }}
            >
              {(
                [
                  {
                    key: "active",
                    label: `Active (${summaryStats.activeCount})`,
                  },
                  {
                    key: "settled",
                    label: `100% Settled (${summaryStats.settledCount})`,
                  },
                  {
                    key: "all",
                    label: `All (${summaryStats.allCount})`,
                  },
                ] as { key: StatusFilter; label: string }[]
              ).map((tab) => {
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

          {/* Search & Category Filter */}
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
                    placeholder="Search plan name or provider..."
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
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ fontSize: "0.84rem" }}
                >
                  <option value="all">All categories</option>
                  {FINANCING_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Clickable Financing Cards Grid */}
      {loading ? (
        <div
          className="text-center py-5"
          style={{
            ...panelStyle,
            color: "#6b7f72",
            fontSize: "0.88rem",
          }}
        >
          <div
            className="spinner-border spinner-border-sm me-2"
            role="status"
          />
          Loading financing plans...
        </div>
      ) : filteredPlans.length === 0 ? (
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
            <i className="bi bi-credit-card-2-front" />
          </div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#1a2e23", marginBottom: "4px" }}>
            {plans.length === 0
              ? "No financing plans yet"
              : "No financing plans match your filters"}
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#6b7f72", marginBottom: 0 }}>
            {plans.length === 0
              ? 'Click "+ New plan" to track your car loans, BNPL (SPayLater, Atome), device plans or credit card installments.'
              : "Try switching between Active, 100% Settled, or All tabs."}
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {filteredPlans.map((plan) => {
            const stats = getPlanStats(plan);
            const catStyle =
              CATEGORY_COLORS[plan.financing_category] || CATEGORY_COLORS.Other;
            const nextDueStatus = stats.nextInstallment
              ? getDueStatus(
                stats.nextInstallment.due_date,
                stats.nextInstallment.status,
                todayStr
              )
              : null;

            return (
              <div key={plan.financing_id} className="col-12 col-md-6 col-xl-4">
                <div
                  onClick={() => setSelectedPlanId(plan.financing_id)}
                  style={{
                    ...panelStyle,
                    padding: "22px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    border:
                      stats.overdueCount > 0
                        ? "1px solid #fecaca"
                        : "1px solid #eef2ed",
                  }}
                >
                  <div>
                    {/* Top Row: Category Badge & Synced / Status Pills + Edit/Delete Icon Buttons */}
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <span
                        style={{
                          backgroundColor: catStyle.bg,
                          color: catStyle.color,
                          borderRadius: "999px",
                          padding: "3px 11px",
                          fontSize: "0.68rem",
                          fontWeight: 600,
                        }}
                      >
                        {plan.financing_category}
                      </span>

                      <div
                        className="d-flex align-items-center gap-2 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {plan.account_id && (
                          <span
                            title="Linked to Credit Card in Accounts"
                            style={{
                              backgroundColor: "#eef2ff",
                              color: "#1d4ed8",
                              borderRadius: "999px",
                              padding: "3px 10px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <i className="bi bi-credit-card-2-front" />
                            {accounts.find(
                              (a) => a.account_id === plan.account_id
                            )?.account_name || "Linked Card"}
                          </span>
                        )}

                        {plan.sync_to_commitments && (
                          <span
                            title="Synced with Commitments page"
                            style={{
                              backgroundColor: "#eaf4ee",
                              color: "#2e6f40",
                              borderRadius: "999px",
                              padding: "3px 10px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <i className="bi bi-link-45deg" />
                            Synced
                          </span>
                        )}

                        {stats.isFullySettled ? (
                          <span
                            style={{
                              backgroundColor: "#dcfce7",
                              color: "#15803d",
                              borderRadius: "999px",
                              padding: "3px 10px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                            }}
                          >
                            100% Settled
                          </span>
                        ) : stats.overdueCount > 0 ? (
                          <span
                            style={{
                              backgroundColor: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              borderRadius: "999px",
                              padding: "2px 9px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                            }}
                          >
                            Overdue
                          </span>
                        ) : nextDueStatus?.isDueSoon || nextDueStatus?.isDueToday ? (
                          <span
                            style={{
                              backgroundColor: "#fffbeb",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              borderRadius: "999px",
                              padding: "2px 9px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                            }}
                          >
                            Due {formatDisplayDate(stats.nextInstallment?.due_date)}
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(plan, e)}
                          className="btn btn-sm text-secondary p-0 border-0"
                          title="Edit financing plan"
                        >
                          <i
                            className="bi bi-pencil"
                            style={{ fontSize: "0.85rem" }}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPlan(plan);
                            setRefundPaidOnDelete(false);
                            setDeleteError(null);
                          }}
                          className="btn btn-sm text-danger p-0 border-0"
                          title="Delete financing plan"
                        >
                          <i
                            className="bi bi-trash3"
                            style={{ fontSize: "0.85rem" }}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Plan Title & Provider */}
                    <div
                      style={{
                        fontSize: "1.02rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                        marginBottom: "2px",
                      }}
                    >
                      {plan.financing_name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "#6b7f72",
                        marginBottom: "14px",
                      }}
                    >
                      {plan.financing_provider}
                      {stats.nextInstallment && !stats.isFullySettled && (
                        <span>
                          {" "}
                          · Next due{" "}
                          {formatDisplayDate(stats.nextInstallment.due_date)}
                        </span>
                      )}
                    </div>

                    {/* Paid / Total Amount */}
                    <div className="d-flex align-items-baseline gap-1 mb-2">
                      <span
                        style={{
                          fontSize: "1.42rem",
                          fontWeight: 700,
                          color: "#1a2e23",
                          letterSpacing: "-0.3px",
                        }}
                      >
                        RM {formatAmount(stats.totalPaid)}
                      </span>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "#7b8f82",
                          fontWeight: 500,
                        }}
                      >
                        / RM {formatAmount(stats.totalAmount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        backgroundColor: "#eef2ed",
                        borderRadius: "999px",
                        overflow: "hidden",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: `${stats.pct}%`,
                          height: "100%",
                          backgroundColor: "#3e8e5e",
                          borderRadius: "999px",
                          transition: "width 0.25s ease",
                        }}
                      />
                    </div>

                    {/* Bottom Stats Row */}
                    <div
                      className="d-flex justify-content-between align-items-center"
                      style={{
                        fontSize: "0.75rem",
                        color: "#6b7f72",
                        marginBottom: "14px",
                      }}
                    >
                      <span>{stats.pct}% paid</span>
                      <span>
                        {plan.duration_months !== null && plan.duration_months > 0
                          ? `RM ${formatAmount(stats.monthlyDisplay)}/mo × ${plan.duration_months
                          }`
                          : plan.installments.length > 0
                            ? `Flexible · ${stats.paidInstallments.length}/${plan.installments.length} bills paid`
                            : "Flexible duration"}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Button (#f9fbf5) */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedPlanId(plan.financing_id)}
                      style={{
                        width: "100%",
                        backgroundColor: "#f9fbf5",
                        border: "1px solid #e2ebe4",
                        borderRadius: "10px",
                        padding: "7px 12px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#1a2e23",
                        cursor: "pointer",
                      }}
                    >
                      View schedule &amp; update payment
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODAL 1: CREATE / EDIT FINANCING PLAN
      ===================================================================== */}
      <Modal
        open={planModalOpen}
        onCancel={() => !savingPlan && setPlanModalOpen(false)}
        footer={null}
        centered
        width={520}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a2e23" }}>
            {editingPlan ? "Edit financing plan" : "New financing plan"}
          </span>
        }
      >
        <form onSubmit={handleSavePlan} style={{ marginTop: "14px" }}>
          {planModalError && (
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
              {planModalError}
            </div>
          )}

          {/* Plan Name */}
          <div className="mb-3">
            <label className="form-label fintrack-modal-label">Plan name</label>
            <input
              type="text"
              className="form-control fintrack-modal-input"
              placeholder="e.g. Home Furniture Financing, MacBook Pro (BNPL), SPayLater"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          {/* Provider & Category */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">Provider</label>
              <select
                className="form-select fintrack-modal-input"
                value={formProviderSelect}
                onChange={(e) => setFormProviderSelect(e.target.value)}
              >
                {PROVIDER_SUGGESTIONS.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">Category</label>
              <select
                className="form-select fintrack-modal-input"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {FINANCING_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formProviderSelect === "Other" && (
            <div className="mb-3">
              <label className="form-label fintrack-modal-label">
                Custom provider name
              </label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="Enter bank or BNPL provider name"
                value={formCustomProvider}
                onChange={(e) => setFormCustomProvider(e.target.value)}
                required
              />
            </div>
          )}

          {/* Credit Card Link Option (shown when Category === "Credit Card") */}
          {formCategory === "Credit Card" && (
            <div
              style={{
                backgroundColor: "#f6faf7",
                border: "1px solid #cfe0d4",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "14px",
              }}
            >
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={formLinkCreditCard}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormLinkCreditCard(checked);
                    if (
                      checked &&
                      !formCreditCardId &&
                      creditCardAccounts[0]
                    ) {
                      setFormCreditCardId(creditCardAccounts[0].account_id);
                    }
                  }}
                />
                <span>
                  <strong>Link to a Credit Card in Accounts</strong> — holds
                  this installment balance against your card&apos;s credit limit
                </span>
              </label>

              {formLinkCreditCard && (
                <div style={{ marginTop: "10px" }}>
                  {creditCardAccounts.length === 0 ? (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#b45309",
                        backgroundColor: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "8px",
                        padding: "8px 10px",
                      }}
                    >
                      <i className="bi bi-info-circle me-1" />
                      No Credit Card accounts found on the Accounts page yet.
                      Add a Credit Card in Accounts first, or untick this box to
                      track the installment standalone.
                    </div>
                  ) : (
                    <>
                      <label className="form-label fintrack-modal-label">
                        Select Credit Card account
                      </label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={formCreditCardId}
                        onChange={(e) => setFormCreditCardId(e.target.value)}
                        required={formLinkCreditCard}
                      >
                        <option value="">Choose credit card...</option>
                        {creditCardAccounts.map((card) => {
                          const avail = getCreditCardAvailableLimit(
                            card,
                            editingPlan ? editingPlan.financing_id : null
                          );
                          return (
                            <option
                              key={card.account_id}
                              value={card.account_id}
                            >
                              {card.account_name} (Available limit: RM{" "}
                              {formatAmount(avail)})
                            </option>
                          );
                        })}
                      </select>

                      {(() => {
                        const selectedCC = creditCardAccounts.find(
                          (c) => c.account_id === formCreditCardId
                        );
                        const parsedTot = round2(
                          parseFloat(formTotalInput || "0")
                        );
                        if (!selectedCC || parsedTot <= 0) return null;
                        const paidSoFar = editingPlan
                          ? round2(
                              editingPlan.installments
                                .filter((i) => i.status === "paid")
                                .reduce((sum, i) => sum + i.amount_paid, 0)
                            )
                          : 0;
                        const holdAmt = Math.max(
                          0,
                          round2(parsedTot - paidSoFar)
                        );
                        const availBefore = getCreditCardAvailableLimit(
                          selectedCC,
                          editingPlan ? editingPlan.financing_id : null
                        );
                        const availAfter = round2(availBefore - holdAmt);
                        return (
                          <div
                            className="d-flex justify-content-between align-items-center pt-2 mt-2"
                            style={{
                              borderTop: "1px solid #e2ebe4",
                              fontSize: "0.75rem",
                              color:
                                availAfter < 0 ? "#dc2626" : "#2e4738",
                            }}
                          >
                            <span>Available credit limit after hold:</span>
                            <strong>
                              RM {formatAmount(availBefore)} →{" "}
                              {formatSignedRM(availAfter)}
                            </strong>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Row 1: Total Amount & Duration (2 clean columns) */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Total amount (RM)
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="form-control fintrack-modal-input"
                placeholder="0.00"
                value={formTotalInput}
                onChange={(e) => handleTotalInputChange(e.target.value)}
                required={!formIsFlexibleDuration}
              />
            </div>

            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Duration (months){" "}
                <span style={{ fontWeight: 400, color: "#7b8f82" }}>
                  (optional)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={600}
                className="form-control fintrack-modal-input"
                placeholder="Leave blank if flexible"
                value={formIsFlexibleDuration ? "" : formDurationInput}
                disabled={formIsFlexibleDuration}
                onChange={(e) => handleDurationInputChange(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Monthly Installment & Start Date (2 clean columns) */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Monthly installment (RM)
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="form-control fintrack-modal-input"
                placeholder={
                  formIsFlexibleDuration
                    ? "Flexible"
                    : formDurationInput
                      ? "Auto-calculated"
                      : "0.00"
                }
                value={formIsFlexibleDuration ? "" : formMonthlyInput}
                disabled={formIsFlexibleDuration}
                onChange={(e) => handleMonthlyInputChange(e.target.value)}
              />
              {!formIsFlexibleDuration && (
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#6b7f72",
                    marginTop: "3px",
                  }}
                >
                  Auto-calculated · edit to customize exact bank monthly
                </div>
              )}
            </div>

            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Start / first due date
              </label>
              <DateInputDDMMYYYY
                value={formStartDate}
                onChange={setFormStartDate}
                required
              />
            </div>
          </div>

          {/* Notes (optional) */}
          <div className="mb-3">
            <label className="form-label fintrack-modal-label">
              Notes (optional)
            </label>
            <input
              type="text"
              className="form-control fintrack-modal-input"
              placeholder="e.g. 0% installment plan, bank loan contract"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          {/* Flexible Duration Toggle (for SPayLater / Open BNPL) */}
          <div className="mb-3">
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                style={checkboxInputStyle}
                checked={formIsFlexibleDuration}
                onChange={(e) => {
                  setFormIsFlexibleDuration(e.target.checked);
                  if (e.target.checked) {
                    setFormDurationInput("");
                    setFormMonthlyInput("");
                  } else if (!formDurationInput) {
                    setFormDurationInput("12");
                  }
                }}
              />
              <span>
                Flexible / no fixed duration (e.g. general SPayLater tracking where monthly bills change)
              </span>
            </label>
          </div>

          {/* If editing an existing plan and start date is changed: offer auto-realignment */}
          {editingPlan &&
            formStartDate !== editingPlan.start_date &&
            editingPlan.installments.length > 0 && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  marginBottom: "14px",
                }}
              >
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    style={checkboxInputStyle}
                    checked={formRealignDates}
                    onChange={(e) => setFormRealignDates(e.target.checked)}
                  />
                  <span>
                    <strong>Update installment schedule due dates</strong> to start
                    from {formatDisplayDate(formStartDate)}
                  </span>
                </label>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#15803d",
                    marginTop: "3px",
                    paddingLeft: "23px",
                  }}
                >
                  {editingPlan.installments.some((i) => i.status === "paid")
                    ? "Paid installments remain intact. Upcoming pending installments will be shifted sequentially."
                    : "All monthly installment rows in the table will be sequentially updated to match this new start date."}
                </div>
              </div>
            )}

          {/* Link to Commitments Page Checkbox */}
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              borderRadius: "12px",
              padding: "11px 14px",
              marginBottom: "18px",
            }}
          >
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                style={checkboxInputStyle}
                checked={formSyncCommitments}
                onChange={(e) => setFormSyncCommitments(e.target.checked)}
              />
              <span>
                <strong>Link to Commitments page</strong> — show this financing plan in your monthly Commitments grid
              </span>
            </label>
          </div>

          {/* Live Preview of Schedule */}
          {!editingPlan &&
            !formIsFlexibleDuration &&
            parseInt(formDurationInput || "0", 10) > 0 &&
            parseFloat(formTotalInput || "0") > 0 && (
              <div
                style={{
                  backgroundColor: "#f9fbf5",
                  border: "1px solid #e2ebe4",
                  borderRadius: "10px",
                  padding: "9px 12px",
                  fontSize: "0.76rem",
                  color: "#4b6355",
                  marginBottom: "16px",
                }}
              >
                <i className="bi bi-calendar2-check me-1" />
                Will generate{" "}
                <strong>{parseInt(formDurationInput, 10)} monthly installments</strong>{" "}
                of ~
                <strong>
                  RM{" "}
                  {formatAmount(
                    parseFloat(formMonthlyInput) > 0
                      ? parseFloat(formMonthlyInput)
                      : parseFloat(formTotalInput) / parseInt(formDurationInput, 10)
                  )}
                  /mo
                </strong>{" "}
                starting <strong>{formatDisplayDate(formStartDate)}</strong>. You can customize any month&apos;s due date or amount anytime.
              </div>
            )}

          <div className="d-flex justify-content-end gap-2">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setPlanModalOpen(false)}
              disabled={savingPlan}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingPlan}
            >
              {editingPlan ? "Save changes" : "Create plan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 2: CLICKABLE CARD DETAIL & INSTALLMENT SCHEDULE MODAL
      ===================================================================== */}
      <Modal
        open={Boolean(selectedPlan)}
        onCancel={() => {
          setSelectedPlanId(null);
          setEditingInstallment(null);
        }}
        footer={null}
        centered
        width={820}
        className="fintrack-Account-Modal"
        title={
          selectedPlan ? (
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "#1a2e23",
                }}
              >
                {selectedPlan.financing_name}
              </span>
              <span
                style={{
                  backgroundColor: "#173f8f",
                  color: "#ffffff",
                  borderRadius: "999px",
                  padding: "2px 10px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                }}
              >
                {selectedPlan.financing_category}
              </span>
            </div>
          ) : null
        }
      >
        {selectedPlan &&
          (() => {
            const stats = getPlanStats(selectedPlan);
            return (
              <div style={{ marginTop: "8px" }}>
                {/* Subtitle & Sync Toggle */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div style={{ fontSize: "0.82rem", color: "#6b7f72" }}>
                    <strong>{selectedPlan.financing_provider}</strong> ·{" "}
                    {selectedPlan.duration_months !== null
                      ? `${selectedPlan.duration_months} months`
                      : "Flexible duration"}{" "}
                    · Started {formatDisplayDate(selectedPlan.start_date)}
                    {selectedPlan.financing_notes
                      ? ` · ${selectedPlan.financing_notes}`
                      : ""}
                  </div>

                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      style={checkboxInputStyle}
                      checked={selectedPlan.sync_to_commitments}
                      disabled={togglingSyncPlanId === selectedPlan.financing_id}
                      onChange={() => handleToggleSyncCommitments(selectedPlan)}
                    />
                    <span>Link to Commitments page</span>
                  </label>
                </div>

                {/* Summary Box */}
                <div
                  style={{
                    backgroundColor: "#f8faf8",
                    border: "1px solid #e6ece7",
                    borderRadius: "14px",
                    padding: "14px 18px",
                    marginBottom: "16px",
                  }}
                >
                  <div className="row g-3 align-items-center">
                    <div className="col-6 col-sm-3">
                      <div style={{ fontSize: "0.72rem", color: "#6b7f72" }}>
                        Paid so far
                      </div>
                      <div
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "#16a34a",
                        }}
                      >
                        RM {formatAmount(stats.totalPaid)}
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div style={{ fontSize: "0.72rem", color: "#6b7f72" }}>
                        Remaining
                      </div>
                      <div
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "#1a2e23",
                        }}
                      >
                        RM {formatAmount(stats.remaining)}
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div style={{ fontSize: "0.72rem", color: "#6b7f72" }}>
                        Total financing
                      </div>
                      <div
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "#1a2e23",
                        }}
                      >
                        RM {formatAmount(stats.totalAmount)}
                      </div>
                    </div>
                    <div className="col-6 col-sm-3">
                      <div style={{ fontSize: "0.72rem", color: "#6b7f72" }}>
                        Progress
                      </div>
                      <div
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "#1a2e23",
                        }}
                      >
                        {stats.pct}% paid
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "#e2ebe4",
                      borderRadius: "999px",
                      overflow: "hidden",
                      marginTop: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: `${stats.pct}%`,
                        height: "100%",
                        backgroundColor: "#3e8e5e",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                </div>

                {/* Schedule Toolbar (Filter Pills + Realign + Add Month) */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScheduleFilter("all")}
                      style={{
                        backgroundColor:
                          scheduleFilter === "all" ? "#2e4738" : "#f0f4f1",
                        color: scheduleFilter === "all" ? "#ffffff" : "#4b6355",
                        border: "none",
                        borderRadius: "999px",
                        padding: "5px 13px",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      All ({selectedPlan.installments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleFilter("pending")}
                      style={{
                        backgroundColor:
                          scheduleFilter === "pending" ? "#92400e" : "#fef3c7",
                        color:
                          scheduleFilter === "pending" ? "#ffffff" : "#92400e",
                        border: "none",
                        borderRadius: "999px",
                        padding: "5px 13px",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Pending (
                      {
                        selectedPlan.installments.filter(
                          (i) => i.status === "pending"
                        ).length
                      }
                      )
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleFilter("paid")}
                      style={{
                        backgroundColor:
                          scheduleFilter === "paid" ? "#15803d" : "#dcfce7",
                        color:
                          scheduleFilter === "paid" ? "#ffffff" : "#15803d",
                        border: "none",
                        borderRadius: "999px",
                        padding: "5px 13px",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Paid (
                      {
                        selectedPlan.installments.filter(
                          (i) => i.status === "paid"
                        ).length
                      }
                      )
                    </button>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRealignEntireSchedule}
                      disabled={realigningSchedule}
                      title="Realign installment due dates sequentially based on plan start date"
                      style={{
                        backgroundColor: "#f9fbf5",
                        border: "1px solid #cfe0d4",
                        borderRadius: "10px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#2e4738",
                        cursor: realigningSchedule ? "not-allowed" : "pointer",
                      }}
                    >
                      <i className="bi bi-arrow-repeat me-1" />
                      {realigningSchedule ? "Realigning..." : "Realign dates"}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddMonthModal}
                      style={{
                        backgroundColor: "#69a980",
                        border: "none",
                        borderRadius: "10px",
                        padding: "6px 13px",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      + Add month / bill
                    </button>
                  </div>
                </div>

                {/* Schedule Table */}
                {selectedPlan.installments.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: "#f9fbf5",
                      border: "1px dashed #cfe0d4",
                      borderRadius: "12px",
                      padding: "28px 18px",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "#4b6355",
                        marginBottom: "10px",
                      }}
                    >
                      No monthly bills added yet for this flexible financing plan. Click{" "}
                      <strong>+ Add month / bill</strong> whenever you want to log an upcoming monthly bill or payment.
                    </p>
                    {/* <button
                      type="button"
                      onClick={handleOpenAddMonthModal}
                      style={{
                        backgroundColor: "#69a980",
                        border: "none",
                        borderRadius: "10px",
                        padding: "7px 14px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      + Add month / bill
                    </button> */}
                  </div>
                ) : (
                  <div
                    className="table-responsive"
                    style={{
                      maxHeight: "390px",
                      overflowY: "auto",
                      border: "1px solid #eef2ed",
                      borderRadius: "12px",
                    }}
                  >
                    <table
                      className="table mb-0 align-middle"
                      style={{ fontSize: "0.8rem" }}
                    >
                      <thead
                        style={{
                          position: "sticky",
                          top: 0,
                          backgroundColor: "#f8faf8",
                          zIndex: 1,
                        }}
                      >
                        <tr
                          style={{
                            fontSize: "0.69rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: "#6b7f72",
                          }}
                        >
                          <th style={{ padding: "10px 14px" }}>#</th>
                          <th style={{ padding: "10px 14px" }}>Due Date</th>
                          <th style={{ padding: "10px 14px" }}>Amount Due</th>
                          <th style={{ padding: "10px 14px" }}>Amount Paid</th>
                          <th style={{ padding: "10px 14px" }}>Status</th>
                          <th
                            style={{
                              padding: "10px 14px",
                              textAlign: "right",
                            }}
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInstallments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              style={{
                                padding: "36px 14px",
                                textAlign: "center",
                                color: "#6b7f72",
                                fontSize: "0.82rem",
                              }}
                            >
                              No installments found in &quot;{scheduleFilter}&quot; tab.
                            </td>
                          </tr>
                        ) : filteredInstallments.map((inst) => {
                          const dueStatus = getDueStatus(
                            inst.due_date,
                            inst.status,
                            todayStr
                          );
                          const isNextDue =
                            inst.status === "pending" &&
                            inst.installment_id === nextDueInstId;
                          return (
                            <tr
                              key={inst.installment_id}
                              style={{
                                backgroundColor: isNextDue
                                  ? "#fffdf5"
                                  : undefined,
                              }}
                            >
                              <td
                                style={{
                                  padding: "11px 14px",
                                  fontWeight: 700,
                                  color: "#1a2e23",
                                }}
                              >
                                {inst.installment_number}
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                <div className="d-flex align-items-center flex-wrap gap-1">
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      color: dueStatus.isOverdue
                                        ? "#dc2626"
                                        : "#1a2e23",
                                    }}
                                  >
                                    {formatDisplayDate(inst.due_date)}
                                  </span>
                                  {isNextDue && (
                                    <span
                                      style={{
                                        backgroundColor: "#fef3c7",
                                        color: "#92400e",
                                        border: "1px solid #fde68a",
                                        borderRadius: "999px",
                                        padding: "1px 7px",
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                      }}
                                    >
                                      Next due
                                    </span>
                                  )}
                                </div>
                                {inst.installment_notes && (
                                  <div
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "#6b7f72",
                                    }}
                                  >
                                    {inst.installment_notes
                                      .replace(
                                        /\s*\[Cascaded from #[0-9]+: RM [0-9.]+\]/g,
                                        ""
                                      )
                                      .trim()}
                                  </div>
                                )}
                                {inst.status === "paid" && inst.paid_at && (
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#16a34a",
                                    }}
                                  >
                                    Paid on {formatDisplayDate(inst.paid_at)}
                                  </div>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "11px 14px",
                                  fontWeight: 600,
                                  color: "#1a2e23",
                                }}
                              >
                                RM {formatAmount(inst.amount_due)}
                              </td>
                              <td
                                style={{
                                  padding: "11px 14px",
                                  fontWeight: 700,
                                  color:
                                    inst.status === "paid"
                                      ? "#16a34a"
                                      : "#1a2e23",
                                }}
                              >
                                RM {formatAmount(inst.amount_paid)}
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                {inst.status === "paid" ? (
                                  <span
                                    style={{
                                      backgroundColor: "#dcfce7",
                                      color: "#15803d",
                                      borderRadius: "999px",
                                      padding: "3px 10px",
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Paid
                                  </span>
                                ) : dueStatus.isOverdue ? (
                                  <span
                                    style={{
                                      backgroundColor: "#fef2f2",
                                      color: "#dc2626",
                                      borderRadius: "999px",
                                      padding: "3px 10px",
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Overdue
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      backgroundColor: "#fef3c7",
                                      color: "#92400e",
                                      borderRadius: "999px",
                                      padding: "3px 10px",
                                      fontSize: "0.7rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Pending
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  padding: "11px 14px",
                                  textAlign: "right",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {inst.status === "pending" ? (
                                  <div className="d-inline-flex align-items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenPayModal(inst)}
                                      style={{
                                        backgroundColor: "#69a980",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "4px 10px",
                                        fontSize: "0.73rem",
                                        fontWeight: 600,
                                        color: "#ffffff",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Mark paid
                                    </button>
                                    <button
                                      type="button"
                                      title="Edit due date or amount"
                                      onClick={() =>
                                        handleOpenEditInstallment(inst)
                                      }
                                      style={{
                                        backgroundColor: "#f9fbf5",
                                        border: "1px solid #e2ebe4",
                                        borderRadius: "8px",
                                        padding: "4px 8px",
                                        fontSize: "0.73rem",
                                        color: "#2e4738",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <i className="bi bi-pencil" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Remove this month"
                                      onClick={() =>
                                        handleDeletePendingInstallment(inst)
                                      }
                                      style={{
                                        backgroundColor: "#f9fbf5",
                                        border: "1px solid #f3d6d6",
                                        borderRadius: "8px",
                                        padding: "4px 8px",
                                        fontSize: "0.73rem",
                                        color: "#dc2626",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <i className="bi bi-trash3" />
                                    </button>
                                  </div>
                                ) : inst.amount_paid === 0 &&
                                  inst.installment_notes?.includes(
                                    "[Cascaded from #"
                                  ) ? (
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "#15803d",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Settled early
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUnpayingInstallment(inst);
                                      setUnpayError(null);
                                    }}
                                    style={{
                                      backgroundColor: "#f9fbf5",
                                      border: "1px solid #e2ebe4",
                                      borderRadius: "8px",
                                      padding: "4px 10px",
                                      fontSize: "0.73rem",
                                      fontWeight: 600,
                                      color: "#4b6355",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Mark unpaid
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
      </Modal>

      {/* =====================================================================
          MODAL 2.5: EDIT INSTALLMENT DETAILS (STACKED SUB-MODAL)
      ===================================================================== */}
      <Modal
        open={Boolean(editingInstallment)}
        onCancel={() => !savingInstallmentEdit && setEditingInstallment(null)}
        footer={null}
        centered
        width={460}
        zIndex={1060}
        className="fintrack-Account-Modal"
        title={
          <span
            style={{ fontWeight: 700, fontSize: "1.02rem", color: "#1a2e23" }}
          >
            Edit Month #{editingInstallment?.installment_number} Installment
          </span>
        }
      >
        {editingInstallment && selectedPlan && (
          <form
            onSubmit={handleSaveInstallmentEdit}
            style={{ marginTop: "14px" }}
          >
            {editInstError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  marginBottom: "14px",
                }}
              >
                {editInstError}
              </div>
            )}

            <div
              style={{
                backgroundColor: "#f8faf8",
                border: "1px solid #e6ece7",
                borderRadius: "12px",
                padding: "10px 14px",
                marginBottom: "14px",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "#1a2e23" }}>
                {selectedPlan.financing_name} ({selectedPlan.financing_provider})
              </div>
              <div style={{ color: "#6b7f72", marginTop: "2px" }}>
                Editing installment #{editingInstallment.installment_number} of{" "}
                {selectedPlan.installments.length}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fintrack-modal-label">
                Due date (DD-MM-YYYY)
              </label>
              <DateInputDDMMYYYY
                value={editInstDueDate}
                onChange={setEditInstDueDate}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label fintrack-modal-label">
                Amount due (RM)
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="form-control fintrack-modal-input"
                placeholder="0.00"
                value={editInstAmountInput}
                onChange={(e) =>
                  setEditInstAmountInput(formatCentsInput(e.target.value))
                }
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label fintrack-modal-label">
                Note (optional)
              </label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="e.g. Revised monthly amount"
                value={editInstNotes}
                onChange={(e) => setEditInstNotes(e.target.value)}
              />
            </div>

            {/* Checkbox Options Box */}
            <div
              style={{
                backgroundColor: "#f6faf7",
                border: "1px solid #cfe0d4",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {futurePendingCount > 0 && (
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    style={checkboxInputStyle}
                    checked={editInstApplyToFuture}
                    onChange={(e) => setEditInstApplyToFuture(e.target.checked)}
                  />
                  <span>
                    Apply this amount (<strong>RM {editInstAmountInput || "0.00"}</strong>) to all remaining{" "}
                    <strong>{futurePendingCount}</strong> pending months
                  </span>
                </label>
              )}

              {futurePendingCount > 0 && editDayOfMonth !== null && (
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    style={checkboxInputStyle}
                    checked={editInstSyncDayToFuture}
                    onChange={(e) =>
                      setEditInstSyncDayToFuture(e.target.checked)
                    }
                  />
                  <span>
                    Shift all remaining <strong>{futurePendingCount}</strong> pending due dates to the{" "}
                    <strong>{editDayOfMonth}th</strong> of each month
                  </span>
                </label>
              )}

              {editingInstallment.installment_number === 1 && (
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    style={checkboxInputStyle}
                    checked={editInstSyncStartDate}
                    onChange={(e) => setEditInstSyncStartDate(e.target.checked)}
                  />
                  <span>
                    Also update financing plan start date to{" "}
                    <strong>{formatDisplayDate(editInstDueDate)}</strong>
                  </span>
                </label>
              )}

              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={editInstSyncTotal}
                  onChange={(e) => setEditInstSyncTotal(e.target.checked)}
                />
                <span>
                  Automatically adjust total financing amount to match sum of all months
                </span>
              </label>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setEditingInstallment(null)}
                disabled={savingInstallmentEdit}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                className="fintrack-modal-primary-btn"
                loading={savingInstallmentEdit}
              >
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 3: ADD NEW MONTH / BILL (FOR FLEXIBLE OR EXTENDED PLANS)
      ===================================================================== */}
      <Modal
        open={addMonthModalOpen}
        onCancel={() => !savingNewMonth && setAddMonthModalOpen(false)}
        footer={null}
        centered
        width={440}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a2e23" }}>
            Add monthly installment / bill
          </span>
        }
      >
        <form onSubmit={handleSaveNewMonth} style={{ marginTop: "12px" }}>
          {addMonthError && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "0.78rem",
                marginBottom: "12px",
              }}
            >
              {addMonthError}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fintrack-modal-label">
              Due date (DD-MM-YYYY)
            </label>
            <DateInputDDMMYYYY
              value={newMonthDueDate}
              onChange={setNewMonthDueDate}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label fintrack-modal-label">
              Amount due (RM)
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="form-control fintrack-modal-input"
              placeholder="0.00"
              value={newMonthAmountInput}
              onChange={(e) =>
                setNewMonthAmountInput(formatCentsInput(e.target.value))
              }
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label fintrack-modal-label">
              Note (optional)
            </label>
            <input
              type="text"
              className="form-control fintrack-modal-input"
              placeholder="e.g. November SPayLater statement"
              value={newMonthNotes}
              onChange={(e) => setNewMonthNotes(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                style={checkboxInputStyle}
                checked={newMonthAddToTotal}
                onChange={(e) => setNewMonthAddToTotal(e.target.checked)}
              />
              <span>Add this amount to the plan&apos;s total financing amount</span>
            </label>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setAddMonthModalOpen(false)}
              disabled={savingNewMonth}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingNewMonth}
            >
              Add month
            </Button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 4: CONFIRM MARK INSTALLMENT AS PAID (WITH ACCOUNT & TX SYNC)
      ===================================================================== */}
      <Modal
        open={Boolean(payingInstallment)}
        onCancel={() => !payingLoading && setPayingInstallment(null)}
        footer={null}
        centered
        width={480}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1.02rem", color: "#1a2e23" }}>
            Confirm installment payment
          </span>
        }
      >
        {payingInstallment && selectedPlan && (
          <form onSubmit={handleConfirmPayInstallment} style={{ marginTop: "12px" }}>
            {payModalError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  marginBottom: "12px",
                }}
              >
                {payModalError}
              </div>
            )}

            <div
              style={{
                backgroundColor: "#f8faf8",
                border: "1px solid #e6ece7",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "14px",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ fontWeight: 700, color: "#1a2e23" }}>
                {selectedPlan.financing_name} ({selectedPlan.financing_provider})
              </div>
              <div style={{ color: "#6b7f72", marginTop: "2px" }}>
                Installment #{payingInstallment.installment_number} · Due{" "}
                {formatDisplayDate(payingInstallment.due_date)}
              </div>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-12 col-sm-6">
                <label className="form-label fintrack-modal-label">
                  Amount paid (RM)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control fintrack-modal-input"
                  placeholder="0.00"
                  value={payAmountInput}
                  onChange={(e) =>
                    setPayAmountInput(formatCentsInput(e.target.value))
                  }
                  required
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label fintrack-modal-label">
                  Payment date (DD-MM-YYYY)
                </label>
                <DateInputDDMMYYYY
                  value={payDate}
                  onChange={setPayDate}
                  required
                />
              </div>
            </div>

            {/* Overpayment Cascading Preview */}
            {(() => {
              const typedAmt = round2(parseFloat(payAmountInput || "0"));
              const excess = round2(typedAmt - payingInstallment.amount_due);
              if (excess <= 0.001) return null;
              return (
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    fontSize: "0.75rem",
                    color: "#15803d",
                    marginBottom: "12px",
                  }}
                >
                  <i className="bi bi-lightning-charge-fill me-1" />
                  <strong>Early / extra payment (+RM {formatAmount(excess)}):</strong>{" "}
                  This extra amount will automatically cascade forward to reduce or settle your upcoming pending installments.
                </div>
              );
            })()}

            {/* Linked Credit Card Limit Release Info */}
            {selectedPlan.account_id &&
              (() => {
                const linkedCC = accounts.find(
                  (a) => a.account_id === selectedPlan.account_id
                );
                if (!linkedCC) return null;
                return (
                  <div
                    style={{
                      backgroundColor: "#eef2ff",
                      border: "1px solid #c7d2fe",
                      borderRadius: "10px",
                      padding: "9px 12px",
                      fontSize: "0.74rem",
                      color: "#1e40af",
                      marginBottom: "12px",
                    }}
                  >
                    <i className="bi bi-credit-card-2-front me-1" />
                    Linked to <strong>{linkedCC.account_name}</strong>: Paying this installment from your bank/cash account will automatically release the paid amount back to your card&apos;s available credit limit. (Pay any normal card swipes separately via <strong>Pay card</strong> in Accounts.)
                  </div>
                );
              })()}

            <div className="mb-3">
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  style={checkboxInputStyle}
                  checked={payReflectAccount}
                  onChange={(e) => setPayReflectAccount(e.target.checked)}
                />
                <span>
                  Deduct from Account &amp; record in Transactions automatically
                </span>
              </label>
            </div>

            {payReflectAccount && (
              <div
                style={{
                  backgroundColor: "#f6faf7",
                  border: "1px solid #e2ebe4",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                }}
              >
                <div className="mb-2">
                  <label className="form-label fintrack-modal-label">
                    Pay from account (non-credit card)
                  </label>
                  <select
                    className="form-select fintrack-modal-input"
                    value={payAccountId}
                    onChange={(e) => {
                      setPayAccountId(e.target.value);
                      setPaySubAccountId("");
                    }}
                    required
                  >
                    <option value="">Select account...</option>
                    {nonCreditAccounts.map((acc) => (
                      <option key={acc.account_id} value={acc.account_id}>
                        {acc.account_name} (Available: RM{" "}
                        {formatAmount(getAvailableBalance(acc, ""))})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPayAccount &&
                  selectedPayAccount.subaccounts.length > 0 && (
                    <div className="mb-2">
                      <label className="form-label fintrack-modal-label">
                        Sub-account (optional)
                      </label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={paySubAccountId}
                        onChange={(e) => setPaySubAccountId(e.target.value)}
                      >
                        <option value="">
                          Unallocated (RM{" "}
                          {formatAmount(getUnallocated(selectedPayAccount))})
                        </option>
                        {selectedPayAccount.subaccounts.map((sub) => (
                          <option
                            key={sub.subaccount_id}
                            value={sub.subaccount_id}
                          >
                            {sub.subaccount_name} (RM{" "}
                            {formatAmount(sub.subaccount_value)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {selectedPayAccount &&
                  parseFloat(payAmountInput || "0") > 0 && (
                    <div
                      className="d-flex justify-content-between align-items-center pt-2 mt-2"
                      style={{
                        borderTop: "1px solid #e2ebe4",
                        fontSize: "0.76rem",
                        color: "#2e4738",
                      }}
                    >
                      <span>Balance impact:</span>
                      <strong>
                        RM{" "}
                        {formatAmount(
                          getAvailableBalance(
                            selectedPayAccount,
                            paySubAccountId
                          )
                        )}{" "}
                        →{" "}
                        {formatSignedRM(
                          round2(
                            getAvailableBalance(
                              selectedPayAccount,
                              paySubAccountId
                            ) - parseFloat(payAmountInput || "0")
                          )
                        )}
                      </strong>
                    </div>
                  )}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setPayingInstallment(null)}
                disabled={payingLoading}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                className="fintrack-modal-primary-btn"
                loading={payingLoading}
              >
                Confirm paid
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 5: CONFIRM MARK INSTALLMENT AS UNPAID (REOPEN)
      ===================================================================== */}
      <Modal
        open={Boolean(unpayingInstallment)}
        onCancel={() => !unpayingLoading && setUnpayingInstallment(null)}
        footer={null}
        centered
        width={430}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a2e23" }}>
            Mark installment as unpaid?
          </span>
        }
      >
        {unpayingInstallment && (
          <div style={{ marginTop: "10px" }}>
            {unpayError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  marginBottom: "12px",
                }}
              >
                {unpayError}
              </div>
            )}
            <p style={{ fontSize: "0.82rem", color: "#4b6355" }}>
              This will revert{" "}
              <strong>
                Installment #{unpayingInstallment.installment_number}
              </strong>{" "}
              (RM {formatAmount(unpayingInstallment.amount_paid)}) back to{" "}
              <strong>Pending</strong>.
              {unpayingInstallment.transaction_id
                ? " The linked expense transaction will also be cancelled and the amount refunded to your account."
                : ""}
            </p>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setUnpayingInstallment(null)}
                disabled={unpayingLoading}
              >
                Cancel
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmUnpayInstallment}
                loading={unpayingLoading}
              >
                Mark as unpaid
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 6: DELETE FINANCING PLAN CONFIRMATION
      ===================================================================== */}
      <Modal
        open={Boolean(deletingPlan)}
        onCancel={() => !deletingLoading && setDeletingPlan(null)}
        footer={null}
        centered
        width={450}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1.02rem", color: "#1a2e23" }}>
            Delete financing plan?
          </span>
        }
      >
        {deletingPlan && (
          <div style={{ marginTop: "10px" }}>
            {deleteError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  marginBottom: "12px",
                }}
              >
                {deleteError}
              </div>
            )}

            <p style={{ fontSize: "0.82rem", color: "#4b6355" }}>
              Are you sure you want to delete{" "}
              <strong>{deletingPlan.financing_name}</strong> (
              {deletingPlan.financing_provider})?
            </p>

            {deletingPlan.installments.some(
              (i) => i.status === "paid" && i.transaction_id
            ) && (
                <div
                  style={{
                    backgroundColor: "#f6faf7",
                    border: "1px solid #e2ebe4",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    marginBottom: "14px",
                  }}
                >
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      style={checkboxInputStyle}
                      checked={refundPaidOnDelete}
                      onChange={(e) => setRefundPaidOnDelete(e.target.checked)}
                    />
                    <span>
                      Also cancel linked payment transactions and refund paid amounts back to my accounts
                    </span>
                  </label>
                </div>
              )}

            <div className="d-flex justify-content-end gap-2">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setDeletingPlan(null)}
                disabled={deletingLoading}
              >
                Cancel
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmDeletePlan}
                loading={deletingLoading}
              >
                Delete plan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <BottomToast
        open={toastOpen}
        message={toastMessage}
        type={toastType}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
