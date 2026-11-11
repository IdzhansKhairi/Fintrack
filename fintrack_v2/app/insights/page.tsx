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

type TimeframeMode = "daily" | "weekly" | "monthly";
type DailyExpenseScope = "lifestyle" | "all";

interface SelectedBarFilter {
  key: string;
  label: string;
  mode: TimeframeMode;
  dateStr?: string; // YYYY-MM-DD (daily)
  weekIdx?: number; // 0..3 (weekly)
  ymPrefix?: string; // YYYY-MM (monthly)
}

// Unified shape for every bar in the Daily / Weekly / Monthly expense chart
interface ChartBarDatum {
  barKey: string;
  label: string;
  shortLabel: string;
  fullDateLabel: string;
  income: number;
  expense: number;
  dateStr?: string; // daily
  weekIdx?: number; // weekly
  ymPrefix?: string; // monthly
}

interface TransactionRecord {
  transaction_id: string;
  target_account_id?: string | null;
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

const MONTH_NAMES = [
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

const EXCLUDED_DAILY_LIFESTYLE_CATEGORIES = new Set([
  "Commitment",
  "Commitments",
  "Financing / Installment",
  "Financing Installment",
  "Debt / Lending",
  "Debt Repayment",
  "Credit Card Payment",
]);

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
  "Commitments": "#6366f1",
  "Financing Installment": "#0f766e",
  "Tabung / Savings": "#10b981",
  "Others": "#64748b",
};

const DEFAULT_COLOR = "#64748b";

/**
 * Returns true if the transaction is a credit card bill settlement ("+ Pay card")
 * rather than new spending, so it is not double-counted in expense analytics.
 */
function isCreditCardSettlement(tx: TransactionRecord): boolean {
  return (
    tx.expense_category === "Credit Card Payment" || Boolean(tx.target_account_id)
  );
}

/**
 * Returns true if the expense is a discretionary/lifestyle daily expense
 * (excludes commitments, financing installments, debt lending/repayment, and card bill settlements).
 */
function isLifestyleDailyExpense(tx: TransactionRecord): boolean {
  if (tx.transaction_type !== "expense" || isCreditCardSettlement(tx)) {
    return false;
  }
  const cat = (tx.expense_category || "").trim();
  return !EXCLUDED_DAILY_LIFESTYLE_CATEGORIES.has(cat);
}

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

function formatShortMonthDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = SHORT_MONTH_NAMES[monthIdx] || parts[1];
  return `${parts[2]} ${monthName} ${parts[0]}`;
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
  const [dailyExpenseScope, setDailyExpenseScope] =
    useState<DailyExpenseScope>("lifestyle");

  // Selected date anchor (defaults to current year & month)
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    new Date().getMonth() + 1
  ); // 1..12

  // Category drilldown filter (null = all categories)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    string | null
  >(null);

  // Bar selection filter across Daily, Weekly, and Monthly charts
  const [selectedBarFilter, setSelectedBarFilter] =
    useState<SelectedBarFilter | null>(null);

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
              "transaction_id, target_account_id, transaction_type, amount, description, expense_category, income_category, transaction_date, transaction_time, created_at"
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

  // Transactions belonging to the currently selected month
  const currentPeriodTransactions = useMemo(() => {
    return transactions.filter((tx) =>
      tx.transaction_date.startsWith(targetYmPrefix)
    );
  }, [transactions, targetYmPrefix]);

  // ===========================================================================
  // SECTION 1: FINANCIAL SCORECARD METRICS (EARNED, SPENT, LEFTOVER)
  // ===========================================================================

  const scorecard = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of currentPeriodTransactions) {
      const amt = Number(tx.amount || 0);
      if (tx.transaction_type === "income") income += amt;
      else if (tx.transaction_type === "expense" && !isCreditCardSettlement(tx))
        expense += amt;
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
  // SECTION 2: BAR CHART DATA (DAILY / WEEKLY / MONTHLY)
  // ===========================================================================

  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Daily mode shows a 7-day rolling window (last 7 days up to today for current month, or last 7 days of selected month)
  const dailyChartData = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curDay = now.getDate();

    let anchorDay = daysInSelectedMonth;
    if (selectedYear === curYear && selectedMonth === curMonth) {
      anchorDay = Math.min(daysInSelectedMonth, curDay);
    }

    const days: {
      barKey: string;
      label: string;
      shortLabel: string;
      dateStr: string;
      fullDateLabel: string;
      income: number;
      expense: number;
    }[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(selectedYear, selectedMonth - 1, anchorDay - offset);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const dayNum = d.getDate();
      const dayPadded = String(dayNum).padStart(2, "0");
      const mPadded = String(m).padStart(2, "0");
      const dateStr = `${y}-${mPadded}-${dayPadded}`;
      const shortMonth = SHORT_MONTH_NAMES[m - 1];

      days.push({
        barKey: dateStr,
        label: `${dayPadded} ${shortMonth}`,
        shortLabel: `${dayPadded} ${shortMonth}`,
        dateStr,
        fullDateLabel: `${dayPadded} ${shortMonth} ${y}`,
        income: 0,
        expense: 0,
      });
    }

    const dayMap = new Map(days.map((d) => [d.dateStr, d]));

    for (const tx of transactions) {
      const bucket = dayMap.get(tx.transaction_date);
      if (!bucket) continue;
      const amt = Number(tx.amount || 0);
      if (tx.transaction_type === "income") {
        bucket.income += amt;
      } else if (tx.transaction_type === "expense") {
        const includeExpense =
          dailyExpenseScope === "lifestyle"
            ? isLifestyleDailyExpense(tx)
            : !isCreditCardSettlement(tx);
        if (includeExpense) {
          bucket.expense += amt;
        }
      }
    }

    return days.map((d) => ({
      ...d,
      income: Number(d.income.toFixed(2)),
      expense: Number(d.expense.toFixed(2)),
    }));
  }, [
    daysInSelectedMonth,
    selectedMonth,
    selectedYear,
    transactions,
    dailyExpenseScope,
  ]);

  // Daily summary stats are based on the WHOLE selected month (not just the 7-day chart window):
  // Daily average = month-to-date total ÷ days elapsed; Highest day = highest day in the month.
  const dailyStats = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curDay = now.getDate();

    let daysElapsed = daysInSelectedMonth;
    if (selectedYear === curYear && selectedMonth === curMonth) {
      daysElapsed = Math.min(daysInSelectedMonth, curDay);
    } else if (
      selectedYear > curYear ||
      (selectedYear === curYear && selectedMonth > curMonth)
    ) {
      daysElapsed = 0;
    }

    const dayTotals = new Map<string, number>();
    let totalExpense = 0;

    for (const tx of currentPeriodTransactions) {
      if (tx.transaction_type !== "expense") continue;
      const include =
        dailyExpenseScope === "lifestyle"
          ? isLifestyleDailyExpense(tx)
          : !isCreditCardSettlement(tx);
      if (!include) continue;
      const amt = Number(tx.amount || 0);
      totalExpense += amt;
      dayTotals.set(
        tx.transaction_date,
        (dayTotals.get(tx.transaction_date) || 0) + amt
      );
    }

    let peakDay: { label: string; dateStr: string; amount: number } | null = null;
    dayTotals.forEach((amount, dateStr) => {
      if (amount > 0 && (!peakDay || amount > peakDay.amount)) {
        const [, m, d] = dateStr.split("-");
        peakDay = {
          label: `${d} ${SHORT_MONTH_NAMES[Number(m) - 1]}`,
          dateStr,
          amount: Number(amount.toFixed(2)),
        };
      }
    });

    const dailyAverage = daysElapsed > 0 ? totalExpense / daysElapsed : 0;

    return {
      totalExpense: Number(totalExpense.toFixed(2)),
      dailyAverage: Number(dailyAverage.toFixed(2)),
      peakDay: peakDay as { label: string; dateStr: string; amount: number } | null,
      daysElapsed,
    };
  }, [
    currentPeriodTransactions,
    dailyExpenseScope,
    daysInSelectedMonth,
    selectedYear,
    selectedMonth,
  ]);

  const barChartData = useMemo((): ChartBarDatum[] => {
    const shouldIncludeExpense = (tx: TransactionRecord) =>
      dailyExpenseScope === "lifestyle"
        ? isLifestyleDailyExpense(tx)
        : !isCreditCardSettlement(tx);

    if (timeframe === "daily") {
      return dailyChartData;
    }

    if (timeframe === "weekly") {
      // Divide the selected month into 4 weeks (Days 1-7, 8-14, 15-21, 22+)
      const weeks = [
        {
          barKey: "week-0",
          weekIdx: 0,
          label: "Week 1",
          shortLabel: "Week 1",
          fullDateLabel: `Week 1 (01–07 ${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          income: 0,
          expense: 0,
        },
        {
          barKey: "week-1",
          weekIdx: 1,
          label: "Week 2",
          shortLabel: "Week 2",
          fullDateLabel: `Week 2 (08–14 ${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          income: 0,
          expense: 0,
        },
        {
          barKey: "week-2",
          weekIdx: 2,
          label: "Week 3",
          shortLabel: "Week 3",
          fullDateLabel: `Week 3 (15–21 ${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          income: 0,
          expense: 0,
        },
        {
          barKey: "week-3",
          weekIdx: 3,
          label: "Week 4",
          shortLabel: "Week 4",
          fullDateLabel: `Week 4 (22–${daysInSelectedMonth} ${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear})`,
          income: 0,
          expense: 0,
        },
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
        } else if (
          tx.transaction_type === "expense" &&
          shouldIncludeExpense(tx)
        ) {
          weeks[weekIdx].expense += amt;
        }
      }

      return weeks.map((w) => ({
        barKey: w.barKey,
        weekIdx: w.weekIdx,
        label: w.label,
        shortLabel: w.shortLabel,
        fullDateLabel: w.fullDateLabel,
        income: Number(w.income.toFixed(2)),
        expense: Number(w.expense.toFixed(2)),
      }));
    }

    // Default: Monthly mode (shows rolling 7 months ending at selected month)
    const rolling: {
      barKey: string;
      label: string;
      shortLabel: string;
      fullDateLabel: string;
      ymPrefix: string;
      income: number;
      expense: number;
    }[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(selectedYear, selectedMonth - 1 - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ymPrefix = `${y}-${String(m).padStart(2, "0")}`;
      rolling.push({
        barKey: ymPrefix,
        label: SHORT_MONTH_NAMES[d.getMonth()],
        shortLabel: `${SHORT_MONTH_NAMES[d.getMonth()]} ${y}`,
        fullDateLabel: `${MONTH_NAMES[d.getMonth()]} ${y}`,
        ymPrefix,
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
        else if (
          tx.transaction_type === "expense" &&
          shouldIncludeExpense(tx)
        )
          bucket.expense += amt;
      }
    }

    return rolling.map((r) => ({
      barKey: r.barKey,
      ymPrefix: r.ymPrefix,
      label: r.label,
      shortLabel: r.shortLabel,
      fullDateLabel: r.fullDateLabel,
      income: Number(r.income.toFixed(2)),
      expense: Number(r.expense.toFixed(2)),
    }));
  }, [
    timeframe,
    dailyChartData,
    dailyExpenseScope,
    daysInSelectedMonth,
    selectedYear,
    selectedMonth,
    currentPeriodTransactions,
    transactions,
  ]);

  const chartSummaryStats = useMemo(() => {
    const periodLabel = `${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

    if (timeframe === "daily") {
      return {
        avgTitle: "Daily average",
        avgAmount: dailyStats.dailyAverage,
        avgUnit: "/ day",
        avgCaption: `${periodLabel} · ${dailyStats.daysElapsed} ${
          dailyStats.daysElapsed === 1 ? "day" : "days"
        }`,
        peakTitle: "Highest day",
        peakLabel: dailyStats.peakDay ? dailyStats.peakDay.label : null,
        peakAmount: dailyStats.peakDay ? dailyStats.peakDay.amount : 0,
        peakCaption: `In ${periodLabel}`,
      };
    }

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curDay = now.getDate();

    if (timeframe === "weekly") {
      let weeksElapsed = 4;
      if (selectedYear === curYear && selectedMonth === curMonth) {
        if (curDay <= 7) weeksElapsed = 1;
        else if (curDay <= 14) weeksElapsed = 2;
        else if (curDay <= 21) weeksElapsed = 3;
        else weeksElapsed = 4;
      } else if (
        selectedYear > curYear ||
        (selectedYear === curYear && selectedMonth > curMonth)
      ) {
        weeksElapsed = 0;
      }

      let total = 0;
      let peak: { label: string; amount: number } | null = null;

      barChartData.forEach((item) => {
        total += item.expense;
        const wkLabel =
          "shortLabel" in item && item.shortLabel
            ? String(item.shortLabel)
            : item.label;
        if (item.expense > 0 && (!peak || item.expense > peak.amount)) {
          peak = { label: wkLabel, amount: item.expense };
        }
      });

      const avg = weeksElapsed > 0 ? total / weeksElapsed : 0;
      return {
        avgTitle: "Weekly average",
        avgAmount: Number(avg.toFixed(2)),
        avgUnit: "/ wk",
        avgCaption: `${periodLabel} · ${weeksElapsed} ${
          weeksElapsed === 1 ? "week" : "weeks"
        }`,
        peakTitle: "Highest week",
        peakLabel: peak ? (peak as { label: string; amount: number }).label : null,
        peakAmount: peak ? (peak as { label: string; amount: number }).amount : 0,
        peakCaption: `In ${periodLabel}`,
      };
    }

    // Monthly mode (7-month rolling window)
    // Average = total of COMPLETED months that have data ÷ number of those months.
    // Excludes the current in-progress month and empty months before the user started tracking.
    const currentYm = `${curYear}-${String(curMonth).padStart(2, "0")}`;
    let total = 0;
    let countedMonths = 0;
    let peak: { label: string; amount: number } | null = null;

    barChartData.forEach((item) => {
      const moLabel =
        "shortLabel" in item && item.shortLabel
          ? String(item.shortLabel)
          : item.label;
      if (item.expense > 0 && (!peak || item.expense > peak.amount)) {
        peak = { label: moLabel, amount: item.expense };
      }
      const ym = "ymPrefix" in item ? String(item.ymPrefix) : "";
      const isCompleted = ym !== "" && ym < currentYm;
      if (isCompleted && item.expense > 0) {
        total += item.expense;
        countedMonths += 1;
      }
    });

    const avg = countedMonths > 0 ? total / countedMonths : 0;
    return {
      avgTitle: "Monthly average",
      avgAmount: Number(avg.toFixed(2)),
      avgUnit: "/ mo",
      avgCaption:
        countedMonths > 0
          ? `Avg of ${countedMonths} completed ${
              countedMonths === 1 ? "month" : "months"
            }`
          : "No completed months yet",
      peakTitle: "Highest month",
      peakLabel: peak ? (peak as { label: string; amount: number }).label : null,
      peakAmount: peak ? (peak as { label: string; amount: number }).amount : 0,
      peakCaption: "Last 7 months",
    };
  }, [timeframe, dailyStats, barChartData, selectedYear, selectedMonth]);

  // ===========================================================================
  // SECTION 3: SPENDING BY CATEGORY (DONUT & RANKED METERS)
  // ===========================================================================

  // Transactions scoped to the currently clicked bar (Day / Week / Month) or the full selected month
  const activeBreakdownTransactions = useMemo(() => {
    if (!selectedBarFilter) {
      return currentPeriodTransactions.filter(
        (tx) => tx.transaction_type === "expense" && !isCreditCardSettlement(tx)
      );
    }

    const shouldIncludeByScope = (tx: TransactionRecord) =>
      dailyExpenseScope === "lifestyle"
        ? isLifestyleDailyExpense(tx)
        : !isCreditCardSettlement(tx);

    if (selectedBarFilter.mode === "daily" && selectedBarFilter.dateStr) {
      return transactions.filter(
        (tx) =>
          tx.transaction_type === "expense" &&
          tx.transaction_date === selectedBarFilter.dateStr &&
          shouldIncludeByScope(tx)
      );
    }

    if (
      selectedBarFilter.mode === "weekly" &&
      typeof selectedBarFilter.weekIdx === "number"
    ) {
      return currentPeriodTransactions.filter((tx) => {
        if (tx.transaction_type !== "expense" || !shouldIncludeByScope(tx)) {
          return false;
        }
        const day = Number(tx.transaction_date.split("-")[2]);
        let wIdx = 3;
        if (day <= 7) wIdx = 0;
        else if (day <= 14) wIdx = 1;
        else if (day <= 21) wIdx = 2;
        return wIdx === selectedBarFilter.weekIdx;
      });
    }

    if (selectedBarFilter.mode === "monthly" && selectedBarFilter.ymPrefix) {
      return transactions.filter(
        (tx) =>
          tx.transaction_type === "expense" &&
          tx.transaction_date.startsWith(selectedBarFilter.ymPrefix!) &&
          shouldIncludeByScope(tx)
      );
    }

    return currentPeriodTransactions.filter(
      (tx) => tx.transaction_type === "expense" && !isCreditCardSettlement(tx)
    );
  }, [
    selectedBarFilter,
    currentPeriodTransactions,
    transactions,
    dailyExpenseScope,
  ]);

  const activeCategoryTotalExpense = useMemo(() => {
    return activeBreakdownTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount || 0),
      0
    );
  }, [activeBreakdownTransactions]);

  const categorySpendingData = useMemo(() => {
    const catMap = new Map<string, { amount: number; count: number }>();

    for (const tx of activeBreakdownTransactions) {
      const cat = tx.expense_category?.trim() || "Others";
      const amt = Number(tx.amount || 0);
      const existing = catMap.get(cat) || { amount: 0, count: 0 };
      catMap.set(cat, {
        amount: existing.amount + amt,
        count: existing.count + 1,
      });
    }

    const totalExpense = activeCategoryTotalExpense;

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
  }, [activeBreakdownTransactions, activeCategoryTotalExpense]);

  // Filtered transactions when drilling down into a specific Category
  const drilldownTransactions = useMemo(() => {
    return activeBreakdownTransactions.filter((t) => {
      if (selectedCategoryFilter) {
        return (
          (t.expense_category?.trim() || "Others") === selectedCategoryFilter
        );
      }
      return true;
    });
  }, [activeBreakdownTransactions, selectedCategoryFilter]);

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
    const FIXED_CATEGORIES = new Set([
      "Commitment",
      "Commitments",
      "Financing / Installment",
      "Financing Installment",
    ]);
    let flexibleTotal = 0;
    for (const tx of currentPeriodTransactions) {
      if (tx.transaction_type === "expense" && !isCreditCardSettlement(tx)) {
        const cat = tx.expense_category?.trim() || "Others";
        if (!FIXED_CATEGORIES.has(cat)) {
          flexibleTotal += Number(tx.amount || 0);
        }
      }
    }
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
    currentPeriodTransactions,
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
    setSelectedBarFilter(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSelectedCategoryFilter(null);
    setSelectedBarFilter(null);
  };

  const displayPeriodLabel = useMemo(() => {
    return `${SHORT_MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="container-fluid p-0" style={{ paddingBottom: "40px" }}>
      {/* =====================================================================
          HEADER SECTION: Title + Month Stepper + Timeframe Pills
      ====================================================================== */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle mb-0">
            Visualize your spending patterns and trends
          </p>
        </div>

        {/* Right Controls: Stepper & Timeframe Selector */}
        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-shrink-0">
          {/* Month Stepper */}
          <div
            className="d-flex align-items-center justify-content-between gap-1 bg-white"
            style={{
              borderRadius: "12px",
              border: "1px solid #eef2ed",
              padding: "4px 10px",
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

          {/* Timeframe Segment (Daily / Weekly / Monthly) */}
          <div
            className="d-flex bg-white fintrack-mobile-full-pills"
            style={{
              borderRadius: "12px",
              border: "1px solid #eef2ed",
              padding: "3px",
            }}
          >
            {(["daily", "weekly", "monthly"] as TimeframeMode[]).map((mode) => {
              const isActive = timeframe === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTimeframe(mode);
                    setSelectedCategoryFilter(null);
                    setSelectedBarFilter(null);
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
                    scorecard.isSurplus
                      ? "bi-check2-circle"
                      : "bi-exclamation-triangle"
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
          ROW 2: EXPENSE BAR CHART (DAILY / WEEKLY / MONTHLY) + BY CATEGORY (DONUT)
      ====================================================================== */}
      <div className="row g-3 mb-4">
        {/* Left: Expense Bar Chart */}
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
            <div>
              {/* Header: Side-by-side on sm+ (never wraps on Inspect), stacked below title on phone (<576px) */}
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-start gap-2 mb-3">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h5
                    className="fw-bold mb-0"
                    style={{
                      fontSize: "1.02rem",
                      color: "#1a2e23",
                    }}
                  >
                    {timeframe === "daily"
                      ? "Daily expenses"
                      : timeframe === "weekly"
                      ? "Weekly expenses"
                      : "Monthly expenses"}
                  </h5>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#8b9d90",
                      marginTop: "2px",
                    }}
                  >
                    {timeframe === "daily"
                      ? dailyExpenseScope === "lifestyle"
                        ? "Last 7 days lifestyle spending · Click a bar to filter breakdown"
                        : "Last 7 days total expenses · Click a bar to filter breakdown"
                      : timeframe === "weekly"
                      ? dailyExpenseScope === "lifestyle"
                        ? `Weekly lifestyle spending in ${displayPeriodLabel} · Click a bar to filter breakdown`
                        : `All weekly expenses in ${displayPeriodLabel} · Click a bar to filter breakdown`
                      : dailyExpenseScope === "lifestyle"
                      ? "Lifestyle spending across the last 7 months · Click a bar to filter breakdown"
                      : "All expenses across the last 7 months · Click a bar to filter breakdown"}
                  </div>
                </div>

                <div
                  className="d-inline-flex align-items-center p-1 flex-shrink-0 fintrack-mobile-full-pills"
                  style={{
                    backgroundColor: "#eef3ed",
                    borderRadius: "50px",
                  }}
                >
                  {(
                    [
                      { key: "lifestyle", label: "Lifestyle only" },
                      { key: "all", label: "All expenses" },
                    ] as { key: DailyExpenseScope; label: string }[]
                  ).map((opt) => {
                    const active = dailyExpenseScope === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDailyExpenseScope(opt.key)}
                        className="btn btn-sm rounded-pill border-0"
                        style={{
                          backgroundColor: active ? "#ffffff" : "transparent",
                          color: active ? "#1a2e23" : "#52665a",
                          fontWeight: active ? 600 : 500,
                          fontSize: "0.74rem",
                          padding: "4px 12px",
                          whiteSpace: "nowrap",
                          boxShadow: active
                            ? "0 1px 4px rgba(0, 0, 0, 0.06)"
                            : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2-Card Summary Strip (Average + Highest) — Responsive 50/50 on Phone & Desktop */}
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <div
                    style={{
                      backgroundColor: "#f8faf8",
                      border: "1px solid #eef2ed",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "#6b7f72",
                        fontWeight: 500,
                      }}
                    >
                      {chartSummaryStats.avgTitle}
                    </div>
                    <div
                      className="d-flex flex-wrap align-items-baseline column-gap-1"
                      style={{
                        fontSize: "0.94rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                      }}
                    >
                      <span>RM {formatRM(chartSummaryStats.avgAmount)}</span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 500,
                          color: "#8b9d90",
                        }}
                      >
                        {chartSummaryStats.avgUnit}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.66rem",
                        color: "#8b9d90",
                        marginTop: "2px",
                      }}
                    >
                      {chartSummaryStats.avgCaption}
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div
                    style={{
                      backgroundColor: "#f8faf8",
                      border: "1px solid #eef2ed",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "#6b7f72",
                        fontWeight: 500,
                      }}
                    >
                      {chartSummaryStats.peakTitle}
                    </div>
                    <div
                      className="d-flex flex-wrap align-items-baseline column-gap-1"
                      style={{
                        fontSize: "0.94rem",
                        fontWeight: 700,
                        color: "#1a2e23",
                      }}
                    >
                      {chartSummaryStats.peakLabel ? (
                        <>
                          <span>{chartSummaryStats.peakLabel}</span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#dc2626",
                            }}
                          >
                            (RM {formatRM(chartSummaryStats.peakAmount)})
                          </span>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.66rem",
                        color: "#8b9d90",
                        marginTop: "2px",
                      }}
                    >
                      {chartSummaryStats.peakCaption}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: "245px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
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
                    height={timeframe === "daily" ? 38 : 30}
                    padding={{ left: 4, right: 4 }}
                    interval={0}
                    tick={(props: {
                      x?: number | string;
                      y?: number | string;
                      payload?: { value?: string | number };
                    }) => {
                      const x = Number(props.x || 0);
                      const y = Number(props.y || 0);
                      const value = String(props.payload?.value ?? "");

                      // Daily: stack "05" over "Nov" so 7 labels never collide on narrow phones
                      if (timeframe === "daily") {
                        const [dayPart, monthPart] = value.split(" ");
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={12}
                              textAnchor="middle"
                              fill="#4b5e52"
                              fontSize={11}
                              fontWeight={600}
                            >
                              {dayPart}
                            </text>
                            <text
                              x={0}
                              y={0}
                              dy={25}
                              textAnchor="middle"
                              fill="#8b9d90"
                              fontSize={9.5}
                            >
                              {monthPart}
                            </text>
                          </g>
                        );
                      }

                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={14}
                            textAnchor="middle"
                            fill="#6b7f72"
                            fontSize={11}
                          >
                            {value}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6b7f72", fontSize: 11 }}
                    width={44}
                    tickFormatter={(val: number) =>
                      Math.abs(val) >= 1000
                        ? `${Number((val / 1000).toFixed(1))}k`
                        : String(val)
                    }
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
                    labelFormatter={(label, payload) => {
                      if (
                        payload &&
                        payload.length > 0 &&
                        payload[0]?.payload?.fullDateLabel
                      ) {
                        return payload[0].payload.fullDateLabel;
                      }
                      return String(label || "");
                    }}
                    formatter={(val, name) => [
                      `RM ${formatRM(Number(val || 0))}`,
                      String(name || ""),
                    ]}
                  />
                  <Bar
                    dataKey="expense"
                    name={
                      dailyExpenseScope === "lifestyle"
                        ? "Lifestyle spent"
                        : "Total spent"
                    }
                    fill="#173f8f"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                    style={{ cursor: "pointer" }}
                    onClick={(barData) => {
                      const rec = barData as unknown as {
                        barKey?: string;
                        fullDateLabel?: string;
                        dateStr?: string;
                        weekIdx?: number;
                        ymPrefix?: string;
                        payload?: {
                          barKey?: string;
                          fullDateLabel?: string;
                          dateStr?: string;
                          weekIdx?: number;
                          ymPrefix?: string;
                        };
                      };
                      const p = rec?.payload || rec;
                      const clickedKey = p?.barKey;
                      if (!clickedKey) return;

                      setSelectedCategoryFilter(null);
                      setSelectedBarFilter((prev) => {
                        if (prev?.key === clickedKey) return null;
                        return {
                          key: clickedKey,
                          label: p.fullDateLabel || clickedKey,
                          mode: timeframe,
                          dateStr: p.dateStr,
                          weekIdx: p.weekIdx,
                          ymPrefix: p.ymPrefix,
                        };
                      });
                    }}
                  >
                    {barChartData.map((entry) => {
                      const isSelected = selectedBarFilter?.key === entry.barKey;
                      return (
                        <Cell
                          key={`bar-cell-${entry.barKey}`}
                          fill={isSelected ? "#3e8e5e" : "#173f8f"}
                          fillOpacity={
                            selectedBarFilter && !isSelected ? 0.45 : 1
                          }
                        />
                      );
                    })}
                  </Bar>
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
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <h5
                className="fw-bold mb-0"
                style={{ fontSize: "1.02rem", color: "#1a2e23" }}
              >
                By category
              </h5>
              {selectedBarFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBarFilter(null);
                    setSelectedCategoryFilter(null);
                  }}
                  className="btn btn-sm rounded-pill border-0 d-inline-flex align-items-center gap-1"
                  style={{
                    backgroundColor: "#e6f4ea",
                    color: "#2b6e46",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    padding: "3px 10px",
                  }}
                  title="Clear bar filter"
                >
                  <span>{selectedBarFilter.label}</span>
                  <i className="bi bi-x-lg" style={{ fontSize: "0.65rem" }} />
                </button>
              ) : (
                <span style={{ fontSize: "0.78rem", color: "#8b9d90" }}>
                  {displayPeriodLabel}
                </span>
              )}
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{
                  minHeight: "220px",
                  color: "#8b9d90",
                  fontSize: "0.85rem",
                }}
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
                  No expenses recorded in{" "}
                  {selectedBarFilter ? selectedBarFilter.label : displayPeriodLabel}
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
                      RM {formatRM(activeCategoryTotalExpense)}
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
            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
              <div style={{ minWidth: 0, flex: 1 }}>
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
                    ? selectedBarFilter
                      ? `Filtered by ${selectedBarFilter.label} · Click Back to categories`
                      : "Showing filtered transactions · Click Show all to reset"
                    : selectedBarFilter
                    ? `Spending in ${selectedBarFilter.label} · Click a category to drill down`
                    : "Ranked by highest spending · Click a category to drill down"}
                </span>
              </div>
              {(selectedCategoryFilter || selectedBarFilter) && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-decoration-none flex-shrink-0"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#3e8e5e",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => {
                    if (selectedCategoryFilter) {
                      setSelectedCategoryFilter(null);
                    } else {
                      setSelectedBarFilter(null);
                    }
                  }}
                >
                  {selectedCategoryFilter && selectedBarFilter
                    ? "Back to categories"
                    : "Show all"}
                </button>
              )}
            </div>

            {loading ? (
              <div
                className="d-flex align-items-center justify-content-center flex-grow-1"
                style={{
                  minHeight: "220px",
                  color: "#8b9d90",
                  fontSize: "0.85rem",
                }}
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
                  {selectedBarFilter ? ` in ${selectedBarFilter.label}` : ""}
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
                            {formatShortMonthDate(tx.transaction_date)}
                            {tx.transaction_time ? ` · ${tx.transaction_time}` : ""}
                            {tx.expense_category ? ` · ${tx.expense_category}` : ""}
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
              /* Ranked Category Progress Bars (for Selected Bar or Full Month) */
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
                      {cat.pct}% of{" "}
                      {selectedBarFilter ? "period spending" : "total spending"}
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
                <div className="col-12 col-sm-6">
                  <div
                    style={{
                      backgroundColor: "#f7f9fc",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      border: "1px solid #e2e8f0",
                      height: "100%",
                    }}
                  >
                    <div
                      className="d-flex align-items-center gap-1 mb-1"
                      style={{
                        fontSize: "0.76rem",
                        color: "#173f8f",
                        fontWeight: 600,
                      }}
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

                <div className="col-12 col-sm-6">
                  <div
                    style={{
                      backgroundColor: "#f6fbf7",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      border: "1px solid #e1efe4",
                      height: "100%",
                    }}
                  >
                    <div
                      className="d-flex align-items-center gap-1 mb-1"
                      style={{
                        fontSize: "0.76rem",
                        color: "#3e8e5e",
                        fontWeight: 600,
                      }}
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
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#4b5e52",
                  lineHeight: 1.4,
                }}
              >
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
