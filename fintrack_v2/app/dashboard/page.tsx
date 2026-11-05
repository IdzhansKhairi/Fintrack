"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { createClient } from "@/utils/supabase/client";
import BottomToast, { BottomToastType } from "@/components/BottomToast";

// =============================================================================
// 1. TYPE DEFINITIONS
// =============================================================================

interface AccountRecord {
  account_id: string;
  account_name: string;
  account_type: string;
  account_balance: number;
  color: string | null;
  is_active: boolean;
}

interface TransactionRecord {
  transaction_id: string;
  account_id: string;
  transaction_type: "income" | "expense";
  amount: number;
  description: string | null;
  expense_category: string | null;
  income_category: string | null;
  transaction_date: string; // YYYY-MM-DD
  transaction_time: string | null;
  created_at?: string;
}

interface CommitmentRecord {
  commitment_id: string;
  commitment_name: string;
  commitment_description: string | null;
  commitment_category: string;
  monthly_amount: number;
  due_day: number | null;
  start_date: string | null;
  end_date: string | null;
  is_variable_amount: boolean;
  is_active: boolean;
}

interface CommitmentPaymentRecord {
  commitment_payment_id: string;
  commitment_id: string;
  payment_year: number;
  payment_month: number; // 1..12
  amount_due: number;
  amount_paid: number | null;
  status: "paid" | "skipped";
}

interface FinancingRecord {
  financing_id: string;
  financing_name: string;
  financing_provider: string;
  financing_category: string;
  sync_to_commitments: boolean;
  status: "active" | "settled";
  is_active: boolean;
}

interface FinancingInstallmentRecord {
  installment_id: string;
  financing_id: string;
  installment_number: number;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
  amount_paid: number | null;
  status: "pending" | "paid";
}

interface DebtRecord {
  debts_id: string;
  debts_type: "lent" | "borrowed";
  debts_name: string;
  debts_person: string;
  debts_amount: number;
  debts_date: string;
  debts_due_date: string | null;
  status: "pending" | "settled";
}

interface TabungRecord {
  tabung_id: string;
  tabung_name: string;
  tabung_purpose: string | null;
  tabung_held_at: string | null;
  tabung_target_amount: number;
  tabung_target_date: string | null;
  color: string | null;
}

interface TabungContributionRecord {
  tabung_contribution_id: string;
  tabung_id: string;
  contribution_type: "deposit" | "withdrawal";
  amount: number;
}

interface DashboardCommitmentItem {
  id: string;
  name: string;
  subtitle: string;
  amount: number;
  status: "Unpaid" | "Paid" | "Skipped";
  dueDay: number;
}

// =============================================================================
// 2. HELPER FUNCTIONS
// =============================================================================

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatRM(value: number): string {
  return Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts YYYY-MM-DD into DD-MM-YYYY for display across the UI.
 */
function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function getAccountTypeIcon(type: string): string {
  switch (type) {
    case "Bank":
      return "bi-wallet2";
    case "E-Wallet":
      return "bi-phone";
    case "Credit Card":
      return "bi-credit-card-2-front";
    case "Cash":
      return "bi-cash-stack";
    case "Retirement":
      return "bi-piggy-bank";
    case "Investment":
      return "bi-graph-up-arrow";
    default:
      return "bi-wallet2";
  }
}

/**
 * Checks whether a given (year, month 1..12) falls within a commitment's start_date..end_date window.
 */
function isMonthApplicableForCommitment(
  commitment: CommitmentRecord,
  year: number,
  month: number
): boolean {
  const targetYm = year * 100 + month;

  if (commitment.start_date) {
    const [sy, sm] = commitment.start_date.split("-").map(Number);
    if (sy && sm) {
      const startYm = sy * 100 + sm;
      if (targetYm < startYm) return false;
    }
  }

  if (commitment.end_date) {
    const [ey, em] = commitment.end_date.split("-").map(Number);
    if (ey && em) {
      const endYm = ey * 100 + em;
      if (targetYm > endYm) return false;
    }
  }

  return true;
}

// =============================================================================
// 3. SHARED STYLES
// =============================================================================

const panelCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #eef2ed",
  padding: "22px 24px",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
};

const actionLinkStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#69a980",
  textDecoration: "none",
};

// =============================================================================
// 4. MAIN DASHBOARD PAGE COMPONENT
// =============================================================================

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState<boolean>(true);
  const [userName, setUserName] = useState<string>("there");

  // Raw data states
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [commitments, setCommitments] = useState<CommitmentRecord[]>([]);
  const [commitmentPayments, setCommitmentPayments] = useState<CommitmentPaymentRecord[]>([]);
  const [financings, setFinancings] = useState<FinancingRecord[]>([]);
  const [financingInstallments, setFinancingInstallments] = useState<
    FinancingInstallmentRecord[]
  >([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [tabungs, setTabungs] = useState<TabungRecord[]>([]);
  const [tabungContributions, setTabungContributions] = useState<
    TabungContributionRecord[]
  >([]);

  // Toast notification state
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type: BottomToastType;
  } | null>(null);

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================
  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          if (isMounted) setLoading(false);
          return;
        }

        const now = new Date();
        const currentYear = now.getFullYear();

        const [
          profileRes,
          accountsRes,
          txRes,
          commitmentsRes,
          commitmentPaymentsRes,
          financingRes,
          financingInstRes,
          debtsRes,
          tabungRes,
          tabungContribRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("accounts")
            .select(
              "account_id, account_name, account_type, account_balance, color, is_active"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("transactions")
            .select(
              "transaction_id, account_id, transaction_type, amount, description, expense_category, income_category, transaction_date, transaction_time, created_at"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("transaction_date", { ascending: false })
            .order("transaction_time", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("commitments")
            .select(
              "commitment_id, commitment_name, commitment_description, commitment_category, monthly_amount, due_day, start_date, end_date, is_variable_amount, is_active"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("commitment_payments")
            .select(
              "commitment_payment_id, commitment_id, payment_year, payment_month, amount_due, amount_paid, status"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .eq("payment_year", currentYear),
          supabase
            .from("financing")
            .select(
              "financing_id, financing_name, financing_provider, financing_category, sync_to_commitments, status, is_active"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .eq("status", "active"),
          supabase
            .from("financing_installments")
            .select(
              "installment_id, financing_id, installment_number, due_date, amount_due, amount_paid, status"
            )
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase
            .from("debts")
            .select(
              "debts_id, debts_type, debts_name, debts_person, debts_amount, debts_date, debts_due_date, status"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .eq("status", "pending")
            .order("debts_due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("tabung")
            .select(
              "tabung_id, tabung_name, tabung_purpose, tabung_held_at, tabung_target_amount, tabung_target_date, color"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
          supabase
            .from("tabung_contributions")
            .select("tabung_contribution_id, tabung_id, contribution_type, amount")
            .eq("user_id", user.id)
            .eq("is_active", true),
        ]);

        if (!isMounted) return;

        // Resolve user display name
        const fullName =
          profileRes.data?.full_name?.trim() ||
          (typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "");
        const fallbackEmailName = user.email ? user.email.split("@")[0] : "there";
        setUserName(fullName ? fullName.split(" ")[0] : fallbackEmailName);

        if (accountsRes.data) setAccounts(accountsRes.data as AccountRecord[]);
        if (txRes.data) setTransactions(txRes.data as TransactionRecord[]);
        if (commitmentsRes.data)
          setCommitments(commitmentsRes.data as CommitmentRecord[]);
        if (commitmentPaymentsRes.data)
          setCommitmentPayments(
            commitmentPaymentsRes.data as CommitmentPaymentRecord[]
          );
        if (financingRes.data) setFinancings(financingRes.data as FinancingRecord[]);
        if (financingInstRes.data)
          setFinancingInstallments(
            financingInstRes.data as FinancingInstallmentRecord[]
          );
        if (debtsRes.data) setDebts(debtsRes.data as DebtRecord[]);
        if (tabungRes.data) setTabungs(tabungRes.data as TabungRecord[]);
        if (tabungContribRes.data)
          setTabungContributions(
            tabungContribRes.data as TabungContributionRecord[]
          );
      } catch (err) {
        console.error("Failed to load dashboard overview:", err);
        if (isMounted) {
          setToastInfo({
            message: "Failed to load some dashboard data. Please refresh.",
            type: "error",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // ===========================================================================
  // DERIVED METRICS & LISTS
  // ===========================================================================

  // 1. Current & Previous Month Keys (YYYY-MM)
  const { currentYmPrefix, prevYmPrefix, currentYear, currentMonth } = useMemo(() => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1; // 1..12
    const prevDate = new Date(cy, cm - 2, 1);
    const py = prevDate.getFullYear();
    const pm = prevDate.getMonth() + 1;

    return {
      currentYear: cy,
      currentMonth: cm,
      currentYmPrefix: `${cy}-${String(cm).padStart(2, "0")}`,
      prevYmPrefix: `${py}-${String(pm).padStart(2, "0")}`,
    };
  }, []);

  // 2. KPI Summary Metrics
  const kpiMetrics = useMemo(() => {
    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.account_balance || 0),
      0
    );

    let incomeThisMonth = 0;
    let expenseThisMonth = 0;
    let incomeLastMonth = 0;
    let expenseLastMonth = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount || 0);
      if (tx.transaction_date.startsWith(currentYmPrefix)) {
        if (tx.transaction_type === "income") incomeThisMonth += amt;
        else if (tx.transaction_type === "expense") expenseThisMonth += amt;
      } else if (tx.transaction_date.startsWith(prevYmPrefix)) {
        if (tx.transaction_type === "income") incomeLastMonth += amt;
        else if (tx.transaction_type === "expense") expenseLastMonth += amt;
      }
    }

    // Net cash flow change in the current month (Income - Expense)
    const netThisMonth = incomeThisMonth - expenseThisMonth;

    // Income % change vs last month (only valid if last month has recorded income > 0)
    let incomePctChange: number | null = null;
    if (incomeLastMonth > 0) {
      incomePctChange =
        ((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100;
    }

    // Expense % change vs last month (only valid if last month has recorded expense > 0)
    let expensePctChange: number | null = null;
    if (expenseLastMonth > 0) {
      expensePctChange =
        ((expenseThisMonth - expenseLastMonth) / expenseLastMonth) * 100;
    }

    return {
      totalBalance,
      netThisMonth,
      activeAccountCount: accounts.length,
      incomeThisMonth,
      expenseThisMonth,
      incomePctChange,
      expensePctChange,
    };
  }, [accounts, transactions, currentYmPrefix, prevYmPrefix]);

  // 3. Last 7 Months Cashflow Data for Recharts AreaChart
  const cashflowChartData = useMemo(() => {
    const now = new Date();
    const buckets: {
      ymPrefix: string;
      monthLabel: string;
      income: number;
      expense: number;
    }[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ymPrefix = `${y}-${String(m).padStart(2, "0")}`;
      buckets.push({
        ymPrefix,
        monthLabel: SHORT_MONTH_NAMES[d.getMonth()],
        income: 0,
        expense: 0,
      });
    }

    const bucketMap = new Map(buckets.map((b) => [b.ymPrefix, b]));

    for (const tx of transactions) {
      const ym = tx.transaction_date.slice(0, 7);
      const bucket = bucketMap.get(ym);
      if (bucket) {
        const amt = Number(tx.amount || 0);
        if (tx.transaction_type === "income") {
          bucket.income += amt;
        } else if (tx.transaction_type === "expense") {
          bucket.expense += amt;
        }
      }
    }

    return buckets.map((b) => ({
      monthLabel: b.monthLabel,
      income: Number(b.income.toFixed(2)),
      expense: Number(b.expense.toFixed(2)),
    }));
  }, [transactions]);

  // 4. Recent 6 Transactions (strictly capped at 6)
  const recentSixTransactions = useMemo(() => {
    return transactions.slice(0, 6);
  }, [transactions]);

  // 5. Upcoming Commitments for Current Month (Standalone Commitments + Synced Financing)
  const upcomingCommitmentsList = useMemo(() => {
    const items: DashboardCommitmentItem[] = [];

    // Map commitment_id -> payment record for current month
    const paymentByCommitmentId = new Map<string, CommitmentPaymentRecord>();
    for (const p of commitmentPayments) {
      if (
        p.payment_year === currentYear &&
        p.payment_month === currentMonth
      ) {
        paymentByCommitmentId.set(p.commitment_id, p);
      }
    }

    // 5A. Standalone active commitments applicable this month
    for (const c of commitments) {
      if (!isMonthApplicableForCommitment(c, currentYear, currentMonth)) {
        continue;
      }
      const payment = paymentByCommitmentId.get(c.commitment_id);
      let status: "Unpaid" | "Paid" | "Skipped" = "Unpaid";
      let amount = Number(c.monthly_amount || 0);

      if (payment) {
        if (payment.status === "paid") {
          status = "Paid";
          amount = Number(payment.amount_paid ?? payment.amount_due ?? amount);
        } else if (payment.status === "skipped") {
          status = "Skipped";
        }
      }

      items.push({
        id: `commitment-${c.commitment_id}`,
        name: c.commitment_name,
        subtitle:
          c.commitment_description?.trim() || c.commitment_category || "Monthly commitment",
        amount,
        status,
        dueDay: c.due_day || 31,
      });
    }

    // 5B. Synced active financing plans with an installment due in current YYYY-MM
    const syncedFinancingMap = new Map<string, FinancingRecord>();
    for (const f of financings) {
      if (f.sync_to_commitments && f.status === "active") {
        syncedFinancingMap.set(f.financing_id, f);
      }
    }

    for (const inst of financingInstallments) {
      if (!inst.due_date || !inst.due_date.startsWith(currentYmPrefix)) continue;
      const parentPlan = syncedFinancingMap.get(inst.financing_id);
      if (!parentPlan) continue;

      const isPaid = inst.status === "paid";
      const amount = isPaid
        ? Number(inst.amount_paid ?? inst.amount_due ?? 0)
        : Number(inst.amount_due || 0);
      const dueDay = Number(inst.due_date.split("-")[2]) || 31;

      items.push({
        id: `financing-inst-${inst.installment_id}`,
        name: parentPlan.financing_name,
        subtitle: `${parentPlan.financing_provider} · Installment #${inst.installment_number}`,
        amount,
        status: isPaid ? "Paid" : "Unpaid",
        dueDay,
      });
    }

    // Sort: Unpaid first, then by dueDay ascending, then Paid/Skipped
    const statusOrder: Record<"Unpaid" | "Paid" | "Skipped", number> = {
      Unpaid: 0,
      Paid: 1,
      Skipped: 2,
    };

    items.sort((a, b) => {
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.dueDay - b.dueDay;
    });

    return items;
  }, [
    commitments,
    commitmentPayments,
    financings,
    financingInstallments,
    currentYear,
    currentMonth,
    currentYmPrefix,
  ]);

  // 6. Tabung Savings Funds Progress
  const savingsFundsProgress = useMemo(() => {
    const netSavedMap = new Map<string, number>();

    for (const contrib of tabungContributions) {
      const current = netSavedMap.get(contrib.tabung_id) || 0;
      const amt = Number(contrib.amount || 0);
      if (contrib.contribution_type === "deposit") {
        netSavedMap.set(contrib.tabung_id, current + amt);
      } else if (contrib.contribution_type === "withdrawal") {
        netSavedMap.set(contrib.tabung_id, current - amt);
      }
    }

    return tabungs.map((t) => {
      const savedAmount = Math.max(0, netSavedMap.get(t.tabung_id) || 0);
      const targetAmount = Number(t.tabung_target_amount || 0);
      const rawPct = targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;
      const pctReached = Math.round(rawPct);

      return {
        ...t,
        savedAmount,
        targetAmount,
        pctReached,
        barWidthPct: Math.min(100, Math.max(0, rawPct)),
      };
    });
  }, [tabungs, tabungContributions]);

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const renderTrendComparison = (
    pctChange: number | null,
    type: "balance" | "income" | "expense"
  ) => {
    if (pctChange === null || !Number.isFinite(pctChange)) {
      return (
        <div
          className="d-flex align-items-center gap-1 mt-2"
          style={{ fontSize: "0.78rem" }}
        >
          <span style={{ color: "#8b9d90", fontWeight: 500 }}>
            No prior month baseline
          </span>
        </div>
      );
    }

    const isPositiveChange = pctChange >= 0;
    const formattedPct = `${isPositiveChange ? "+" : ""}${pctChange.toFixed(1)}%`;

    // For expenses, an increase is highlighted in red (matching screenshot: `↘ +3.1% vs last month`)
    let badgeColor = "#16a34a";
    let arrowIcon = "bi-arrow-up-right";

    if (type === "expense") {
      if (isPositiveChange) {
        badgeColor = "#dc2626";
        arrowIcon = "bi-arrow-down-right";
      } else {
        badgeColor = "#16a34a";
        arrowIcon = "bi-arrow-down-right";
      }
    } else {
      if (isPositiveChange) {
        badgeColor = "#16a34a";
        arrowIcon = "bi-arrow-up-right";
      } else {
        badgeColor = "#dc2626";
        arrowIcon = "bi-arrow-down-right";
      }
    }

    return (
      <div
        className="d-flex align-items-center gap-1 mt-2"
        style={{ fontSize: "0.78rem" }}
      >
        <i
          className={`bi ${arrowIcon}`}
          style={{ color: badgeColor, fontSize: "0.82rem", fontWeight: 700 }}
        />
        <span style={{ color: badgeColor, fontWeight: 700 }}>{formattedPct}</span>
        <span style={{ color: "#6b7f72", fontWeight: 500 }}>vs last month</span>
      </div>
    );
  };

  // ===========================================================================
  // MAIN JSX
  // ===========================================================================
  return (
    <div className="container-fluid p-0" style={{ paddingBottom: "40px" }}>
      {/* =====================================================================
          HEADER: Welcome back & Financial overview
      ====================================================================== */}
      <div className="mb-4">
        <p
          className="mb-1"
          style={{
            fontSize: "0.88rem",
            color: "#6b7f72",
            fontWeight: 500,
          }}
        >
          Welcome back, {userName}
        </p>
        <h2
          className="fw-bold mb-0"
          style={{
            color: "#1a2e23",
            letterSpacing: "-0.5px",
            fontSize: "1.75rem",
          }}
        >
          Financial overview
        </h2>
      </div>

      {/* =====================================================================
          ROW 1: 3 KPI SUMMARY CARDS
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* KPI 1: Total Balance */}
        <div className="col-12 col-md-4">
          <div
            style={{
              ...panelCardStyle,
              padding: "20px 24px",
              height: "100%",
            }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Total balance
                </div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  RM {formatRM(kpiMetrics.totalBalance)}
                </div>
              </div>
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: "#e6f4ea",
                  color: "#3e8e5e",
                  fontSize: "1.1rem",
                }}
              >
                <i className="bi bi-wallet2" />
              </div>
            </div>
            <div
              className="d-flex align-items-center gap-1 mt-2"
              style={{ fontSize: "0.78rem" }}
            >
              {kpiMetrics.netThisMonth !== 0 ? (
                <>
                  <i
                    className={`bi ${
                      kpiMetrics.netThisMonth > 0
                        ? "bi-arrow-up-right"
                        : "bi-arrow-down-right"
                    }`}
                    style={{
                      color:
                        kpiMetrics.netThisMonth > 0 ? "#16a34a" : "#dc2626",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                    }}
                  />
                  <span
                    style={{
                      color:
                        kpiMetrics.netThisMonth > 0 ? "#16a34a" : "#dc2626",
                      fontWeight: 700,
                    }}
                  >
                    {kpiMetrics.netThisMonth > 0 ? "+ " : "- "}RM{" "}
                    {formatRM(Math.abs(kpiMetrics.netThisMonth))}
                  </span>
                  <span style={{ color: "#6b7f72", fontWeight: 500 }}>
                    net cash flow this month
                  </span>
                </>
              ) : (
                <span style={{ color: "#6b7f72", fontWeight: 500 }}>
                  Across {kpiMetrics.activeAccountCount} active{" "}
                  {kpiMetrics.activeAccountCount === 1 ? "account" : "accounts"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Income This Month */}
        <div className="col-12 col-md-4">
          <div
            style={{
              ...panelCardStyle,
              padding: "20px 24px",
              height: "100%",
            }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Income this month
                </div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  RM {formatRM(kpiMetrics.incomeThisMonth)}
                </div>
              </div>
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: "#e6f4ea",
                  color: "#3e8e5e",
                  fontSize: "1.1rem",
                }}
              >
                <i className="bi bi-graph-up-arrow" />
              </div>
            </div>
            {renderTrendComparison(kpiMetrics.incomePctChange, "income")}
          </div>
        </div>

        {/* KPI 3: Expenses This Month */}
        <div className="col-12 col-md-4">
          <div
            style={{
              ...panelCardStyle,
              padding: "20px 24px",
              height: "100%",
            }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "#6b7f72",
                    fontWeight: 500,
                    marginBottom: "6px",
                  }}
                >
                  Expenses this month
                </div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  RM {formatRM(kpiMetrics.expenseThisMonth)}
                </div>
              </div>
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  fontSize: "1.1rem",
                }}
              >
                <i className="bi bi-graph-down-arrow" />
              </div>
            </div>
            {renderTrendComparison(kpiMetrics.expensePctChange, "expense")}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 2: CASH FLOW GRAPH (8 COLS) + ACCOUNTS LIST (4 COLS)
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Left: Cash Flow (Last 7 Months) */}
        <div className="col-12 col-xl-8">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h5
                  className="fw-bold mb-0"
                  style={{ fontSize: "1.02rem", color: "#1a2e23" }}
                >
                  Cash flow
                </h5>
                <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                  Last 7 months (RM)
                </span>
              </div>

              {/* Legend */}
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#3e8e5e",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "#4b5e52",
                      fontWeight: 500,
                    }}
                  >
                    Income
                  </span>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#173f8f",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "#4b5e52",
                      fontWeight: 500,
                    }}
                  >
                    Expense
                  </span>
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: "290px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={cashflowChartData}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="dashboardIncomeGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3e8e5e" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#3e8e5e" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient
                      id="dashboardExpenseGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#173f8f" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#173f8f" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eef2ed"
                  />
                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7f72", fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7f72", fontSize: 12 }}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #eef2ed",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
                      fontSize: "0.82rem",
                      color: "#1a2e23",
                    }}
                    formatter={(value, name) => [
                      `RM ${formatRM(Number(value || 0))}`,
                      String(name || ""),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#3e8e5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#dashboardIncomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Expense"
                    stroke="#173f8f"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#dashboardExpenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Accounts List */}
        <div className="col-12 col-xl-4">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                Accounts
              </h5>
              <Link href="/accounts" style={actionLinkStyle}>
                View all
              </Link>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "220px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "220px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-wallet2 mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No accounts added yet
                </div>
                <Link
                  href="/accounts"
                  className="mt-2"
                  style={{ ...actionLinkStyle, fontSize: "0.8rem" }}
                >
                  + Add your first account
                </Link>
              </div>
            ) : (
              <div
                className="d-flex flex-column gap-2"
                style={{
                  maxHeight: "310px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {accounts.map((acc) => {
                  const bal = Number(acc.account_balance || 0);
                  const isNegative = bal < 0;
                  const badgeColor = acc.color || "#2563eb";

                  return (
                    <div
                      key={acc.account_id}
                      className="d-flex align-items-center justify-content-between"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        backgroundColor: "#f6f8f6",
                        borderRadius: "14px",
                        padding: "12px 15px",
                        border: "1px solid #eef2ed",
                      }}
                    >
                      <div
                        className="d-flex align-items-center gap-3"
                        style={{ minWidth: 0, flex: 1, marginRight: "12px" }}
                      >
                        <div
                          className="d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            backgroundColor: badgeColor,
                            color: "#ffffff",
                            fontSize: "0.95rem",
                          }}
                        >
                          <i className={`bi ${getAccountTypeIcon(acc.account_type)}`} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.86rem",
                              color: "#1a2e23",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={acc.account_name}
                          >
                            {acc.account_name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.74rem",
                              color: "#6b7f72",
                            }}
                          >
                            {acc.account_type}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isNegative ? (
                          <span
                            style={{
                              backgroundColor: "#fef2f2",
                              color: "#dc2626",
                              fontWeight: 700,
                              fontSize: "0.84rem",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            -RM {formatRM(Math.abs(bal))}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "#1a2e23",
                              fontWeight: 700,
                              fontSize: "0.86rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            RM {formatRM(bal)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 3: RECENT TRANSACTIONS (MAX 6) + UPCOMING COMMITMENTS (SCROLLABLE)
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Left: Recent Transactions (strictly capped at 6) */}
        <div className="col-12 col-xl-6">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                Recent transactions
              </h5>
              <Link href="/transaction" style={actionLinkStyle}>
                View all
              </Link>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "240px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading recent transactions...
              </div>
            ) : recentSixTransactions.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "240px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-arrow-left-right mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No transactions recorded yet
                </div>
                <Link
                  href="/transaction"
                  className="mt-2"
                  style={{ ...actionLinkStyle, fontSize: "0.8rem" }}
                >
                  + Record a transaction
                </Link>
              </div>
            ) : (
              <div className="d-flex flex-column">
                {recentSixTransactions.map((tx, idx) => {
                  const isIncome = tx.transaction_type === "income";
                  const categoryLabel = isIncome
                    ? tx.income_category || "Income"
                    : tx.expense_category || "Expense";
                  const titleLabel = tx.description?.trim() || categoryLabel;
                  const isLast = idx === recentSixTransactions.length - 1;

                  return (
                    <div
                      key={tx.transaction_id}
                      className="d-flex align-items-center justify-content-between"
                      style={{
                        padding: "12px 2px",
                        borderBottom: isLast ? "none" : "1px solid #f0f4f1",
                      }}
                    >
                      <div
                        className="d-flex align-items-center gap-3"
                        style={{ minWidth: 0, flex: 1, marginRight: "12px" }}
                      >
                        <div
                          className="d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            backgroundColor: isIncome ? "#e6f4ea" : "#f1f5f3",
                            color: isIncome ? "#16a34a" : "#4b5e52",
                            fontSize: "0.95rem",
                          }}
                        >
                          <i
                            className={`bi ${
                              isIncome ? "bi-arrow-down-left" : "bi-arrow-up-right"
                            }`}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.87rem",
                              color: "#1a2e23",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {titleLabel}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#6b7f72",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {categoryLabel} · {formatDateDisplay(tx.transaction_date)}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex-shrink-0"
                        style={{
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: isIncome ? "#16a34a" : "#1a2e23",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isIncome ? "+ " : "- "}RM {formatRM(Number(tx.amount || 0))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Upcoming Commitments (Scrollable container so it never elongates the row) */}
        <div className="col-12 col-xl-6">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0 d-flex align-items-center gap-2"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                <i
                  className="bi bi-arrow-repeat"
                  style={{ color: "#3e8e5e", fontSize: "1.05rem" }}
                />
                <span>Upcoming commitments</span>
              </h5>
              <Link href="/commitments" style={actionLinkStyle}>
                Manage
              </Link>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "240px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading commitments...
              </div>
            ) : upcomingCommitmentsList.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "240px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-calendar2-check mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No commitments scheduled for this month
                </div>
                <Link
                  href="/commitments"
                  className="mt-2"
                  style={{ ...actionLinkStyle, fontSize: "0.8rem" }}
                >
                  + Manage commitments
                </Link>
              </div>
            ) : (
              <div
                className="d-flex flex-column gap-2"
                style={{
                  maxHeight: "380px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {upcomingCommitmentsList.map((item) => {
                  let pillBg = "#fef3c7";
                  let pillColor = "#92400e";

                  if (item.status === "Paid") {
                    pillBg = "#dcfce7";
                    pillColor = "#15803d";
                  } else if (item.status === "Skipped") {
                    pillBg = "#f1f5f9";
                    pillColor = "#64748b";
                  }

                  return (
                    <div
                      key={item.id}
                      className="d-flex align-items-center justify-content-between"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e6ece8",
                        borderRadius: "14px",
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                          marginRight: "14px",
                        }}
                      >
                        <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: "0.88rem",
                              color: "#1a2e23",
                              wordBreak: "break-word",
                            }}
                          >
                            {item.name}
                          </span>
                          <span
                            style={{
                              backgroundColor: pillBg,
                              color: pillColor,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              padding: "2px 9px",
                              borderRadius: "999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7f72",
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                          }}
                        >
                          {item.subtitle}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-end">
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            color: "#1a2e23",
                            whiteSpace: "nowrap",
                          }}
                        >
                          RM {formatRM(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 4: ACTIVE DEBTS (6 COLS) + SAVINGS FUNDS PROGRESS (6 COLS)
      ====================================================================== */}
      <div className="row g-3">
        {/* Left: Active Debts */}
        <div className="col-12 col-xl-6">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0 d-flex align-items-center gap-2"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                <i
                  className="bi bi-cash-coin"
                  style={{ color: "#3e8e5e", fontSize: "1.05rem" }}
                />
                <span>Active debts</span>
              </h5>
              <Link href="/debts" style={actionLinkStyle}>
                Manage
              </Link>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "220px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading active debts...
              </div>
            ) : debts.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "220px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-check2-circle mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No active pending debts
                </div>
                <Link
                  href="/debts"
                  className="mt-2"
                  style={{ ...actionLinkStyle, fontSize: "0.8rem" }}
                >
                  View debts log
                </Link>
              </div>
            ) : (
              <div
                className="d-flex flex-column gap-2"
                style={{
                  maxHeight: "340px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {debts.map((debt) => {
                  const isBorrowed = debt.debts_type === "borrowed";
                  const personLabel = debt.debts_person?.trim() || debt.debts_name;
                  const detailSuffix =
                    debt.debts_name &&
                    debt.debts_name.trim() !== personLabel
                      ? ` · ${debt.debts_name.trim()}`
                      : "";

                  return (
                    <div
                      key={debt.debts_id}
                      className="d-flex align-items-center justify-content-between"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        backgroundColor: "#f6f8f6",
                        borderRadius: "14px",
                        padding: "12px 16px",
                        border: "1px solid #eef2ed",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, marginRight: "12px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.88rem",
                            color: "#1a2e23",
                            wordBreak: "break-word",
                          }}
                        >
                          {personLabel}
                          {detailSuffix && (
                            <span
                              style={{
                                fontWeight: 500,
                                color: "#6b7f72",
                                fontSize: "0.82rem",
                              }}
                            >
                              {detailSuffix}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#6b7f72",
                          }}
                        >
                          {debt.debts_due_date
                            ? `Due ${formatDateDisplay(debt.debts_due_date)}`
                            : `Recorded ${formatDateDisplay(debt.debts_date)}`}
                        </div>
                      </div>

                      <div className="text-end flex-shrink-0">
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            color: isBorrowed ? "#dc2626" : "#16a34a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isBorrowed ? "- " : "+ "}RM{" "}
                          {formatRM(Number(debt.debts_amount || 0))}
                        </div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: "#8b9d90",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {isBorrowed ? "BORROWED" : "LENT"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Savings Funds Progress (Tabung) */}
        <div className="col-12 col-xl-6">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5
                className="fw-bold mb-0 d-flex align-items-center gap-2"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                <i
                  className="bi bi-piggy-bank"
                  style={{ color: "#3e8e5e", fontSize: "1.05rem" }}
                />
                <span>Savings funds progress</span>
              </h5>
              <Link href="/tabung" style={actionLinkStyle}>
                View all
              </Link>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "220px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading savings funds...
              </div>
            ) : savingsFundsProgress.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "220px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-piggy-bank mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No savings funds created yet
                </div>
                <Link
                  href="/tabung"
                  className="mt-2"
                  style={{ ...actionLinkStyle, fontSize: "0.8rem" }}
                >
                  + Create a Tabung fund
                </Link>
              </div>
            ) : (
              <div
                className="d-flex flex-column gap-3"
                style={{
                  maxHeight: "340px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {savingsFundsProgress.map((fund) => (
                  <div key={fund.tabung_id} style={{ width: "100%" }}>
                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                      <span
                        style={{
                          minWidth: 0,
                          flex: 1,
                          marginRight: "12px",
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          color: "#1a2e23",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fund.tabung_name}
                      </span>
                      <span
                        className="flex-shrink-0"
                        style={{
                          fontSize: "0.78rem",
                          color: "#6b7f72",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        RM {formatRM(fund.savedAmount)} / RM{" "}
                        {formatRM(fund.targetAmount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "7px",
                        backgroundColor: "#e6ece8",
                        borderRadius: "999px",
                        overflow: "hidden",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          width: `${fund.barWidthPct}%`,
                          height: "100%",
                          backgroundColor: fund.color || "#3e8e5e",
                          borderRadius: "999px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: "0.74rem",
                        color: "#6b7f72",
                      }}
                    >
                      {fund.pctReached}% reached
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Toast Notification */}
      <BottomToast
        open={Boolean(toastInfo)}
        message={toastInfo?.message || ""}
        type={toastInfo?.type || "error"}
        onClose={() => setToastInfo(null)}
      />
    </div>
  );
}
