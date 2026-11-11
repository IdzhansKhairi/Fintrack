"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

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
  is_credit_card: boolean;
  credit_limit: number | null;
  unpaid_financing_hold: number;
  is_active: boolean;
  subaccounts: SubAccount[];
}

interface CommitmentRecord {
  commitment_id: string;
  user_id: string;
  commitment_name: string;
  commitment_description: string | null;
  commitment_category: string;
  monthly_amount: number;
  due_day: number;
  start_date: string; // YYYY-MM-DD (1st of start month)
  end_date: string | null; // YYYY-MM-DD (1st of end month)
  is_variable_amount: boolean;
  is_active: boolean;
  created_at: string;
}

interface CommitmentPaymentRecord {
  commitment_payment_id: string;
  commitment_id: string;
  user_id: string;
  payment_year: number;
  payment_month: number; // 1..12
  amount_due: number;
  amount_paid: number;
  status: "paid" | "skipped";
  paid_at: string | null; // YYYY-MM-DD
  payment_notes: string | null;
  account_id: string | null;
  subaccount_id: string | null;
  transaction_id: string | null;
  is_active: boolean;
}

interface LinkedFinancingInstallment {
  installment_id: string;
  financing_id: string;
  user_id: string;
  installment_number: number;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
  amount_paid: number;
  status: "pending" | "paid";
  paid_at: string | null;
  installment_notes: string | null;
  account_id: string | null;
  subaccount_id: string | null;
  transaction_id: string | null;
  is_active: boolean;
}

interface LinkedFinancingPlan {
  financing_id: string;
  user_id: string;
  financing_name: string;
  financing_provider: string;
  financing_category: string;
  total_amount: number;
  duration_months: number | null;
  start_date: string;
  sync_to_commitments: boolean;
  status: "active" | "settled";
  account_id: string | null;
  installments: LinkedFinancingInstallment[];
}

// Unified cell target when clicking a month cell on the Commitments grid
interface ActiveCellModalTarget {
  rowKind: "commitment" | "financing";
  title: string;
  subtitle: string;
  year: number;
  month: number; // 1..12
  dueDateStr: string; // YYYY-MM-DD
  defaultAmountDue: number;
  isPaid: boolean;
  isSkipped: boolean;
  paidAmount: number;
  paidAt: string | null;
  notes: string | null;
  // For standalone commitment
  commitment?: CommitmentRecord;
  existingPayment?: CommitmentPaymentRecord | null;
  // For linked financing
  financingPlan?: LinkedFinancingPlan;
  financingInstallment?: LinkedFinancingInstallment;
}

const COMMITMENT_EXPENSE_CATEGORY = "Commitment";
const FINANCING_EXPENSE_CATEGORY = "Financing / Installment";

const COMMITMENT_CATEGORIES = [
  "Housing",
  "Transport",
  "Insurance",
  "Utilities",
  "Internet & Telco",
  "Subscription",
  "Zakat / Charity",
  "Education",
  "Other",
];

const MONTH_SHORT_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const MONTH_FULL_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

// Builds a valid YYYY-MM-DD date string for (year, month 1..12, dueDay 1..31)
function buildDueDateForYearMonth(
  year: number,
  month: number,
  dueDay: number
): string {
  const maxDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(1, dueDay), maxDay);
  const mm = String(month).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Checks if (year, month 1..12) is within commitment's [start_date, end_date]
function isMonthApplicableForCommitment(
  c: CommitmentRecord,
  year: number,
  month: number
): boolean {
  const ym = year * 100 + month;
  const startParts = c.start_date.slice(0, 7).split("-").map(Number);
  const startYm = startParts[0] * 100 + startParts[1];
  if (ym < startYm) return false;

  if (c.end_date) {
    const endParts = c.end_date.slice(0, 7).split("-").map(Number);
    const endYm = endParts[0] * 100 + endParts[1];
    if (ym > endYm) return false;
  }
  return true;
}

function getUnallocated(account: Account): number {
  const allocated = account.subaccounts.reduce(
    (sum, s) => sum + Number(s.subaccount_value),
    0
  );
  return Math.max(0, round2(account.account_balance - allocated));
}

function getAvailableBalance(account: Account, subaccountId: string): number {
  if (account.is_credit_card) {
    const limit = Number(account.credit_limit || 0);
    const hold = Number(account.unpaid_financing_hold || 0);
    return Math.max(0, round2(limit - hold + account.account_balance));
  }
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

// Custom Date Input that always displays DD-MM-YYYY while using native calendar picker
function DateInputDDMMYYYY({
  value,
  onChange,
  placeholder = "DD-MM-YYYY",
  required = false,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
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
        // Fallback
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
          paddingRight: "38px",
        }}
      />
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

export default function CommitmentsPage() {
  const supabase = createClient();

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [commitments, setCommitments] = useState<CommitmentRecord[]>([]);
  const [payments, setPayments] = useState<CommitmentPaymentRecord[]>([]);
  const [linkedFinancing, setLinkedFinancing] = useState<LinkedFinancingPlan[]>(
    []
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Year Selection
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Add / Edit Commitment Modal State
  const [commitmentModalOpen, setCommitmentModalOpen] = useState<boolean>(false);
  const [editingCommitment, setEditingCommitment] =
    useState<CommitmentRecord | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Housing");
  const [formAmountInput, setFormAmountInput] = useState<string>("");
  const [formDueDay, setFormDueDay] = useState<string>("1");
  const [formStartMonth, setFormStartMonth] = useState<string>("1");
  const [formStartYear, setFormStartYear] = useState<string>(
    String(currentYear)
  );
  const [formHasEndDate, setFormHasEndDate] = useState<boolean>(false);
  const [formEndMonth, setFormEndMonth] = useState<string>("12");
  const [formEndYear, setFormEndYear] = useState<string>(String(currentYear));
  const [formVariableAmount, setFormVariableAmount] = useState<boolean>(false);
  const [commitmentModalError, setCommitmentModalError] = useState<
    string | null
  >(null);
  const [savingCommitment, setSavingCommitment] = useState<boolean>(false);

  // Update Cell Payment Modal State (when clicking any JAN..DEC cell)
  const [activeCellTarget, setActiveCellTarget] =
    useState<ActiveCellModalTarget | null>(null);
  const [cellPayDate, setCellPayDate] = useState<string>(getTodayDateString());
  const [cellAmountInput, setCellAmountInput] = useState<string>("");
  const [cellReflectAccount, setCellReflectAccount] = useState<boolean>(true);
  const [cellAccountId, setCellAccountId] = useState<string>("");
  const [cellSubAccountId, setCellSubAccountId] = useState<string>("");
  const [cellNotes, setCellNotes] = useState<string>("");
  const [cellSaving, setCellSaving] = useState<boolean>(false);
  const [cellModalError, setCellModalError] = useState<string | null>(null);

  // Delete Commitment Confirmation Modal State
  const [deletingCommitment, setDeletingCommitment] =
    useState<CommitmentRecord | null>(null);
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

      const [
        commitmentsRes,
        paymentsRes,
        finRes,
        finInstRes,
        accountsRes,
        subaccountsRes,
      ] = await Promise.all([
        supabase
          .from("commitments")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("commitment_payments")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("financing")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
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

      if (commitmentsRes.error) throw commitmentsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (finRes.error) throw finRes.error;
      if (finInstRes.error) throw finInstRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;

      const rawSubs = subaccountsRes.data || [];
      const rawFinRows = finRes.data || [];
      const rawFinInstRows = finInstRes.data || [];

      const holdByCardAccount = new Map<string, number>();
      rawFinRows.forEach((f) => {
        if (f.status === "active" && f.account_id) {
          const planInsts = rawFinInstRows.filter(
            (i) => i.financing_id === f.financing_id
          );
          const paidSum = planInsts
            .filter((i) => i.status === "paid")
            .reduce((s, i) => s + Number(i.amount_paid), 0);
          const unpaidForPlan =
            planInsts.length > 0
              ? Math.max(
                  round2(Math.max(0, Number(f.total_amount) - paidSum)),
                  round2(
                    planInsts
                      .filter((i) => i.status === "pending")
                      .reduce((s, i) => s + Number(i.amount_due), 0)
                  )
                )
              : round2(Math.max(0, Number(f.total_amount)));
          const prev = holdByCardAccount.get(f.account_id) || 0;
          holdByCardAccount.set(f.account_id, round2(prev + unpaidForPlan));
        }
      });

      const mergedAccounts: Account[] = (accountsRes.data || []).map((acc) => {
        const isCredit =
          Boolean(acc.is_credit_card) || acc.account_type === "Credit Card";
        return {
          account_id: acc.account_id,
          account_name: acc.account_name,
          account_type: acc.account_type,
          account_balance: Number(acc.account_balance),
          is_credit_card: isCredit,
          credit_limit:
            acc.credit_limit !== null && acc.credit_limit !== undefined
              ? Number(acc.credit_limit)
              : null,
          unpaid_financing_hold: holdByCardAccount.get(acc.account_id) || 0,
          is_active: acc.is_active,
          subaccounts: rawSubs
            .filter((s) => s.account_id === acc.account_id)
            .map((s) => ({
              subaccount_id: s.subaccount_id,
              account_id: s.account_id,
              subaccount_name: s.subaccount_name,
              subaccount_value: Number(s.subaccount_value),
              is_active: s.is_active,
            })),
        };
      });

      const mappedCommitments: CommitmentRecord[] = (
        commitmentsRes.data || []
      ).map((c) => ({
        commitment_id: c.commitment_id,
        user_id: c.user_id,
        commitment_name: c.commitment_name,
        commitment_description: c.commitment_description || null,
        commitment_category: c.commitment_category || "Other",
        monthly_amount: Number(c.monthly_amount),
        due_day: Number(c.due_day || 1),
        start_date: c.start_date,
        end_date: c.end_date || null,
        is_variable_amount: Boolean(c.is_variable_amount),
        is_active: c.is_active,
        created_at: c.created_at,
      }));

      const mappedPayments: CommitmentPaymentRecord[] = (
        paymentsRes.data || []
      ).map((p) => ({
        commitment_payment_id: p.commitment_payment_id,
        commitment_id: p.commitment_id,
        user_id: p.user_id,
        payment_year: Number(p.payment_year),
        payment_month: Number(p.payment_month),
        amount_due: Number(p.amount_due),
        amount_paid: Number(p.amount_paid),
        status: p.status as "paid" | "skipped",
        paid_at: p.paid_at || null,
        payment_notes: p.payment_notes || null,
        account_id: p.account_id || null,
        subaccount_id: p.subaccount_id || null,
        transaction_id: p.transaction_id || null,
        is_active: p.is_active,
      }));

      const rawFinInst: LinkedFinancingInstallment[] = (
        finInstRes.data || []
      ).map((row) => ({
        installment_id: row.installment_id,
        financing_id: row.financing_id,
        user_id: row.user_id,
        installment_number: Number(row.installment_number),
        due_date: row.due_date,
        amount_due: Number(row.amount_due),
        amount_paid: Number(row.amount_paid),
        status: row.status as "pending" | "paid",
        paid_at: row.paid_at || null,
        installment_notes: row.installment_notes || null,
        account_id: row.account_id || null,
        subaccount_id: row.subaccount_id || null,
        transaction_id: row.transaction_id || null,
        is_active: row.is_active,
      }));

      const mappedLinkedFinancing: LinkedFinancingPlan[] = (
        finRes.data || []
      )
        .filter((f) => Boolean(f.sync_to_commitments))
        .map((f) => ({
        financing_id: f.financing_id,
        user_id: f.user_id,
        financing_name: f.financing_name,
        financing_provider: f.financing_provider,
        financing_category: f.financing_category || "Other",
        total_amount: Number(f.total_amount),
        duration_months:
          f.duration_months !== null && f.duration_months !== undefined
            ? Number(f.duration_months)
            : null,
        start_date: f.start_date,
        sync_to_commitments: Boolean(f.sync_to_commitments),
        status: f.status as "active" | "settled",
        account_id: f.account_id || null,
        installments: rawFinInst.filter(
          (i) => i.financing_id === f.financing_id
        ),
      }));

      setAccounts(mergedAccounts);
      setCommitments(mappedCommitments);
      setPayments(mappedPayments);
      setLinkedFinancing(mappedLinkedFinancing);
    } catch (err: unknown) {
      showToast(
        getErrorMessage(err, "Failed to load commitments."),
        "danger"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Available Years from Database (only years present in database records, defaulting to currentYear if empty)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    commitments.forEach((c) => {
      const sy = parseInt(c.start_date.slice(0, 4), 10);
      const ey = c.end_date
        ? parseInt(c.end_date.slice(0, 4), 10)
        : currentYear;
      if (!isNaN(sy) && !isNaN(ey)) {
        const minY = Math.min(sy, ey);
        const maxY = Math.max(sy, ey);
        for (let y = minY; y <= maxY; y++) {
          yearSet.add(y);
        }
      } else if (!isNaN(sy)) {
        yearSet.add(sy);
      }
    });
    payments.forEach((p) => {
      if (!isNaN(p.payment_year)) {
        yearSet.add(p.payment_year);
      }
    });
    linkedFinancing.forEach((f) => {
      f.installments.forEach((inst) => {
        const iy = parseInt(inst.due_date.slice(0, 4), 10);
        if (!isNaN(iy)) yearSet.add(iy);
      });
    });
    if (yearSet.size === 0) {
      yearSet.add(currentYear);
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [commitments, payments, linkedFinancing, currentYear]);

  // Keep selectedYear synced to an available year in the database
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Lookup map for commitment payments: key = `${commitment_id}_${year}_${month}`
  const paymentMap = useMemo(() => {
    const map = new Map<string, CommitmentPaymentRecord>();
    payments.forEach((p) => {
      map.set(`${p.commitment_id}_${p.payment_year}_${p.payment_month}`, p);
    });
    return map;
  }, [payments]);

  // Helper to get financing installment for a given plan, year, and month (1..12)
  const getFinancingInstallmentForMonth = useCallback(
    (
      plan: LinkedFinancingPlan,
      year: number,
      month: number
    ): LinkedFinancingInstallment | null => {
      const ymPrefix = `${year}-${String(month).padStart(2, "0")}`;
      const matches = plan.installments.filter(
        (i) => i.due_date.slice(0, 7) === ymPrefix
      );
      if (matches.length === 0) return null;
      // Prefer pending if multiple exist in the same month, otherwise first
      return matches.find((m) => m.status === "pending") || matches[0];
    },
    []
  );

  // Summary metrics for the top 3 cards (in selectedYear)
  const summaryMetrics = useMemo(() => {
    let monthlyObligation = 0;
    let yearlyObligation = 0;
    let paidInSelectedYear = 0;
    let unpaidPastOrCurrentCount = 0;

    // 1. Standalone commitments
    commitments.forEach((c) => {
      if (isMonthApplicableForCommitment(c, selectedYear, currentMonth)) {
        monthlyObligation = round2(monthlyObligation + c.monthly_amount);
      }
      for (let m = 1; m <= 12; m++) {
        if (isMonthApplicableForCommitment(c, selectedYear, m)) {
          const rec = paymentMap.get(`${c.commitment_id}_${selectedYear}_${m}`);
          if (rec?.status === "skipped") {
            continue;
          }
          const monthExpected = rec ? rec.amount_due : c.monthly_amount;
          yearlyObligation = round2(yearlyObligation + monthExpected);

          if (rec?.status === "paid") {
            paidInSelectedYear = round2(paidInSelectedYear + rec.amount_paid);
          } else {
            const isPastOrCurrent =
              selectedYear < currentYear ||
              (selectedYear === currentYear && m <= currentMonth);
            if (isPastOrCurrent) {
              unpaidPastOrCurrentCount += 1;
            }
          }
        }
      }
    });

    // 2. Linked financing plans
    linkedFinancing.forEach((plan) => {
      const currMonthInst = getFinancingInstallmentForMonth(
        plan,
        selectedYear,
        currentMonth
      );
      if (currMonthInst) {
        monthlyObligation = round2(
          monthlyObligation + currMonthInst.amount_due
        );
      } else if (plan.installments.length === 0 && plan.status === "active") {
        // Flexible plan without month rows yet
        const fallbackMonthly =
          plan.duration_months && plan.duration_months > 0
            ? round2(plan.total_amount / plan.duration_months)
            : 0;
        monthlyObligation = round2(monthlyObligation + fallbackMonthly);
      }

      for (let m = 1; m <= 12; m++) {
        const inst = getFinancingInstallmentForMonth(plan, selectedYear, m);
        if (inst) {
          yearlyObligation = round2(yearlyObligation + inst.amount_due);
          if (inst.status === "paid") {
            paidInSelectedYear = round2(paidInSelectedYear + inst.amount_paid);
          } else {
            const isPastOrCurrent =
              selectedYear < currentYear ||
              (selectedYear === currentYear && m <= currentMonth);
            if (isPastOrCurrent) {
              unpaidPastOrCurrentCount += 1;
            }
          }
        }
      }
    });

    return {
      monthlyObligation,
      yearlyObligation,
      paidInSelectedYear,
      unpaidPastOrCurrentCount,
    };
  }, [
    commitments,
    linkedFinancing,
    paymentMap,
    selectedYear,
    currentMonth,
    currentYear,
    getFinancingInstallmentForMonth,
  ]);

  // Filtered rows for the table
  const filteredCommitments = useMemo(() => {
    if (categoryFilter === "Financing (Linked)") return [];
    return commitments.filter((c) => {
      if (categoryFilter !== "all" && c.commitment_category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = c.commitment_name.toLowerCase().includes(q);
        const matchDesc = (c.commitment_description || "")
          .toLowerCase()
          .includes(q);
        const matchCat = c.commitment_category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [commitments, categoryFilter, searchQuery]);

  const filteredLinkedFinancing = useMemo(() => {
    if (
      categoryFilter !== "all" &&
      categoryFilter !== "Financing (Linked)"
    ) {
      return [];
    }
    return linkedFinancing.filter((f) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = f.financing_name.toLowerCase().includes(q);
        const matchProv = f.financing_provider.toLowerCase().includes(q);
        const matchCat = f.financing_category.toLowerCase().includes(q);
        if (!matchName && !matchProv && !matchCat) return false;
      }
      return true;
    });
  }, [linkedFinancing, categoryFilter, searchQuery]);

  // Open Add Commitment Modal
  const handleOpenAddModal = () => {
    setEditingCommitment(null);
    setFormName("");
    setFormDescription("");
    setFormCategory("Housing");
    setFormAmountInput("");
    setFormDueDay("1");
    setFormStartMonth("1");
    setFormStartYear(String(selectedYear));
    setFormHasEndDate(false);
    setFormEndMonth("12");
    setFormEndYear(String(selectedYear));
    setFormVariableAmount(false);
    setCommitmentModalError(null);
    setCommitmentModalOpen(true);
  };

  // Open Edit Commitment Modal
  const handleOpenEditModal = (c: CommitmentRecord) => {
    setEditingCommitment(c);
    setFormName(c.commitment_name);
    setFormDescription(c.commitment_description || "");
    setFormCategory(
      COMMITMENT_CATEGORIES.includes(c.commitment_category)
        ? c.commitment_category
        : "Other"
    );
    setFormAmountInput(c.monthly_amount.toFixed(2));
    setFormDueDay(String(c.due_day || 1));

    const startParts = c.start_date.slice(0, 7).split("-");
    setFormStartYear(startParts[0] || String(currentYear));
    setFormStartMonth(String(parseInt(startParts[1] || "1", 10)));

    if (c.end_date) {
      const endParts = c.end_date.slice(0, 7).split("-");
      setFormHasEndDate(true);
      setFormEndYear(endParts[0] || String(currentYear));
      setFormEndMonth(String(parseInt(endParts[1] || "12", 10)));
    } else {
      setFormHasEndDate(false);
      setFormEndYear(String(currentYear));
      setFormEndMonth("12");
    }

    setFormVariableAmount(c.is_variable_amount);
    setCommitmentModalError(null);
    setCommitmentModalOpen(true);
  };

  // Save (Create / Edit) Standalone Commitment
  const handleSaveCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setCommitmentModalError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setCommitmentModalError("Please enter a commitment name.");
      return;
    }

    const monthlyAmt = round2(parseFloat(formAmountInput || "0"));
    if (isNaN(monthlyAmt) || monthlyAmt <= 0) {
      setCommitmentModalError(
        "Please enter a monthly amount greater than RM 0.00."
      );
      return;
    }

    const dueDayNum = parseInt(formDueDay || "1", 10);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      setCommitmentModalError("Due day must be between 1 and 31.");
      return;
    }

    const startMonthNum = parseInt(formStartMonth || "1", 10);
    const startYearNum = parseInt(formStartYear || String(currentYear), 10);
    if (
      isNaN(startMonthNum) ||
      startMonthNum < 1 ||
      startMonthNum > 12 ||
      isNaN(startYearNum) ||
      startYearNum < 2000 ||
      startYearNum > 2100
    ) {
      setCommitmentModalError("Please enter a valid start month (1–12) and year.");
      return;
    }

    const startDateStr = `${startYearNum}-${String(startMonthNum).padStart(
      2,
      "0"
    )}-01`;

    let endDateStr: string | null = null;
    if (formHasEndDate) {
      const endMonthNum = parseInt(formEndMonth || "12", 10);
      const endYearNum = parseInt(formEndYear || String(currentYear), 10);
      if (
        isNaN(endMonthNum) ||
        endMonthNum < 1 ||
        endMonthNum > 12 ||
        isNaN(endYearNum)
      ) {
        setCommitmentModalError("Please enter a valid end month and year.");
        return;
      }
      endDateStr = `${endYearNum}-${String(endMonthNum).padStart(2, "0")}-01`;
      if (endDateStr < startDateStr) {
        setCommitmentModalError("End date cannot be earlier than start date.");
        return;
      }
    }

    setSavingCommitment(true);
    try {
      if (!editingCommitment) {
        const { error } = await supabase.from("commitments").insert({
          user_id: userId,
          commitment_name: trimmedName,
          commitment_description: formDescription.trim() || null,
          commitment_category: formCategory,
          monthly_amount: monthlyAmt,
          due_day: dueDayNum,
          start_date: startDateStr,
          end_date: endDateStr,
          is_variable_amount: formVariableAmount,
        });
        if (error) throw error;

        setCommitmentModalOpen(false);
        await fetchData();
        showToast(`Commitment "${trimmedName}" added.`);
      } else {
        const { error } = await supabase
          .from("commitments")
          .update({
            commitment_name: trimmedName,
            commitment_description: formDescription.trim() || null,
            commitment_category: formCategory,
            monthly_amount: monthlyAmt,
            due_day: dueDayNum,
            start_date: startDateStr,
            end_date: endDateStr,
            is_variable_amount: formVariableAmount,
          })
          .eq("commitment_id", editingCommitment.commitment_id)
          .eq("user_id", userId);
        if (error) throw error;

        setCommitmentModalOpen(false);
        await fetchData();
        showToast(`Commitment "${trimmedName}" updated.`);
      }
    } catch (err: unknown) {
      setCommitmentModalError(
        getErrorMessage(err, "Failed to save commitment.")
      );
    } finally {
      setSavingCommitment(false);
    }
  };

  // Click handler for a Standalone Commitment month cell
  const handleClickCommitmentCell = (c: CommitmentRecord, month: number) => {
    if (!isMonthApplicableForCommitment(c, selectedYear, month)) return;
    const existing =
      paymentMap.get(`${c.commitment_id}_${selectedYear}_${month}`) || null;
    const dueDateStr = buildDueDateForYearMonth(
      selectedYear,
      month,
      c.due_day || 1
    );
    const defaultAmt = existing ? existing.amount_due : c.monthly_amount;
    const defaultAccount = accounts[0] || null;

    setActiveCellTarget({
      rowKind: "commitment",
      title: c.commitment_name,
      subtitle: `${MONTH_FULL_LABELS[month - 1]} ${selectedYear} · Due ${formatDisplayDate(
        dueDateStr
      )}`,
      year: selectedYear,
      month,
      dueDateStr,
      defaultAmountDue: defaultAmt,
      isPaid: existing?.status === "paid",
      isSkipped: existing?.status === "skipped",
      paidAmount: existing?.amount_paid || 0,
      paidAt: existing?.paid_at || null,
      notes: existing?.payment_notes || null,
      commitment: c,
      existingPayment: existing,
    });

    setCellPayDate(getTodayDateString());
    setCellAmountInput(defaultAmt.toFixed(2));
    setCellNotes(existing?.payment_notes || "");
    setCellReflectAccount(Boolean(defaultAccount));
    setCellAccountId(defaultAccount ? defaultAccount.account_id : "");
    setCellSubAccountId("");
    setCellModalError(null);
  };

  const nonCreditAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => !a.is_credit_card && a.account_type !== "Credit Card"
      ),
    [accounts]
  );

  // Click handler for a Linked Financing month cell
  const handleClickFinancingCell = (
    plan: LinkedFinancingPlan,
    month: number
  ) => {
    const inst = getFinancingInstallmentForMonth(plan, selectedYear, month);
    if (!inst) return;
    const defaultAccount = nonCreditAccounts[0] || null;

    setActiveCellTarget({
      rowKind: "financing",
      title: `${plan.financing_name} (${plan.financing_provider})`,
      subtitle: `${MONTH_FULL_LABELS[month - 1]} ${selectedYear} · Installment #${inst.installment_number
        } · Due ${formatDisplayDate(inst.due_date)}`,
      year: selectedYear,
      month,
      dueDateStr: inst.due_date,
      defaultAmountDue: inst.amount_due,
      isPaid: inst.status === "paid",
      isSkipped: false,
      paidAmount: inst.amount_paid,
      paidAt: inst.paid_at,
      notes: inst.installment_notes,
      financingPlan: plan,
      financingInstallment: inst,
    });

    setCellPayDate(getTodayDateString());
    setCellAmountInput(inst.amount_due.toFixed(2));
    setCellNotes(inst.installment_notes || "");
    setCellReflectAccount(Boolean(defaultAccount));
    setCellAccountId(defaultAccount ? defaultAccount.account_id : "");
    setCellSubAccountId("");
    setCellModalError(null);
  };

  const eligibleCellAccounts = useMemo(() => {
    if (activeCellTarget?.rowKind === "financing") {
      return nonCreditAccounts;
    }
    return accounts;
  }, [activeCellTarget, nonCreditAccounts, accounts]);

  const selectedCellAccount = useMemo(
    () =>
      eligibleCellAccounts.find((a) => a.account_id === cellAccountId) || null,
    [eligibleCellAccounts, cellAccountId]
  );

  // Confirm Mark Month Paid (for either Standalone Commitment OR Linked Financing)
  const handleConfirmCellMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !activeCellTarget) return;
    setCellModalError(null);

    const amountToPay = round2(parseFloat(cellAmountInput || "0"));
    if (isNaN(amountToPay) || amountToPay <= 0) {
      setCellModalError(
        "Please enter a valid payment amount greater than RM 0.00."
      );
      return;
    }

    if (!cellPayDate) {
      setCellModalError("Please select a payment date (DD-MM-YYYY).");
      return;
    }

    if (
      activeCellTarget.rowKind === "financing" &&
      activeCellTarget.financingInstallment &&
      activeCellTarget.financingPlan
    ) {
      const inst = activeCellTarget.financingInstallment;
      const plan = activeCellTarget.financingPlan;
      const alreadyPaidSum = round2(
        plan.installments
          .filter(
            (i) => i.installment_id !== inst.installment_id && i.status === "paid"
          )
          .reduce((sum, i) => sum + i.amount_paid, 0)
      );
      const pendingRemainingSum = round2(
        plan.installments
          .filter((i) => i.status === "pending")
          .reduce((sum, i) => sum + i.amount_due, 0)
      );
      const maxPayableForPlan = Math.max(
        inst.amount_due,
        round2(Math.max(0, plan.total_amount - alreadyPaidSum)),
        pendingRemainingSum
      );
      if (maxPayableForPlan > 0 && amountToPay > maxPayableForPlan + 0.001) {
        setCellModalError(
          `Payment amount (RM ${formatAmount(
            amountToPay
          )}) cannot exceed the total remaining balance of this financing plan (RM ${formatAmount(
            maxPayableForPlan
          )}). Note: Daily credit card swipes are paid separately via "+ Pay card" on the Accounts page.`
        );
        return;
      }
    }

    let chosenAccount: Account | null = null;
    let chosenSub: SubAccount | null = null;

    if (cellReflectAccount) {
      chosenAccount =
        eligibleCellAccounts.find((a) => a.account_id === cellAccountId) ||
        null;
      if (!chosenAccount) {
        setCellModalError(
          "Please select an account to deduct this payment from."
        );
        return;
      }
      if (
        activeCellTarget.rowKind === "financing" &&
        (chosenAccount.is_credit_card ||
          chosenAccount.account_type === "Credit Card")
      ) {
        setCellModalError(
          "Financing installments cannot be paid using a Credit Card. Please select a debit/bank/cash account."
        );
        return;
      }
      if (cellSubAccountId && !chosenAccount.is_credit_card) {
        chosenSub =
          chosenAccount.subaccounts.find(
            (s) => s.subaccount_id === cellSubAccountId
          ) || null;
      }
      const available = getAvailableBalance(chosenAccount, cellSubAccountId);
      if (amountToPay > available) {
        if (chosenAccount.is_credit_card) {
          setCellModalError(
            `Amount exceeds available credit limit on ${chosenAccount.account_name}. Available limit: RM ${formatAmount(available)}.`
          );
        } else {
          setCellModalError(
            `Insufficient balance in ${chosenSub
              ? `${chosenAccount.account_name} (${chosenSub.subaccount_name})`
              : chosenAccount.account_name
            }. Available: RM ${formatAmount(available)}.`
          );
        }
        return;
      }
    }

    setCellSaving(true);
    try {
      let createdTxId: string | null = null;

      if (cellReflectAccount && chosenAccount) {
        const newAccBal = round2(chosenAccount.account_balance - amountToPay);
        const { error: accErr } = await supabase
          .from("accounts")
          .update({ account_balance: newAccBal })
          .eq("account_id", chosenAccount.account_id)
          .eq("user_id", userId);
        if (accErr) throw accErr;

        if (chosenSub) {
          const newSubBal = round2(chosenSub.subaccount_value - amountToPay);
          const { error: subErr } = await supabase
            .from("subaccounts")
            .update({ subaccount_value: newSubBal })
            .eq("subaccount_id", chosenSub.subaccount_id)
            .eq("user_id", userId);
          if (subErr) throw subErr;
        }

        const isFin = activeCellTarget.rowKind === "financing";
        const txDescription = isFin
          ? `${activeCellTarget.title} — Installment #${activeCellTarget.financingInstallment?.installment_number}`
          : `${activeCellTarget.title} (${MONTH_FULL_LABELS[activeCellTarget.month - 1]
          } ${activeCellTarget.year})`;

        const { data: txRow, error: txErr } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: chosenAccount.account_id,
            subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
            transaction_type: "expense",
            amount: amountToPay,
            description: txDescription,
            expense_category: isFin
              ? FINANCING_EXPENSE_CATEGORY
              : COMMITMENT_EXPENSE_CATEGORY,
            income_category: null,
            transaction_date: cellPayDate,
            transaction_time: getCurrentTimeString(),
            is_active: true,
          })
          .select("transaction_id")
          .single();

        if (txErr) throw txErr;
        createdTxId = txRow?.transaction_id || null;
      }

      if (
        activeCellTarget.rowKind === "commitment" &&
        activeCellTarget.commitment
      ) {
        if (activeCellTarget.existingPayment) {
          const { error: updErr } = await supabase
            .from("commitment_payments")
            .update({
              amount_due: amountToPay,
              amount_paid: amountToPay,
              status: "paid",
              paid_at: cellPayDate,
              payment_notes: cellNotes.trim() || null,
              account_id: chosenAccount ? chosenAccount.account_id : null,
              subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
              transaction_id: createdTxId,
              is_active: true,
            })
            .eq(
              "commitment_payment_id",
              activeCellTarget.existingPayment.commitment_payment_id
            )
            .eq("user_id", userId);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from("commitment_payments")
            .insert({
              commitment_id: activeCellTarget.commitment.commitment_id,
              user_id: userId,
              payment_year: activeCellTarget.year,
              payment_month: activeCellTarget.month,
              amount_due: amountToPay,
              amount_paid: amountToPay,
              status: "paid",
              paid_at: cellPayDate,
              payment_notes: cellNotes.trim() || null,
              account_id: chosenAccount ? chosenAccount.account_id : null,
              subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
              transaction_id: createdTxId,
              is_active: true,
            });
          if (insErr) throw insErr;
        }
      } else if (
        activeCellTarget.rowKind === "financing" &&
        activeCellTarget.financingInstallment &&
        activeCellTarget.financingPlan
      ) {
        const inst = activeCellTarget.financingInstallment;
        const plan = activeCellTarget.financingPlan;

        const { error: instErr } = await supabase
          .from("financing_installments")
          .update({
            status: "paid",
            amount_paid: amountToPay,
            paid_at: cellPayDate,
            installment_notes: cellNotes.trim() || null,
            account_id: chosenAccount ? chosenAccount.account_id : null,
            subaccount_id: chosenSub ? chosenSub.subaccount_id : null,
            transaction_id: createdTxId,
          })
          .eq("installment_id", inst.installment_id)
          .eq("user_id", userId);

        if (instErr) throw instErr;

        // Forward-cascade any overpayment across subsequent pending installments
        const sortedSubsequentPending = plan.installments
          .filter(
            (i) =>
              i.installment_id !== inst.installment_id && i.status === "pending"
          )
          .sort((a, b) => {
            if (a.installment_number !== b.installment_number) {
              return a.installment_number - b.installment_number;
            }
            return a.due_date.localeCompare(b.due_date);
          });

        let excess = round2(Math.max(0, amountToPay - inst.amount_due));
        const cascadedPaidIds = new Set<string>();

        if (excess > 0 && sortedSubsequentPending.length > 0) {
          for (const nextInst of sortedSubsequentPending) {
            if (excess <= 0) break;
            const currentDue = round2(nextInst.amount_due);
            if (currentDue <= 0) continue;

            if (excess >= currentDue) {
              excess = round2(excess - currentDue);
              cascadedPaidIds.add(nextInst.installment_id);
              const tag = `Settled early via Installment #${inst.installment_number} [Cascaded from #${inst.installment_number}: RM ${currentDue.toFixed(2)}]`;
              const updatedNotes = nextInst.installment_notes
                ? `${nextInst.installment_notes} | ${tag}`
                : tag;

              const { error: cascErr } = await supabase
                .from("financing_installments")
                .update({
                  status: "paid",
                  amount_due: 0.0,
                  amount_paid: 0.0,
                  paid_at: cellPayDate,
                  installment_notes: updatedNotes,
                })
                .eq("installment_id", nextInst.installment_id)
                .eq("user_id", userId);
              if (cascErr) throw cascErr;
            } else {
              const reducedDue = round2(currentDue - excess);
              const tag = `Reduced by RM ${formatAmount(excess)} from Installment #${inst.installment_number} [Cascaded from #${inst.installment_number}: RM ${excess.toFixed(2)}]`;
              const updatedNotes = nextInst.installment_notes
                ? `${nextInst.installment_notes} | ${tag}`
                : tag;
              excess = 0;

              const { error: partErr } = await supabase
                .from("financing_installments")
                .update({
                  amount_due: reducedDue,
                  installment_notes: updatedNotes,
                })
                .eq("installment_id", nextInst.installment_id)
                .eq("user_id", userId);
              if (partErr) throw partErr;
            }
          }
        }

        const remainingPending = sortedSubsequentPending.filter(
          (i) => !cascadedPaidIds.has(i.installment_id)
        );
        const totalPaidAfter = round2(
          plan.installments
            .filter(
              (i) =>
                i.installment_id !== inst.installment_id && i.status === "paid"
            )
            .reduce((sum, i) => sum + i.amount_paid, 0) + amountToPay
        );
        const newPlanTotal = Math.max(plan.total_amount, totalPaidAfter);
        const shouldSettle =
          (newPlanTotal > 0 && totalPaidAfter >= newPlanTotal) ||
          (remainingPending.length === 0 &&
            newPlanTotal > 0 &&
            totalPaidAfter >= newPlanTotal);

        if (shouldSettle && remainingPending.length > 0) {
          for (const remInst of remainingPending) {
            const tag = `Settled early via Installment #${inst.installment_number} [Cascaded from #${inst.installment_number}: RM ${remInst.amount_due.toFixed(2)}]`;
            const updatedNotes = remInst.installment_notes
              ? `${remInst.installment_notes} | ${tag}`
              : tag;
            await supabase
              .from("financing_installments")
              .update({
                status: "paid",
                amount_due: 0.0,
                amount_paid: 0.0,
                paid_at: cellPayDate,
                installment_notes: updatedNotes,
              })
              .eq("installment_id", remInst.installment_id)
              .eq("user_id", userId);
          }
        }

        await supabase
          .from("financing")
          .update({
            total_amount: newPlanTotal,
            status: shouldSettle ? "settled" : "active",
          })
          .eq("financing_id", plan.financing_id)
          .eq("user_id", userId);
      }

      const label = `${activeCellTarget.title} (${MONTH_FULL_LABELS[activeCellTarget.month - 1]
        } ${activeCellTarget.year})`;
      setActiveCellTarget(null);
      await fetchData();
      showToast(`${label} marked as paid (RM ${formatAmount(amountToPay)}).`);
    } catch (err: unknown) {
      setCellModalError(
        getErrorMessage(err, "Failed to update payment status.")
      );
    } finally {
      setCellSaving(false);
    }
  };

  // Mark a Standalone Commitment Month as Skipped / Waived
  const handleCellSkipMonth = async () => {
    if (
      !userId ||
      !activeCellTarget ||
      activeCellTarget.rowKind !== "commitment" ||
      !activeCellTarget.commitment
    ) {
      return;
    }
    setCellModalError(null);
    setCellSaving(true);
    try {
      if (activeCellTarget.existingPayment) {
        const { error } = await supabase
          .from("commitment_payments")
          .update({
            amount_due: 0,
            amount_paid: 0,
            status: "skipped",
            paid_at: null,
            payment_notes: cellNotes.trim() || "Skipped / Waived",
            account_id: null,
            subaccount_id: null,
            transaction_id: null,
            is_active: true,
          })
          .eq(
            "commitment_payment_id",
            activeCellTarget.existingPayment.commitment_payment_id
          )
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commitment_payments").insert({
          commitment_id: activeCellTarget.commitment.commitment_id,
          user_id: userId,
          payment_year: activeCellTarget.year,
          payment_month: activeCellTarget.month,
          amount_due: 0,
          amount_paid: 0,
          status: "skipped",
          paid_at: null,
          payment_notes: cellNotes.trim() || "Skipped / Waived",
          is_active: true,
        });
        if (error) throw error;
      }

      const label = `${activeCellTarget.title} (${MONTH_FULL_LABELS[activeCellTarget.month - 1]
        } ${activeCellTarget.year})`;
      setActiveCellTarget(null);
      await fetchData();
      showToast(`${label} marked as skipped.`);
    } catch (err: unknown) {
      setCellModalError(getErrorMessage(err, "Failed to skip month."));
    } finally {
      setCellSaving(false);
    }
  };

  // Revert a Paid / Skipped Month Cell back to Unpaid
  const handleCellMarkUnpaid = async () => {
    if (!userId || !activeCellTarget) return;
    setCellModalError(null);
    setCellSaving(true);

    try {
      if (
        activeCellTarget.rowKind === "commitment" &&
        activeCellTarget.existingPayment
      ) {
        const payRec = activeCellTarget.existingPayment;

        if (payRec.account_id && payRec.amount_paid > 0) {
          const linkedAcc = accounts.find(
            (a) => a.account_id === payRec.account_id
          );
          if (linkedAcc) {
            if (
              linkedAcc.is_credit_card &&
              round2(linkedAcc.account_balance + payRec.amount_paid) > 0.001
            ) {
              const currentOwed = Math.abs(
                Math.min(0, linkedAcc.account_balance)
              );
              setCellModalError(
                `Cannot revert this commitment payment because "${
                  linkedAcc.account_name
                }" currently only owes RM ${formatAmount(
                  currentOwed
                )} (the card balance was already paid down). Cancel the Credit Card Payment transaction first.`
              );
              setCellSaving(false);
              return;
            }
            await supabase
              .from("accounts")
              .update({
                account_balance: round2(
                  linkedAcc.account_balance + payRec.amount_paid
                ),
              })
              .eq("account_id", linkedAcc.account_id)
              .eq("user_id", userId);

            if (payRec.subaccount_id) {
              const linkedSub = linkedAcc.subaccounts.find(
                (s) => s.subaccount_id === payRec.subaccount_id
              );
              if (linkedSub) {
                await supabase
                  .from("subaccounts")
                  .update({
                    subaccount_value: round2(
                      linkedSub.subaccount_value + payRec.amount_paid
                    ),
                  })
                  .eq("subaccount_id", linkedSub.subaccount_id)
                  .eq("user_id", userId);
              }
            }
          }
        }

        if (payRec.transaction_id) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .eq("transaction_id", payRec.transaction_id)
            .eq("user_id", userId);
        }

        const { error } = await supabase
          .from("commitment_payments")
          .update({ is_active: false })
          .eq("commitment_payment_id", payRec.commitment_payment_id)
          .eq("user_id", userId);
        if (error) throw error;
      } else if (
        activeCellTarget.rowKind === "financing" &&
        activeCellTarget.financingInstallment &&
        activeCellTarget.financingPlan
      ) {
        const inst = activeCellTarget.financingInstallment;
        const plan = activeCellTarget.financingPlan;

        if (plan.account_id && inst.amount_paid > 0) {
          const linkedCard = accounts.find(
            (a) => a.account_id === plan.account_id && a.is_credit_card
          );
          if (linkedCard) {
            const availCardLimit = getAvailableBalance(linkedCard, "");
            if (inst.amount_paid > availCardLimit + 0.001) {
              setCellModalError(
                `Cannot revert this installment to unpaid because restoring RM ${formatAmount(
                  inst.amount_paid
                )} to the financing hold would exceed ${
                  linkedCard.account_name
                }'s remaining available credit limit (RM ${formatAmount(
                  availCardLimit
                )}). Pay down the card's swipe balance first.`
              );
              setCellSaving(false);
              return;
            }
          }
        }

        if (inst.account_id && inst.amount_paid > 0) {
          const linkedAcc = accounts.find(
            (a) => a.account_id === inst.account_id
          );
          if (linkedAcc) {
            await supabase
              .from("accounts")
              .update({
                account_balance: round2(
                  linkedAcc.account_balance + inst.amount_paid
                ),
              })
              .eq("account_id", linkedAcc.account_id)
              .eq("user_id", userId);

            if (inst.subaccount_id) {
              const linkedSub = linkedAcc.subaccounts.find(
                (s) => s.subaccount_id === inst.subaccount_id
              );
              if (linkedSub) {
                await supabase
                  .from("subaccounts")
                  .update({
                    subaccount_value: round2(
                      linkedSub.subaccount_value + inst.amount_paid
                    ),
                  })
                  .eq("subaccount_id", linkedSub.subaccount_id)
                  .eq("user_id", userId);
              }
            }
          }
        }

        if (inst.transaction_id) {
          await supabase
            .from("transactions")
            .update({ is_active: false })
            .eq("transaction_id", inst.transaction_id)
            .eq("user_id", userId);
        }

        const { error } = await supabase
          .from("financing_installments")
          .update({
            status: "pending",
            amount_paid: 0.0,
            paid_at: null,
            account_id: null,
            subaccount_id: null,
            transaction_id: null,
          })
          .eq("installment_id", inst.installment_id)
          .eq("user_id", userId);
        if (error) throw error;

        // Reverse any cascaded overpayment adjustments tagged with [Cascaded from #X: RM Y]
        const cascadeRegex = new RegExp(
          `(?:\\s*\\|\\s*)?(?:Settled early via Installment #${inst.installment_number}\\s*|Reduced by RM [0-9,.]+ from Installment #${inst.installment_number}\\s*)?\\[Cascaded from #${inst.installment_number}: RM ([0-9.]+)\\]`
        );
        for (const sibling of plan.installments) {
          if (sibling.installment_id === inst.installment_id) continue;
          const notes = sibling.installment_notes || "";
          const match = notes.match(cascadeRegex);
          if (match) {
            const restoredAmt = round2(parseFloat(match[1] || "0"));
            const cleanedNotes = notes.replace(cascadeRegex, "").trim() || null;
            const restoredDue = round2(sibling.amount_due + restoredAmt);
            await supabase
              .from("financing_installments")
              .update({
                status: sibling.amount_paid > 0 ? "paid" : "pending",
                amount_due: restoredDue,
                paid_at: sibling.amount_paid > 0 ? sibling.paid_at : null,
                installment_notes: cleanedNotes,
              })
              .eq("installment_id", sibling.installment_id)
              .eq("user_id", userId);
          }
        }

        await supabase
          .from("financing")
          .update({ status: "active" })
          .eq("financing_id", plan.financing_id)
          .eq("user_id", userId);
      }

      const label = `${activeCellTarget.title} (${MONTH_FULL_LABELS[activeCellTarget.month - 1]
        } ${activeCellTarget.year})`;
      setActiveCellTarget(null);
      await fetchData();
      showToast(`${label} reverted to unpaid.`);
    } catch (err: unknown) {
      setCellModalError(getErrorMessage(err, "Failed to revert payment."));
    } finally {
      setCellSaving(false);
    }
  };

  // Confirm Delete Standalone Commitment
  const handleConfirmDeleteCommitment = async () => {
    if (!userId || !deletingCommitment) return;
    setDeleteError(null);
    setDeletingLoading(true);
    try {
      const { error } = await supabase
        .from("commitments")
        .update({ is_active: false })
        .eq("commitment_id", deletingCommitment.commitment_id)
        .eq("user_id", userId);
      if (error) throw error;

      setDeletingCommitment(null);
      await fetchData();
      showToast(`Commitment "${deletingCommitment.commitment_name}" deleted.`);
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, "Failed to delete commitment."));
    } finally {
      setDeletingLoading(false);
    }
  };

  const totalRowsCount =
    filteredCommitments.length + filteredLinkedFinancing.length;

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Monthly commitments</h1>
          <p className="page-subtitle mb-3">
            Rent, installments, insurance, utilities and recurring payments
          </p>
        </div>
        <div className="pt-1">
          <AddButton onClick={handleOpenAddModal}>Add commitment</AddButton>
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
                Monthly obligation
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#1a2e23",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryMetrics.monthlyObligation)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                {commitments.length + linkedFinancing.length === 0
                  ? "No active commitments"
                  : `${commitments.length} recurring · ${linkedFinancing.length} linked financing`}
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
                className="bi bi-calendar2-week"
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
                Yearly obligation
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#1a2e23",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryMetrics.yearlyObligation)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#8b9d90",
                  marginTop: "6px",
                }}
              >
                Total scheduled for {selectedYear}
              </div>
            </div>
            <div
              className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{
                width: 44,
                height: 44,
                backgroundColor: "#eef2ff",
                color: "#1d4ed8",
              }}
            >
              <i
                className="bi bi-calendar3"
                style={{ fontSize: "1.1rem" }}
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
                Paid in {selectedYear}
              </div>
              <div
                style={{
                  fontSize: "1.65rem",
                  fontWeight: 700,
                  color: "#16a34a",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(summaryMetrics.paidInSelectedYear)}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color:
                    summaryMetrics.unpaidPastOrCurrentCount > 0
                      ? "#dc2626"
                      : "#8b9d90",
                  fontWeight:
                    summaryMetrics.unpaidPastOrCurrentCount > 0 ? 600 : 400,
                  marginTop: "6px",
                }}
              >
                {summaryMetrics.unpaidPastOrCurrentCount > 0 ? (
                  <>
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    {summaryMetrics.unpaidPastOrCurrentCount} unpaid due{" "}
                    {summaryMetrics.unpaidPastOrCurrentCount === 1
                      ? "month"
                      : "months"}
                  </>
                ) : (
                  "All due months up to date"
                )}
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
      </div>

      {/* Filter & Search Bar (Year Dropdown + Search + Category Dropdown) */}
      <div
        style={{
          ...panelStyle,
          padding: "14px 18px",
          marginBottom: "24px",
        }}
      >
        <div className="row g-3 align-items-center justify-content-between">
          {/* Left: Year Dropdown */}
          <div className="col-12 col-sm-auto">
            <div className="d-flex align-items-center gap-2">
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#4a5d52",
                  whiteSpace: "nowrap",
                }}
              >
                Year:
              </span>
              <select
                className="form-select fintrack-modal-input"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  width: "auto",
                  minWidth: "120px",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Search & Category Filter */}
          <div className="col-12 col-lg-7">
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
                    placeholder="Search commitment, description or provider..."
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
                  {COMMITMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Financing (Linked)">Financing (Linked)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Jan–Dec Commitments Grid Table */}
      {loading ? (
        <div
          className="text-center py-5"
          style={{ ...panelStyle, color: "#6b7f72", fontSize: "0.88rem" }}
        >
          <div
            className="spinner-border spinner-border-sm me-2"
            role="status"
          />
          Loading monthly commitments...
        </div>
      ) : totalRowsCount === 0 ? (
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
            <i className="bi bi-calendar-check" />
          </div>
          <h3
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#1a2e23",
              marginBottom: "4px",
            }}
          >
            {commitments.length + linkedFinancing.length === 0
              ? "No commitments yet"
              : "No commitments match your filters"}
          </h3>
          <p
            style={{
              fontSize: "0.82rem",
              color: "#6b7f72",
              marginBottom: 0,
            }}
          >
            {commitments.length + linkedFinancing.length === 0
              ? 'Click "+ Add commitment" to add recurring bills like House Rent, My50 TnG, Insurance or link a plan from the Financing page.'
              : "Try a different search or category filter."}
          </p>
        </div>
      ) : (
        <div
          style={{
            ...panelStyle,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              className="table mb-0 align-middle"
              style={{ minWidth: "960px", borderCollapse: "separate", borderSpacing: 0 }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f6f8f6",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: "#6b7f72",
                    textTransform: "uppercase",
                  }}
                >
                  <th
                    style={{
                      padding: "13px 20px",
                      borderBottom: "1px solid #eef2ed",
                      minWidth: "240px",
                    }}
                  >
                    Commitment
                  </th>
                  <th
                    style={{
                      padding: "13px 16px",
                      borderBottom: "1px solid #eef2ed",
                      textAlign: "right",
                      minWidth: "120px",
                    }}
                  >
                    Monthly
                  </th>
                  {MONTH_SHORT_LABELS.map((mLabel) => (
                    <th
                      key={mLabel}
                      style={{
                        padding: "13px 6px",
                        borderBottom: "1px solid #eef2ed",
                        textAlign: "center",
                        width: "46px",
                      }}
                    >
                      {mLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 1. Standalone Commitment Rows */}
                {filteredCommitments.map((c) => (
                  <tr key={c.commitment_id}>
                    <td
                      style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid #f1f5f2",
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.88rem",
                              color: "#1a2e23",
                            }}
                          >
                            {c.commitment_name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#7b8f82",
                              marginTop: "1px",
                            }}
                          >
                            {c.commitment_description || c.commitment_category}
                            {" · "}Due day {c.due_day}
                          </div>
                        </div>

                        <div className="d-inline-flex align-items-center gap-2">
                          <button
                            type="button"
                            title="Edit commitment"
                            onClick={() => handleOpenEditModal(c)}
                            className="btn btn-sm text-secondary p-0 border-0"
                          >
                            <i
                              className="bi bi-pencil"
                              style={{ fontSize: "0.85rem" }}
                            />
                          </button>
                          <button
                            type="button"
                            title="Delete commitment"
                            onClick={() => {
                              setDeletingCommitment(c);
                              setDeleteError(null);
                            }}
                            className="btn btn-sm text-danger p-0 border-0"
                          >
                            <i
                              className="bi bi-trash3"
                              style={{ fontSize: "0.85rem" }}
                            />
                          </button>
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #f1f5f2",
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        color: "#1a2e23",
                        whiteSpace: "nowrap",
                      }}
                    >
                      RM {formatAmount(c.monthly_amount)}
                    </td>

                    {MONTH_SHORT_LABELS.map((_, idx) => {
                      const monthNum = idx + 1;
                      const applicable = isMonthApplicableForCommitment(
                        c,
                        selectedYear,
                        monthNum
                      );
                      const payRec = paymentMap.get(
                        `${c.commitment_id}_${selectedYear}_${monthNum}`
                      );
                      const isPaid = payRec?.status === "paid";
                      const isSkipped = payRec?.status === "skipped";
                      const isPastOrCurrent =
                        selectedYear < currentYear ||
                        (selectedYear === currentYear &&
                          monthNum <= currentMonth);

                      if (!applicable) {
                        return (
                          <td
                            key={monthNum}
                            style={{
                              padding: "10px 6px",
                              borderBottom: "1px solid #f1f5f2",
                              textAlign: "center",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                width: "32px",
                                height: "32px",
                                borderRadius: "9px",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#cbd5ce",
                                fontSize: "0.75rem",
                              }}
                            >
                              —
                            </span>
                          </td>
                        );
                      }

                      let cellBg = "#eef3ef";
                      let cellColor = "#7b8f82";
                      let cellContent: React.ReactNode = "·";

                      if (isPaid) {
                        cellBg = "#1f9d55";
                        cellColor = "#ffffff";
                        cellContent = <i className="bi bi-check2" style={{ fontSize: "1rem", fontWeight: 700 }} />;
                      } else if (isSkipped) {
                        cellBg = "#e2e8f0";
                        cellColor = "#475569";
                        cellContent = "–";
                      } else if (isPastOrCurrent) {
                        cellBg = "#fce8e8";
                        cellColor = "#e11d48";
                        cellContent = "·";
                      }

                      return (
                        <td
                          key={monthNum}
                          style={{
                            padding: "10px 6px",
                            borderBottom: "1px solid #f1f5f2",
                            textAlign: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleClickCommitmentCell(c, monthNum)
                            }
                            title={`${c.commitment_name} — ${MONTH_FULL_LABELS[monthNum - 1]
                              } ${selectedYear}: ${isPaid
                                ? `Paid RM ${formatAmount(
                                  payRec?.amount_paid || 0
                                )} on ${formatDisplayDate(payRec?.paid_at)}`
                                : isSkipped
                                  ? "Skipped / Waived"
                                  : `RM ${formatAmount(
                                    c.monthly_amount
                                  )} (Click to update)`
                              }`}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "9px",
                              border: "none",
                              backgroundColor: cellBg,
                              color: cellColor,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.95rem",
                              cursor: "pointer",
                              transition: "transform 0.12s ease",
                            }}
                          >
                            {cellContent}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* 2. Linked Financing Rows (Update-Only on Commitments Page) */}
                {filteredLinkedFinancing.map((plan) => {
                  const firstInst = plan.installments[0] || null;
                  const monthlyDisplay = firstInst
                    ? firstInst.amount_due
                    : plan.duration_months && plan.duration_months > 0
                      ? round2(plan.total_amount / plan.duration_months)
                      : plan.total_amount;

                  return (
                    <tr key={`fin_${plan.financing_id}`}>
                      <td
                        style={{
                          padding: "14px 20px",
                          borderBottom: "1px solid #f1f5f2",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "0.88rem",
                                  color: "#1a2e23",
                                }}
                              >
                                {plan.financing_name}
                              </span>
                              <span
                                style={{
                                  backgroundColor: "#173f8f",
                                  color: "#ffffff",
                                  borderRadius: "999px",
                                  padding: "2px 9px",
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <i className="bi bi-link-45deg" />
                                Linked
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#7b8f82",
                                marginTop: "1px",
                              }}
                            >
                              {plan.duration_months !== null
                                ? `${plan.duration_months}-month ${plan.financing_category.toLowerCase()} plan · ${plan.financing_provider
                                }`
                                : `Flexible ${plan.financing_category.toLowerCase()} plan · ${plan.financing_provider
                                }`}
                            </div>
                          </div>

                          <Link
                            href="/financing"
                            title="Edit or manage schedule in Financing page"
                            style={{
                              backgroundColor: "#f9fbf5",
                              border: "1px solid #e2ebe4",
                              borderRadius: "7px",
                              padding: "3px 8px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: "#2e4738",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Manage →
                          </Link>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #f1f5f2",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: "0.86rem",
                          color: "#1a2e23",
                          whiteSpace: "nowrap",
                        }}
                      >
                        RM {formatAmount(monthlyDisplay)}
                      </td>

                      {MONTH_SHORT_LABELS.map((_, idx) => {
                        const monthNum = idx + 1;
                        const inst = getFinancingInstallmentForMonth(
                          plan,
                          selectedYear,
                          monthNum
                        );

                        if (!inst) {
                          return (
                            <td
                              key={monthNum}
                              style={{
                                padding: "10px 6px",
                                borderBottom: "1px solid #f1f5f2",
                                textAlign: "center",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "9px",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#cbd5ce",
                                  fontSize: "0.75rem",
                                }}
                              >
                                —
                              </span>
                            </td>
                          );
                        }

                        const isPaid = inst.status === "paid";
                        const isPastOrCurrent =
                          selectedYear < currentYear ||
                          (selectedYear === currentYear &&
                            monthNum <= currentMonth);

                        let cellBg = "#eef3ef";
                        let cellColor = "#7b8f82";
                        let cellContent: React.ReactNode = "·";

                        if (isPaid) {
                          cellBg = "#1f9d55";
                          cellColor = "#ffffff";
                          cellContent = (
                            <i
                              className="bi bi-check2"
                              style={{ fontSize: "1rem", fontWeight: 700 }}
                            />
                          );
                        } else if (isPastOrCurrent) {
                          cellBg = "#fce8e8";
                          cellColor = "#e11d48";
                          cellContent = "·";
                        }

                        return (
                          <td
                            key={monthNum}
                            style={{
                              padding: "10px 6px",
                              borderBottom: "1px solid #f1f5f2",
                              textAlign: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleClickFinancingCell(plan, monthNum)
                              }
                              title={`${plan.financing_name} — Installment #${inst.installment_number
                                } (Due ${formatDisplayDate(inst.due_date)}): ${isPaid
                                  ? `Paid RM ${formatAmount(
                                    inst.amount_paid
                                  )} on ${formatDisplayDate(inst.paid_at)}`
                                  : `RM ${formatAmount(
                                    inst.amount_due
                                  )} (Click to update)`
                                }`}
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "9px",
                                border: "none",
                                backgroundColor: cellBg,
                                color: cellColor,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                cursor: "pointer",
                                transition: "transform 0.12s ease",
                              }}
                            >
                              {cellContent}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ADD / EDIT MONTHLY COMMITMENT
      ===================================================================== */}
      <Modal
        open={commitmentModalOpen}
        onCancel={() => !savingCommitment && setCommitmentModalOpen(false)}
        footer={null}
        centered
        width={480}
        className="fintrack-Account-Modal"
        title={
          <span
            style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1a2e23" }}
          >
            {editingCommitment
              ? "Edit monthly commitment"
              : "Add monthly commitment"}
          </span>
        }
      >
        <form onSubmit={handleSaveCommitment} style={{ marginTop: "14px" }}>
          {commitmentModalError && (
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
              {commitmentModalError}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fintrack-modal-label">Name</label>
            <input
              type="text"
              className="form-control fintrack-modal-input"
              placeholder="e.g. House Rent, My50 TnG Pass, Family Takaful"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>

          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-7">
              <label className="form-label fintrack-modal-label">
                Description
              </label>
              <input
                type="text"
                className="form-control fintrack-modal-input"
                placeholder="e.g. 3-bedroom condo, Shah Alam"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="col-12 col-sm-5">
              <label className="form-label fintrack-modal-label">
                Category
              </label>
              <select
                className="form-select fintrack-modal-input"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {COMMITMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Monthly amount (RM)
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="form-control fintrack-modal-input"
                placeholder="1800.00"
                value={formAmountInput}
                onChange={(e) =>
                  setFormAmountInput(formatCentsInput(e.target.value))
                }
                required
              />
            </div>

            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Start month (1–12)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                className="form-control fintrack-modal-input"
                value={formStartMonth}
                onChange={(e) => setFormStartMonth(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Start year
              </label>
              <input
                type="number"
                min={2000}
                max={2100}
                className="form-control fintrack-modal-input"
                value={formStartYear}
                onChange={(e) => setFormStartYear(e.target.value)}
                required
              />
            </div>

            <div className="col-12 col-sm-6">
              <label className="form-label fintrack-modal-label">
                Due day of month (1–31)
              </label>
              <input
                type="number"
                min={1}
                max={31}
                className="form-control fintrack-modal-input"
                value={formDueDay}
                onChange={(e) => setFormDueDay(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-2">
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                style={checkboxInputStyle}
                checked={formHasEndDate}
                onChange={(e) => setFormHasEndDate(e.target.checked)}
              />
              <span>Set an end month &amp; year (for fixed-term contracts)</span>
            </label>
          </div>

          {formHasEndDate && (
            <div className="row g-2 mb-3">
              <div className="col-12 col-sm-6">
                <label className="form-label fintrack-modal-label">
                  End month (1–12)
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="form-control fintrack-modal-input"
                  value={formEndMonth}
                  onChange={(e) => setFormEndMonth(e.target.value)}
                  required
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label fintrack-modal-label">
                  End year
                </label>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  className="form-control fintrack-modal-input"
                  value={formEndYear}
                  onChange={(e) => setFormEndYear(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button
              className="fintrack-modal-cancel-btn"
              onClick={() => setCommitmentModalOpen(false)}
              disabled={savingCommitment}
            >
              Cancel
            </Button>
            <Button
              htmlType="submit"
              className="fintrack-modal-primary-btn"
              loading={savingCommitment}
            >
              {editingCommitment ? "Save changes" : "Add commitment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 2: UPDATE MONTH CELL PAYMENT (MARK PAID / UNPAID / SKIPPED)
      ===================================================================== */}
      <Modal
        open={Boolean(activeCellTarget)}
        onCancel={() => !cellSaving && setActiveCellTarget(null)}
        footer={null}
        centered
        width={480}
        className="fintrack-Account-Modal"
        title={
          <span
            style={{ fontWeight: 700, fontSize: "1.02rem", color: "#1a2e23" }}
          >
            {activeCellTarget?.isPaid || activeCellTarget?.isSkipped
              ? "Monthly payment details"
              : "Update monthly payment"}
          </span>
        }
      >
        {activeCellTarget && (
          <div style={{ marginTop: "12px" }}>
            {cellModalError && (
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
                {cellModalError}
              </div>
            )}

            {/* Header Info Box */}
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
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ fontWeight: 700, color: "#1a2e23" }}>
                  {activeCellTarget.title}
                </span>
                {activeCellTarget.rowKind === "financing" && (
                  <span
                    style={{
                      backgroundColor: "#173f8f",
                      color: "#ffffff",
                      borderRadius: "999px",
                      padding: "2px 9px",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                    }}
                  >
                    Linked Financing
                  </span>
                )}
              </div>
              <div style={{ color: "#6b7f72", marginTop: "2px" }}>
                {activeCellTarget.subtitle}
              </div>
            </div>

            {activeCellTarget.isPaid || activeCellTarget.isSkipped ? (
              <div>
                <div
                  style={{
                    backgroundColor: activeCellTarget.isPaid
                      ? "#f0fdf4"
                      : "#f8fafc",
                    border: activeCellTarget.isPaid
                      ? "1px solid #bbf7d0"
                      : "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    marginBottom: "16px",
                    fontSize: "0.82rem",
                  }}
                >
                  {activeCellTarget.isPaid ? (
                    <>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#15803d",
                          marginBottom: "4px",
                        }}
                      >
                        <i className="bi bi-check-circle-fill me-1" />
                        Paid RM {formatAmount(activeCellTarget.paidAmount)}
                      </div>
                      <div style={{ color: "#4b6355", fontSize: "0.78rem" }}>
                        Paid on {formatDisplayDate(activeCellTarget.paidAt)}
                        {activeCellTarget.notes
                          ? ` · ${activeCellTarget.notes}`
                          : ""}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontWeight: 600, color: "#475569" }}>
                      Marked as Skipped / Waived
                    </div>
                  )}
                </div>

                <p style={{ fontSize: "0.78rem", color: "#6b7f72" }}>
                  Need to undo this update? Clicking{" "}
                  <strong>Mark as unpaid</strong> will revert this month to
                  unpaid, cancel any linked expense transaction, and refund your
                  account balance.
                </p>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <Button
                    className="fintrack-modal-cancel-btn"
                    onClick={() => setActiveCellTarget(null)}
                    disabled={cellSaving}
                  >
                    Close
                  </Button>
                  <Button
                    className="fintrack-modal-danger-btn"
                    onClick={handleCellMarkUnpaid}
                    loading={cellSaving}
                  >
                    Mark as unpaid
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmCellMarkPaid}>
                <div className="row g-2 mb-3">
                  <div className="col-12 col-sm-6">
                    <label className="form-label fintrack-modal-label">
                      Amount paid (RM)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control fintrack-modal-input"
                      value={cellAmountInput}
                      onChange={(e) =>
                        setCellAmountInput(formatCentsInput(e.target.value))
                      }
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label fintrack-modal-label">
                      Payment date (DD-MM-YYYY)
                    </label>
                    <DateInputDDMMYYYY
                      value={cellPayDate}
                      onChange={setCellPayDate}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fintrack-modal-label">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    className="form-control fintrack-modal-input"
                    placeholder="e.g. Paid via FPX / JomPAY"
                    value={cellNotes}
                    onChange={(e) => setCellNotes(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      style={checkboxInputStyle}
                      checked={cellReflectAccount}
                      onChange={(e) => setCellReflectAccount(e.target.checked)}
                    />
                    <span>
                      Deduct from Account &amp; record in Transactions automatically
                    </span>
                  </label>
                </div>

                {cellReflectAccount && (
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
                        Pay from account
                      </label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={cellAccountId}
                        onChange={(e) => {
                          setCellAccountId(e.target.value);
                          setCellSubAccountId("");
                        }}
                        required
                      >
                        <option value="">Select account...</option>
                        {eligibleCellAccounts.map((acc) => (
                          <option key={acc.account_id} value={acc.account_id}>
                            {acc.account_name} (
                            {acc.is_credit_card
                              ? `Available Limit: RM ${formatAmount(getAvailableBalance(acc, ""))}`
                              : `Available: RM ${formatAmount(getAvailableBalance(acc, ""))}`}
                            )
                          </option>
                        ))}
                      </select>
                      {activeCellTarget.rowKind === "financing" && (
                        <div
                          style={{
                            fontSize: "0.71rem",
                            color: "#6b7f72",
                            marginTop: "4px",
                          }}
                        >
                          Credit cards are excluded for financing installment
                          repayments.
                        </div>
                      )}
                    </div>

                    {selectedCellAccount &&
                      !selectedCellAccount.is_credit_card &&
                      selectedCellAccount.subaccounts.length > 0 && (
                        <div className="mb-2">
                          <label className="form-label fintrack-modal-label">
                            Sub-account (optional)
                          </label>
                          <select
                            className="form-select fintrack-modal-input"
                            value={cellSubAccountId}
                            onChange={(e) =>
                              setCellSubAccountId(e.target.value)
                            }
                          >
                            <option value="">
                              Unallocated (RM{" "}
                              {formatAmount(
                                getUnallocated(selectedCellAccount)
                              )}
                              )
                            </option>
                            {selectedCellAccount.subaccounts.map((sub) => (
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

                    {selectedCellAccount &&
                      parseFloat(cellAmountInput || "0") > 0 && (
                        <div
                          className="d-flex justify-content-between align-items-center pt-2 mt-2"
                          style={{
                            borderTop: "1px solid #e2ebe4",
                            fontSize: "0.76rem",
                            color: "#2e4738",
                          }}
                        >
                          <span>
                            {selectedCellAccount.is_credit_card
                              ? "Card balance impact:"
                              : "Balance impact:"}
                          </span>
                          <strong>
                            {selectedCellAccount.is_credit_card ? (
                              <>
                                {formatSignedRM(
                                  selectedCellAccount.account_balance
                                )}{" "}
                                →{" "}
                                {formatSignedRM(
                                  round2(
                                    selectedCellAccount.account_balance -
                                      parseFloat(cellAmountInput || "0")
                                  )
                                )}
                              </>
                            ) : (
                              <>
                                RM{" "}
                                {formatAmount(
                                  getAvailableBalance(
                                    selectedCellAccount,
                                    cellSubAccountId
                                  )
                                )}{" "}
                                →{" "}
                                {formatSignedRM(
                                  round2(
                                    getAvailableBalance(
                                      selectedCellAccount,
                                      cellSubAccountId
                                    ) - parseFloat(cellAmountInput || "0")
                                  )
                                )}
                              </>
                            )}
                          </strong>
                        </div>
                      )}
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 fintrack-modal-split-actions">
                  {activeCellTarget.rowKind === "commitment" ? (
                    <button
                      type="button"
                      onClick={handleCellSkipMonth}
                      disabled={cellSaving}
                      style={{
                        backgroundColor: "#f9fbf5",
                        border: "1px solid #e2ebe4",
                        borderRadius: "10px",
                        padding: "6px 12px",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        color: "#4b6355",
                        cursor: "pointer",
                      }}
                    >
                      Skip / waive month
                    </button>
                  ) : (
                    <span className="d-none d-sm-inline" />
                  )}

                  <div className="d-flex gap-2">
                    <Button
                      className="fintrack-modal-cancel-btn"
                      onClick={() => setActiveCellTarget(null)}
                      disabled={cellSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      htmlType="submit"
                      className="fintrack-modal-primary-btn"
                      loading={cellSaving}
                    >
                      Mark paid
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL 3: DELETE COMMITMENT CONFIRMATION
      ===================================================================== */}
      <Modal
        open={Boolean(deletingCommitment)}
        onCancel={() => !deletingLoading && setDeletingCommitment(null)}
        footer={null}
        centered
        width={430}
        className="fintrack-Account-Modal"
        title={
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a2e23" }}>
            Delete commitment?
          </span>
        }
      >
        {deletingCommitment && (
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
              <strong>{deletingCommitment.commitment_name}</strong> (RM{" "}
              {formatAmount(deletingCommitment.monthly_amount)}/mo)?
            </p>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setDeletingCommitment(null)}
                disabled={deletingLoading}
              >
                Cancel
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmDeleteCommitment}
                loading={deletingLoading}
              >
                Delete
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
