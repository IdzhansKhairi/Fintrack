"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createClient } from "@/utils/supabase/client";
import BottomToast, { BottomToastType } from "@/components/BottomToast";

// =============================================================================
// 1. TYPE DEFINITIONS
// =============================================================================

type TimeframeMode = "weekly" | "monthly" | "yearly";

interface TransactionRecord {
  transaction_id: string;
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
  monthly_amount: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface CommitmentPaymentRecord {
  commitment_payment_id: string;
  commitment_id: string;
  payment_year: number;
  payment_month: number;
  amount_due: number;
  amount_paid: number | null;
  status: "paid" | "skipped";
}

interface FinancingRecord {
  financing_id: string;
  financing_name: string;
  sync_to_commitments: boolean;
  status: "active" | "settled";
  is_active: boolean;
}

interface FinancingInstallmentRecord {
  installment_id: string;
  financing_id: string;
  due_date: string; // YYYY-MM-DD
  amount_due: number;
  amount_paid: number | null;
  status: "pending" | "paid";
}

// =============================================================================
// 2. CONSTANTS & PALETTE
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

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drinks": "#3e8e5e",
  "Groceries": "#16a34a",
  "Transport": "#2563eb",
  "Toll & Parking": "#0284c7",
  "Shopping": "#f59e0b",
  "Internet & Telco": "#06b6d4",
  "Utilities & Bills": "#8b5cf6",
  "Health & Medical": "#ec4899",
  "Entertainment": "#f97316",
  "Hobby": "#14b8a6",
  "Family & Gifts": "#a855f7",
  "Rent & Housing": "#dc2626",
  "Tabung / Savings": "#10b981",
  "Others": "#64748b",
};

const DEFAULT_COLOR = "#64748b";

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || DEFAULT_COLOR;
}

function formatRM(val: number): string {
  return Number(val || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

const panelCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #eef2ed",
  padding: "22px 24px",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
};

// =============================================================================
// 3. MAIN INSIGHTS COMPONENT
// =============================================================================

export default function InsightsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<TimeframeMode>("monthly");

  // Selected date anchor (defaults to current year & month)
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    new Date().getMonth() + 1
  ); // 1..12

  // Category drilldown filter (null = all categories)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(
    null
  );

  // Raw data from Supabase
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [commitments, setCommitments] = useState<CommitmentRecord[]>([]);
  const [commitmentPayments, setCommitmentPayments] = useState<
    CommitmentPaymentRecord[]
  >([]);
  const [financings, setFinancings] = useState<FinancingRecord[]>([]);
  const [financingInstallments, setFinancingInstallments] = useState<
    FinancingInstallmentRecord[]
  >([]);

  // Toast
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type: BottomToastType;
  } | null>(null);

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================
  useEffect(() => {
    let isMounted = true;

    const fetchInsightsData = async () => {
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

        const [
          txRes,
          commitmentsRes,
          commitmentPaymentsRes,
          financingRes,
          financingInstRes,
        ] = await Promise.all([
          supabase
            .from("transactions")
            .select(
              "transaction_id, transaction_type, amount, description, expense_category, income_category, transaction_date, transaction_time, created_at"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("transaction_date", { ascending: false }),
          supabase
            .from("commitments")
            .select(
              "commitment_id, commitment_name, monthly_amount, start_date, end_date, is_active"
            )
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase
            .from("commitment_payments")
            .select(
              "commitment_payment_id, commitment_id, payment_year, payment_month, amount_due, amount_paid, status"
            )
            .eq("user_id", user.id)
            .eq("is_active", true),
          supabase
            .from("financing")
            .select(
              "financing_id, financing_name, sync_to_commitments, status, is_active"
            )
            .eq("user_id", user.id)
            .eq("is_active", true)
            .eq("status", "active"),
          supabase
            .from("financing_installments")
            .select(
              "installment_id, financing_id, due_date, amount_due, amount_paid, status"
            )
            .eq("user_id", user.id)
            .eq("is_active", true),
        ]);

        if (!isMounted) return;

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
      } catch (err) {
        console.error("Failed to load insights data:", err);
        if (isMounted) {
          setToastInfo({
            message: "Failed to load insights data. Please refresh.",
            type: "error",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInsightsData();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // ===========================================================================
  // FILTERED TRANSACTIONS FOR CURRENT ACTIVE TIMEFRAME
  // ===========================================================================

  const targetYmPrefix = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  }, [selectedYear, selectedMonth]);

  // Transactions belonging to the currently selected month/period
  const currentPeriodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (timeframe === "yearly") {
        return tx.transaction_date.startsWith(`${selectedYear}-`);
      }
      // monthly and weekly analyze the selected month
      return tx.transaction_date.startsWith(targetYmPrefix);
    });
  }, [transactions, timeframe, selectedYear, targetYmPrefix]);

  // ===========================================================================
  // SECTION 1: FINANCIAL SCORECARD METRICS (EARNED, SPENT, LEFTOVER)
  // ===========================================================================

  const scorecard = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of currentPeriodTransactions) {
      const amt = Number(tx.amount || 0);
      if (tx.transaction_type === "income") income += amt;
      else if (tx.transaction_type === "expense") expense += amt;
    }

    const netSurplus = income - expense;
    const isSurplus = netSurplus >= 0;
    const retainedPct = income > 0 ? (netSurplus / income) * 100 : 0;

    return {
      income,
      expense,
      netSurplus,
      isSurplus,
      retainedPct: Math.max(0, Math.round(retainedPct)),
    };
  }, [currentPeriodTransactions]);

  // ===========================================================================
  // SECTION 2: BAR CHART DATA (INCOME VS EXPENSE)
  // ===========================================================================

  const barChartData = useMemo(() => {
    if (timeframe === "weekly") {
      // Divide the selected month into 4 weeks (Days 1-7, 8-14, 15-21, 22+)
      const weeks = [
        { label: "Week 1 (1-7)", income: 0, expense: 0 },
        { label: "Week 2 (8-14)", income: 0, expense: 0 },
        { label: "Week 3 (15-21)", income: 0, expense: 0 },
        { label: "Week 4 (22+)", income: 0, expense: 0 },
      ];

      for (const tx of currentPeriodTransactions) {
        const day = Number(tx.transaction_date.split("-")[2]);
        const amt = Number(tx.amount || 0);
        let weekIdx = 3;
        if (day <= 7) weekIdx = 0;
        else if (day <= 14) weekIdx = 1;
        else if (day <= 21) weekIdx = 2;

        if (tx.transaction_type === "income") {
          weeks[weekIdx].income += amt;
        } else {
          weeks[weekIdx].expense += amt;
        }
      }

      return weeks.map((w) => ({
        label: w.label,
        income: Number(w.income.toFixed(2)),
        expense: Number(w.expense.toFixed(2)),
      }));
    }

    if (timeframe === "yearly") {
      // 12 months for the selected year
      const months = SHORT_MONTH_NAMES.map((name, idx) => ({
        label: name,
        ymPrefix: `${selectedYear}-${String(idx + 1).padStart(2, "0")}`,
        income: 0,
        expense: 0,
      }));

      const monthMap = new Map(months.map((m) => [m.ymPrefix, m]));

      for (const tx of transactions) {
        const ym = tx.transaction_date.slice(0, 7);
        const bucket = monthMap.get(ym);
        if (bucket) {
          const amt = Number(tx.amount || 0);
          if (tx.transaction_type === "income") bucket.income += amt;
          else bucket.expense += amt;
        }
      }

      return months.map((m) => ({
        label: m.label,
        income: Number(m.income.toFixed(2)),
        expense: Number(m.expense.toFixed(2)),
      }));
    }

    // Default: Monthly mode (shows rolling 7 months ending at selected month)
    const rolling: {
      label: string;
      ymPrefix: string;
      income: number;
      expense: number;
    }[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(selectedYear, selectedMonth - 1 - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      rolling.push({
        label: SHORT_MONTH_NAMES[d.getMonth()],
        ymPrefix: `${y}-${String(m).padStart(2, "0")}`,
        income: 0,
        expense: 0,
      });
    }

    const bucketMap = new Map(rolling.map((r) => [r.ymPrefix, r]));

    for (const tx of transactions) {
      const ym = tx.transaction_date.slice(0, 7);
      const bucket = bucketMap.get(ym);
      if (bucket) {
        const amt = Number(tx.amount || 0);
        if (tx.transaction_type === "income") bucket.income += amt;
        else bucket.expense += amt;
      }
    }

    return rolling.map((r) => ({
      label: r.label,
      income: Number(r.income.toFixed(2)),
      expense: Number(r.expense.toFixed(2)),
    }));
  }, [
    timeframe,
    selectedYear,
    selectedMonth,
    currentPeriodTransactions,
    transactions,
  ]);

  // ===========================================================================
  // SECTION 3: SPENDING BY CATEGORY (DONUT & RANKED METERS)
  // ===========================================================================

  const categorySpendingData = useMemo(() => {
    const catMap = new Map<string, { amount: number; count: number }>();

    for (const tx of currentPeriodTransactions) {
      if (tx.transaction_type === "expense") {
        const cat = tx.expense_category?.trim() || "Others";
        const amt = Number(tx.amount || 0);
        const existing = catMap.get(cat) || { amount: 0, count: 0 };
        catMap.set(cat, {
          amount: existing.amount + amt,
          count: existing.count + 1,
        });
      }
    }

    const totalExpense = scorecard.expense;

    const list = Array.from(catMap.entries()).map(([name, data]) => {
      const pct = totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0;
      return {
        name,
        amount: Number(data.amount.toFixed(2)),
        count: data.count,
        pct: Math.round(pct),
        exactPct: pct,
        color: getCategoryColor(name),
      };
    });

    // Sort descending by highest spending
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [currentPeriodTransactions, scorecard.expense]);

  // Filtered transactions for the drill-down section
  const drilldownTransactions = useMemo(() => {
    if (!selectedCategoryFilter) {
      return currentPeriodTransactions.filter(
        (t) => t.transaction_type === "expense"
      );
    }
    return currentPeriodTransactions.filter(
      (t) =>
        t.transaction_type === "expense" &&
        (t.expense_category?.trim() || "Others") === selectedCategoryFilter
    );
  }, [currentPeriodTransactions, selectedCategoryFilter]);

  // ===========================================================================
  // SECTION 4: FIXED OBLIGATIONS VS FLEXIBLE LIFESTYLE SPENDING
  // ===========================================================================

  const obligationsSplit = useMemo(() => {
    let fixedTotal = 0;

    // 1. Commitments applicable for current year/month
    const targetYm = selectedYear * 100 + selectedMonth;
    for (const c of commitments) {
      let isApplicable = true;
      if (c.start_date) {
        const [sy, sm] = c.start_date.split("-").map(Number);
        if (sy && sm && targetYm < sy * 100 + sm) isApplicable = false;
      }
      if (c.end_date) {
        const [ey, em] = c.end_date.split("-").map(Number);
        if (ey && em && targetYm > ey * 100 + em) isApplicable = false;
      }
      if (isApplicable) {
        const payment = commitmentPayments.find(
          (p) =>
            p.commitment_id === c.commitment_id &&
            p.payment_year === selectedYear &&
            p.payment_month === selectedMonth
        );
        const amt = payment
          ? Number(payment.amount_paid ?? payment.amount_due ?? c.monthly_amount)
          : Number(c.monthly_amount || 0);
        fixedTotal += amt;
      }
    }

    // 2. Synced financing plans with installment in current month
    const syncedFinancingIds = new Set(
      financings.filter((f) => f.sync_to_commitments).map((f) => f.financing_id)
    );

    for (const inst of financingInstallments) {
      if (
        inst.due_date &&
        inst.due_date.startsWith(targetYmPrefix) &&
        syncedFinancingIds.has(inst.financing_id)
      ) {
        const amt =
          inst.status === "paid"
            ? Number(inst.amount_paid ?? inst.amount_due ?? 0)
            : Number(inst.amount_due || 0);
        fixedTotal += amt;
      }
    }

    // Flexible is all other variable expenses
    const totalSpent = scorecard.expense;
    const flexibleTotal = Math.max(0, totalSpent - fixedTotal);
    const combined = fixedTotal + flexibleTotal;

    const fixedPct = combined > 0 ? Math.round((fixedTotal / combined) * 100) : 50;
    const flexiblePct = combined > 0 ? 100 - fixedPct : 50;

    return {
      fixedTotal,
      flexibleTotal,
      fixedPct,
      flexiblePct,
    };
  }, [
    commitments,
    commitmentPayments,
    financings,
    financingInstallments,
    selectedYear,
    selectedMonth,
    targetYmPrefix,
    scorecard.expense,
  ]);

  // ===========================================================================
  // DATE STEPPER HANDLERS
  // ===========================================================================

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setSelectedCategoryFilter(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSelectedCategoryFilter(null);
  };

  const displayPeriodLabel = useMemo(() => {
    if (timeframe === "yearly") return `Year ${selectedYear}`;
    return `${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [timeframe, selectedMonth, selectedYear]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="container-fluid p-0" style={{ paddingBottom: "40px" }}>
      {/* =====================================================================
          HEADER SECTION: Title + Period Pills + Month Stepper
      ====================================================================== */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle mb-0">
            Visualize your spending patterns and trends
          </p>
        </div>

        {/* Right Controls: Stepper & Timeframe Selector */}
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* Month Stepper */}
          {timeframe !== "yearly" && (
            <div
              className="d-flex align-items-center gap-1 bg-white"
              style={{
                borderRadius: "12px",
                border: "1px solid #eef2ed",
                padding: "4px 8px",
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none"
                style={{ color: "#4b5e52", fontSize: "1rem" }}
                onClick={handlePrevMonth}
                title="Previous month"
              >
                <i className="bi bi-chevron-left" />
              </button>
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#1a2e23",
                  padding: "0 8px",
                  whiteSpace: "nowrap",
                }}
              >
                {displayPeriodLabel}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none"
                style={{ color: "#4b5e52", fontSize: "1rem" }}
                onClick={handleNextMonth}
                title="Next month"
              >
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          )}

          {/* Timeframe Segment (Weekly / Monthly / Yearly) */}
          <div
            className="d-flex bg-white"
            style={{
              borderRadius: "12px",
              border: "1px solid #eef2ed",
              padding: "3px",
            }}
          >
            {(["weekly", "monthly", "yearly"] as TimeframeMode[]).map((mode) => {
              const isActive = timeframe === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTimeframe(mode);
                    setSelectedCategoryFilter(null);
                  }}
                  className="btn btn-sm border-0 text-capitalize"
                  style={{
                    backgroundColor: isActive ? "#3e8e5e" : "transparent",
                    color: isActive ? "#ffffff" : "#6b7f72",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    borderRadius: "9px",
                    padding: "5px 14px",
                    transition: "all 0.15s ease",
                  }}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 1: 3 MONTHLY HEALTH SCORECARD CARDS
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Income Earned */}
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
                  Income earned ({displayPeriodLabel})
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
                  RM {formatRM(scorecard.income)}
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
            <div
              className="mt-2"
              style={{ fontSize: "0.78rem", color: "#6b7f72", fontWeight: 500 }}
            >
              Total inflow during this period
            </div>
          </div>
        </div>

        {/* Total Expenses */}
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
                  Total spent ({displayPeriodLabel})
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
                  RM {formatRM(scorecard.expense)}
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
            <div
              className="mt-2"
              style={{ fontSize: "0.78rem", color: "#6b7f72", fontWeight: 500 }}
            >
              Across {categorySpendingData.length} active spending categories
            </div>
          </div>
        </div>

        {/* Net Leftover (Surplus vs Deficit) */}
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
                  Net leftover ({scorecard.isSurplus ? "Surplus" : "Deficit"})
                </div>
                <div
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: scorecard.isSurplus ? "#16a34a" : "#dc2626",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.2,
                  }}
                >
                  {scorecard.isSurplus ? "+ " : "- "}RM{" "}
                  {formatRM(Math.abs(scorecard.netSurplus))}
                </div>
              </div>
              <div
                className="d-flex align-items-center justify-content-center flex-shrink-0"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: scorecard.isSurplus ? "#e6f4ea" : "#fee2e2",
                  color: scorecard.isSurplus ? "#3e8e5e" : "#dc2626",
                  fontSize: "1.1rem",
                }}
              >
                <i
                  className={`bi ${
                    scorecard.isSurplus ? "bi-check2-circle" : "bi-exclamation-triangle"
                  }`}
                />
              </div>
            </div>
            <div
              className="mt-2"
              style={{
                fontSize: "0.78rem",
                color: scorecard.isSurplus ? "#16a34a" : "#dc2626",
                fontWeight: 600,
              }}
            >
              {scorecard.income > 0 ? (
                scorecard.isSurplus ? (
                  `Retained ${scorecard.retainedPct}% of what you earned`
                ) : (
                  `Exceeded earned income by RM ${formatRM(
                    Math.abs(scorecard.netSurplus)
                  )}`
                )
              ) : (
                "No income recorded in this period"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 2: INCOME VS EXPENSES (BAR CHART) + BY CATEGORY (DONUT CHART)
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Left: Income vs Expenses Grouped Bar Chart */}
        <div className="col-12 col-xl-7">
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
                  Income vs expenses
                </h5>
                <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                  {timeframe === "weekly"
                    ? `Weekly performance in ${displayPeriodLabel}`
                    : timeframe === "yearly"
                    ? `12 months overview for ${selectedYear}`
                    : "Comparative monthly cash flow"}
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
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  barGap={6}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eef2ed"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7f72", fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7f72", fontSize: 12 }}
                    width={55}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #eef2ed",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
                      fontSize: "0.82rem",
                      color: "#1a2e23",
                    }}
                    formatter={(val, name) => [
                      `RM ${formatRM(Number(val || 0))}`,
                      String(name || ""),
                    ]}
                  />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#3e8e5e"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="expense"
                    name="Expense"
                    fill="#173f8f"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: By Category Donut Chart */}
        <div className="col-12 col-xl-5">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5
                className="fw-bold mb-0"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                By category
              </h5>
              <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                {displayPeriodLabel}
              </span>
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "220px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading categories...
              </div>
            ) : categorySpendingData.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "220px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-pie-chart mb-2"
                  style={{ fontSize: "1.8rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No expenses recorded in {displayPeriodLabel}
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column flex-grow-1 justify-content-between">
                {/* Donut Chart with Centered Total */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "185px",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySpendingData}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        onClick={(entry) => {
                          const catName = entry?.name;
                          if (!catName) return;
                          setSelectedCategoryFilter((prev) =>
                            prev === catName ? null : catName
                          );
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {categorySpendingData.map((entry) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={entry.color}
                            stroke={
                              selectedCategoryFilter === entry.name
                                ? "#1a2e23"
                                : "#ffffff"
                            }
                            strokeWidth={
                              selectedCategoryFilter === entry.name ? 3 : 1
                            }
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #eef2ed",
                          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.06)",
                          fontSize: "0.8rem",
                        }}
                        formatter={(val) => [
                          `RM ${formatRM(Number(val || 0))}`,
                          undefined,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered Total inside Donut */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "#8b9d90",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Total spent
                    </div>
                    <div
                      style={{
                        fontSize: "0.98rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                        lineHeight: 1.1,
                      }}
                    >
                      RM {formatRM(scorecard.expense)}
                    </div>
                  </div>
                </div>

                {/* Compact Legend List (Max 5 or scrollable) */}
                <div
                  className="d-flex flex-column gap-1 mt-2"
                  style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    paddingRight: "4px",
                  }}
                >
                  {categorySpendingData.map((item) => {
                    const isSelected = selectedCategoryFilter === item.name;
                    return (
                      <div
                        key={item.name}
                        onClick={() =>
                          setSelectedCategoryFilter((prev) =>
                            prev === item.name ? null : item.name
                          )
                        }
                        className="d-flex align-items-center justify-content-between p-1 rounded"
                        style={{
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          backgroundColor: isSelected
                            ? "#eef5f0"
                            : "transparent",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        <div
                          className="d-flex align-items-center gap-2"
                          style={{ minWidth: 0, flex: 1, marginRight: "10px" }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: item.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: isSelected ? "#1a2e23" : "#4b5e52",
                              fontWeight: isSelected ? 700 : 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.name}
                          </span>
                        </div>
                        <div
                          className="flex-shrink-0"
                          style={{
                            fontWeight: 600,
                            color: "#1a2e23",
                            whiteSpace: "nowrap",
                          }}
                        >
                          RM {formatRM(item.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          ROW 3: CATEGORY DRILL-DOWN (6 COLS) + FIXED VS FLEXIBLE OBLIGATIONS (6 COLS)
      ====================================================================== */}
      <div className="row g-3">
        {/* Left: Category Breakdown & Interactive Drill-down */}
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
              <div>
                <h5
                  className="fw-bold mb-0"
                  style={{ fontSize: "1.02rem", color: "#1a2e23" }}
                >
                  {selectedCategoryFilter
                    ? `${selectedCategoryFilter} transactions`
                    : "Category breakdown"}
                </h5>
                <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                  {selectedCategoryFilter
                    ? "Showing filtered transactions · Click reset to view all"
                    : "Ranked by highest spending · Click a category to drill down"}
                </span>
              </div>
              {selectedCategoryFilter && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-decoration-none"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#3e8e5e",
                  }}
                  onClick={() => setSelectedCategoryFilter(null)}
                >
                  Show all
                </button>
              )}
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{ minHeight: "220px", color: "#8b9d90", fontSize: "0.85rem" }}
              >
                Loading breakdown...
              </div>
            ) : categorySpendingData.length === 0 ? (
              <div
                className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-center"
                style={{ minHeight: "220px", color: "#8b9d90" }}
              >
                <i
                  className="bi bi-receipt mb-2"
                  style={{ fontSize: "1.6rem", color: "#b0c0b5" }}
                />
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>
                  No spending records found
                </div>
              </div>
            ) : selectedCategoryFilter ? (
              /* Filtered Transaction List for the Selected Category */
              <div
                className="d-flex flex-column"
                style={{
                  maxHeight: "340px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {drilldownTransactions.length === 0 ? (
                  <div
                    className="text-center py-4"
                    style={{ color: "#8b9d90", fontSize: "0.84rem" }}
                  >
                    No transactions found for {selectedCategoryFilter}
                  </div>
                ) : (
                  drilldownTransactions.map((tx, idx) => {
                    const isLast = idx === drilldownTransactions.length - 1;
                    return (
                      <div
                        key={tx.transaction_id}
                        className="d-flex align-items-center justify-content-between py-2"
                        style={{
                          borderBottom: isLast ? "none" : "1px solid #f0f4f1",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            flex: 1,
                            marginRight: "12px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.86rem",
                              color: "#1a2e23",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tx.description?.trim() || tx.expense_category}
                          </div>
                          <div
                            style={{
                              fontSize: "0.74rem",
                              color: "#6b7f72",
                            }}
                          >
                            {formatDateDisplay(tx.transaction_date)}
                            {tx.transaction_time ? ` · ${tx.transaction_time}` : ""}
                          </div>
                        </div>

                        <div
                          className="flex-shrink-0"
                          style={{
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            color: "#1a2e23",
                            whiteSpace: "nowrap",
                          }}
                        >
                          - RM {formatRM(Number(tx.amount || 0))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Default: Ranked Category Progress Bars */
              <div
                className="d-flex flex-column gap-3"
                style={{
                  maxHeight: "340px",
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: "4px",
                }}
              >
                {categorySpendingData.map((cat) => (
                  <div
                    key={cat.name}
                    onClick={() => setSelectedCategoryFilter(cat.name)}
                    style={{
                      cursor: "pointer",
                      padding: "4px 6px",
                      borderRadius: "8px",
                      transition: "background-color 0.15s ease",
                    }}
                    className="category-row-hover"
                  >
                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                      <div
                        className="d-flex align-items-center gap-2"
                        style={{ minWidth: 0, flex: 1, marginRight: "10px" }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.87rem",
                            color: "#1a2e23",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cat.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "#8b9d90",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ({cat.count} {cat.count === 1 ? "txn" : "txns"})
                        </span>
                      </div>
                      <span
                        className="flex-shrink-0"
                        style={{
                          fontWeight: 700,
                          fontSize: "0.86rem",
                          color: "#1a2e23",
                          whiteSpace: "nowrap",
                        }}
                      >
                        RM {formatRM(cat.amount)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "7px",
                        backgroundColor: "#f0f4f1",
                        borderRadius: "999px",
                        overflow: "hidden",
                        marginBottom: "2px",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, cat.exactPct)}%`,
                          height: "100%",
                          backgroundColor: cat.color,
                          borderRadius: "999px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#6b7f72",
                      }}
                    >
                      {cat.pct}% of total spending
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Fixed Obligations vs Flexible Spending */}
        <div className="col-12 col-xl-6">
          <div
            style={{
              ...panelCardStyle,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h5
                className="fw-bold mb-0"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                Fixed bills vs flexible spending
              </h5>
              <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                Understanding mandatory commitments vs discretionary lifestyle
              </span>

              {/* Two-tone visual progress bar */}
              <div className="mt-4 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: "#173f8f",
                    }}
                  >
                    Fixed ({obligationsSplit.fixedPct}%)
                  </span>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: "#3e8e5e",
                    }}
                  >
                    Flexible ({obligationsSplit.flexiblePct}%)
                  </span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "12px",
                    backgroundColor: "#eef2ed",
                    borderRadius: "999px",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${obligationsSplit.fixedPct}%`,
                      height: "100%",
                      backgroundColor: "#173f8f",
                      transition: "width 0.3s ease",
                    }}
                    title={`Fixed: RM ${formatRM(obligationsSplit.fixedTotal)}`}
                  />
                  <div
                    style={{
                      width: `${obligationsSplit.flexiblePct}%`,
                      height: "100%",
                      backgroundColor: "#3e8e5e",
                      transition: "width 0.3s ease",
                    }}
                    title={`Flexible: RM ${formatRM(
                      obligationsSplit.flexibleTotal
                    )}`}
                  />
                </div>
              </div>

              {/* Split Cards Breakdown */}
              <div className="row g-2 mt-2">
                <div className="col-6">
                  <div
                    style={{
                      backgroundColor: "#f7f9fc",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      className="d-flex align-items-center gap-1 mb-1"
                      style={{ fontSize: "0.76rem", color: "#173f8f", fontWeight: 600 }}
                    >
                      <i className="bi bi-shield-lock" />
                      <span>Fixed commitments</span>
                    </div>
                    <div
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                      }}
                    >
                      RM {formatRM(obligationsSplit.fixedTotal)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#6b7f72",
                        marginTop: "2px",
                      }}
                    >
                      Rent, loans & recurring commitments
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div
                    style={{
                      backgroundColor: "#f6fbf7",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      border: "1px solid #e1efe4",
                    }}
                  >
                    <div
                      className="d-flex align-items-center gap-1 mb-1"
                      style={{ fontSize: "0.76rem", color: "#3e8e5e", fontWeight: 600 }}
                    >
                      <i className="bi bi-cup-hot" />
                      <span>Flexible lifestyle</span>
                    </div>
                    <div
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                      }}
                    >
                      RM {formatRM(obligationsSplit.flexibleTotal)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#6b7f72",
                        marginTop: "2px",
                      }}
                    >
                      Food, shopping & daily spending
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Takeaway note */}
            <div
              className="d-flex align-items-start gap-2 mt-4 p-3"
              style={{
                backgroundColor: "#f8faf8",
                borderRadius: "12px",
                border: "1px solid #eef2ed",
              }}
            >
              <i
                className="bi bi-lightbulb"
                style={{ color: "#3e8e5e", fontSize: "1rem", marginTop: "1px" }}
              />
              <div style={{ fontSize: "0.78rem", color: "#4b5e52", lineHeight: 1.4 }}>
                <strong>Takeaway:</strong> Before discretionary spending begins,{" "}
                <strong>RM {formatRM(obligationsSplit.fixedTotal)}</strong> is
                already committed to mandatory bills and financing. If you ever
                need to tighten your budget, focus on the flexible lifestyle
                bucket.
              </div>
            </div>
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
