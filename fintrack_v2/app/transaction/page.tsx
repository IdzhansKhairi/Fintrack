"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

type TransactionType = "income" | "expense";

interface SubAccount {
  subaccount_id: string;
  account_id: string;
  user_id: string;
  subaccount_name: string;
  subaccount_value: number;
  is_active: boolean;
}

interface Account {
  account_id: string;
  user_id: string;
  account_name: string;
  account_type: string;
  account_balance: number;
  is_credit_card: boolean;
  credit_limit: number | null;
  unpaid_financing_hold: number;
  is_active: boolean;
  subaccounts: SubAccount[];
}

interface TransactionRecord {
  transaction_id: string;
  user_id: string;
  account_id: string;
  account_name: string;
  subaccount_id: string | null;
  subaccount_name: string | null;
  target_account_id: string | null;
  target_account_name: string | null;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  expense_category: string | null;
  income_category: string | null;
  transaction_date: string; // YYYY-MM-DD
  transaction_time: string; // HH:mm
  is_active: boolean;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  "Food & Drinks",
  "Groceries",
  "Transport",
  "Toll & Parking",
  "Shopping",
  "Internet & Telco",
  "Utilities & Bills",
  "Health & Medical",
  "Entertainment",
  "Hobby",
  "Family & Gifts",
  "Tabung / Savings",
  "Debt / Lending",
  "Debt Repayment",
  "Financing / Installment",
  "Credit Card Payment",
  "Commitment",
  "Others",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Freelance / Side Income",
  "Gift / Allowance",
  "Payback / Reimbursement",
  "Debt Borrowed",
  "Investment Return",
  "Tabung Withdrawal",
  "Others",
];

const MONTHS = [
  { value: "all", label: "All months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

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

function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function formatShortMonthDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthName = SHORT_MONTH_NAMES[monthIdx] || parts[1];
    return `${parts[2]} ${monthName} ${parts[0]}`;
  }
  return dateStr;
}

export default function TransactionPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Add Transaction Modal State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [txAmountInput, setTxAmountInput] = useState<string>("");
  const [txDescription, setTxDescription] = useState<string>("");
  const [isTodayChecked, setIsTodayChecked] = useState<boolean>(true);
  const [txDate, setTxDate] = useState<string>(getTodayDateString());
  const [txCategory, setTxCategory] = useState<string>("");
  const [txAccountId, setTxAccountId] = useState<string>("");
  const [txSubAccountId, setTxSubAccountId] = useState<string>("");
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [savingTx, setSavingTx] = useState<boolean>(false);

  // Cancel Transaction Modal State
  const [cancellingTx, setCancellingTx] = useState<TransactionRecord | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState<boolean>(false);
  const [cancelModalError, setCancelModalError] = useState<string | null>(null);
  const [tabungLinks, setTabungLinks] = useState<Record<string, string>>({});
  const [financingLinks, setFinancingLinks] = useState<Record<string, string>>({});
  const [commitmentLinks, setCommitmentLinks] = useState<Record<string, string>>({});
  const [debtLinks, setDebtLinks] = useState<
    Record<string, { label: string; kind: "created" | "settled"; status: string }>
  >({});

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

  // Active accounts available for new transactions
  const activeAccounts = useMemo(
    () => allAccounts.filter((acc) => acc.is_active),
    [allAccounts]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
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

      const [
        accountsRes,
        subaccountsRes,
        transactionsRes,
        finPlanRes,
        finAllInstRes,
      ] = await Promise.all([
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
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("transaction_date", { ascending: false })
          .order("transaction_time", { ascending: false }),
        supabase
          .from("financing")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("financing_installments")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      const rawAccounts = accountsRes.data || [];
      const rawSubs = subaccountsRes.data || [];
      const rawTxs = transactionsRes.data || [];
      const rawFinPlans = finPlanRes.data || [];
      const rawFinInsts = finAllInstRes.data || [];

      const holdByAccountId = new Map<string, number>();
      rawFinPlans.forEach((p) => {
        if (!p.account_id || p.status !== "active") return;
        const paidSum = rawFinInsts
          .filter(
            (i) => i.financing_id === p.financing_id && i.status === "paid"
          )
          .reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
        const rem = Math.max(
          0,
          Math.round((Number(p.total_amount || 0) - paidSum) * 100) / 100
        );
        if (rem > 0) {
          holdByAccountId.set(
            p.account_id,
            Math.round(((holdByAccountId.get(p.account_id) || 0) + rem) * 100) /
              100
          );
        }
      });

      const accountMap = new Map<string, string>();
      rawAccounts.forEach((acc) => {
        accountMap.set(acc.account_id, acc.account_name);
      });

      const subAccountMap = new Map<string, string>();
      rawSubs.forEach((sub) => {
        subAccountMap.set(sub.subaccount_id, sub.subaccount_name);
      });

      const mergedAccounts: Account[] = rawAccounts.map((acc) => ({
        ...acc,
        account_balance: Number(acc.account_balance),
        is_credit_card: Boolean(
          acc.is_credit_card || acc.account_type === "Credit Card"
        ),
        credit_limit:
          acc.credit_limit !== null && acc.credit_limit !== undefined
            ? Number(acc.credit_limit)
            : null,
        unpaid_financing_hold: holdByAccountId.get(acc.account_id) || 0,
        subaccounts: rawSubs
          .filter((sub) => sub.account_id === acc.account_id && sub.is_active)
          .map((sub) => ({
            ...sub,
            subaccount_value: Number(sub.subaccount_value),
          })),
      }));

      const mappedTxs: TransactionRecord[] = rawTxs.map((tx) => ({
        transaction_id: tx.transaction_id,
        user_id: tx.user_id,
        account_id: tx.account_id,
        account_name: accountMap.get(tx.account_id) || "Deleted Account",
        subaccount_id: tx.subaccount_id,
        subaccount_name: tx.subaccount_id
          ? subAccountMap.get(tx.subaccount_id) || null
          : null,
        target_account_id: tx.target_account_id || null,
        target_account_name: tx.target_account_id
          ? accountMap.get(tx.target_account_id) || "Credit Card"
          : null,
        transaction_type: tx.transaction_type as TransactionType,
        amount: Number(tx.amount),
        description: tx.description,
        expense_category: tx.expense_category,
        income_category: tx.income_category,
        transaction_date: tx.transaction_date,
        transaction_time: tx.transaction_time,
        is_active: tx.is_active,
        created_at: tx.created_at,
      }));

      setAllAccounts(mergedAccounts);
      setTransactions(mappedTxs);

      // Load linked Tabung names for transactions created from Tabung contributions
      const [linkRes, tabungRes] = await Promise.all([
        supabase
          .from("tabung_contribution")
          .select("transaction_id, tabung_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .not("transaction_id", "is", null),
        supabase
          .from("tabung")
          .select("tabung_id, tabung_name")
          .eq("user_id", user.id),
      ]);
      if (!linkRes.error && !tabungRes.error) {
        const tabungNames = new Map<string, string>();
        (tabungRes.data || []).forEach((t) =>
          tabungNames.set(t.tabung_id, t.tabung_name)
        );
        const links: Record<string, string> = {};
        (linkRes.data || []).forEach((row) => {
          if (row.transaction_id) {
            links[row.transaction_id] =
              tabungNames.get(row.tabung_id) || "Tabung";
          }
        });
        setTabungLinks(links);
      }

      // Load linked Debts for transactions created from or settling Debts
      const { data: debtRows, error: debtErr } = await supabase
        .from("debts")
        .select(
          "debts_name, debts_person, status, transaction_id, settled_transaction_id"
        )
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (!debtErr && debtRows) {
        const dLinks: Record<
          string,
          { label: string; kind: "created" | "settled"; status: string }
        > = {};
        debtRows.forEach((d) => {
          const label = `${d.debts_person} (${d.debts_name})`;
          if (d.transaction_id) {
            dLinks[d.transaction_id] = {
              label,
              kind: "created",
              status: d.status,
            };
          }
          if (d.settled_transaction_id) {
            dLinks[d.settled_transaction_id] = {
              label,
              kind: "settled",
              status: d.status,
            };
          }
        });
        setDebtLinks(dLinks);
      }

      // Build linked Financing installments map from already-fetched financing data
      if (!finAllInstRes.error && !finPlanRes.error) {
        const planMap = new Map<string, string>();
        rawFinPlans.forEach((p) => {
          planMap.set(
            p.financing_id,
            `${p.financing_name} (${p.financing_provider})`
          );
        });
        const fLinks: Record<string, string> = {};
        rawFinInsts.forEach((inst) => {
          if (inst.transaction_id) {
            const pLabel = planMap.get(inst.financing_id) || "Financing";
            fLinks[inst.transaction_id] = `${pLabel} — Installment #${inst.installment_number}`;
          }
        });
        setFinancingLinks(fLinks);
      }

      // Load linked Commitment payments for transactions
      const [comPayRes, comListRes] = await Promise.all([
        supabase
          .from("commitment_payments")
          .select("transaction_id, commitment_id, payment_month, payment_year")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .not("transaction_id", "is", null),
        supabase
          .from("commitments")
          .select("commitment_id, commitment_name")
          .eq("user_id", user.id),
      ]);
      if (!comPayRes.error && !comListRes.error) {
        const comMap = new Map<string, string>();
        (comListRes.data || []).forEach((c) => {
          comMap.set(c.commitment_id, c.commitment_name);
        });
        const cLinks: Record<string, string> = {};
        (comPayRes.data || []).forEach((cp) => {
          if (cp.transaction_id) {
            const cName = comMap.get(cp.commitment_id) || "Commitment";
            cLinks[cp.transaction_id] = `${cName} (${String(cp.payment_month).padStart(2, "0")}/${cp.payment_year})`;
          }
        });
        setCommitmentLinks(cLinks);
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const todayStr = getTodayDateString();

  // Spent Today (excludes Commitments, Financing/Installments, Debts, and Credit Card settlements)
  const spentToday = useMemo(() => {
    const EXCLUDED_DAILY_CATEGORIES = new Set([
      "Commitment",
      "Commitments",
      "Financing / Installment",
      "Financing Installment",
      "Debt / Lending",
      "Debt Repayment",
      "Credit Card Payment",
    ]);
    let total = 0;
    transactions.forEach((tx) => {
      if (
        tx.is_active &&
        tx.transaction_type === "expense" &&
        tx.transaction_date === todayStr &&
        !tx.target_account_id &&
        !EXCLUDED_DAILY_CATEGORIES.has((tx.expense_category || "").trim())
      ) {
        total += tx.amount;
      }
    });
    return total;
  }, [transactions, todayStr]);

  // Dynamically derive max days (28, 29, 30, or 31) based on selectedMonth & selectedYear
  const maxDaysInSelectedMonth = useMemo(() => {
    if (selectedMonth === "all") return 31;
    const m = parseInt(selectedMonth, 10);
    if (m === 2) {
      if (selectedYear !== "all") {
        const y = parseInt(selectedYear, 10);
        return new Date(y, 2, 0).getDate();
      }
      return 29;
    }
    if ([4, 6, 9, 11].includes(m)) return 30;
    return 31;
  }, [selectedMonth, selectedYear]);

  const availableDays = useMemo(() => {
    return Array.from({ length: maxDaysInSelectedMonth }, (_, i) => {
      const dayNum = i + 1;
      return {
        value: String(dayNum).padStart(2, "0"),
        label: `${dayNum}`,
      };
    });
  }, [maxDaysInSelectedMonth]);

  useEffect(() => {
    if (
      selectedDay !== "all" &&
      parseInt(selectedDay, 10) > maxDaysInSelectedMonth
    ) {
      setSelectedDay("all");
    }
  }, [selectedDay, maxDaysInSelectedMonth]);

  // Dynamically derive available years from active transactions (sorted descending from latest year)
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.is_active && tx.transaction_date) {
        const yr = tx.transaction_date.slice(0, 4);
        if (yr) yearSet.add(yr);
      }
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [transactions]);

  // Filtered and Sorted Transactions
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = transactions.filter((tx) => {
      if (!tx.is_active) return false;

      // Search filter (description, category, account, or sub-account)
      if (query) {
        const categoryText =
          tx.transaction_type === "expense"
            ? tx.expense_category || ""
            : tx.income_category || "";
        const matchDesc = tx.description.toLowerCase().includes(query);
        const matchCat = categoryText.toLowerCase().includes(query);
        const matchAcc = tx.account_name.toLowerCase().includes(query);
        const matchSub = (tx.subaccount_name || "").toLowerCase().includes(query);
        if (!matchDesc && !matchCat && !matchAcc && !matchSub) return false;
      }

      // Day filter
      if (selectedDay !== "all") {
        const txDay = tx.transaction_date.slice(8, 10);
        if (txDay !== selectedDay) return false;
      }

      // Month filter
      if (selectedMonth !== "all") {
        const txMonth = tx.transaction_date.slice(5, 7);
        if (txMonth !== selectedMonth) return false;
      }

      // Year filter
      if (selectedYear !== "all") {
        const txYear = tx.transaction_date.slice(0, 4);
        if (txYear !== selectedYear) return false;
      }

      // Type filter
      if (selectedType !== "all") {
        if (tx.transaction_type !== selectedType) return false;
      }

      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === "newest") {
        const dtA = `${a.transaction_date} ${a.transaction_time}`;
        const dtB = `${b.transaction_date} ${b.transaction_time}`;
        const cmp = dtB.localeCompare(dtA);
        if (cmp !== 0) return cmp;
        return (b.created_at || "").localeCompare(a.created_at || "");
      }
      if (sortBy === "oldest") {
        const dtA = `${a.transaction_date} ${a.transaction_time}`;
        const dtB = `${b.transaction_date} ${b.transaction_time}`;
        const cmp = dtA.localeCompare(dtB);
        if (cmp !== 0) return cmp;
        return (a.created_at || "").localeCompare(b.created_at || "");
      }
      if (sortBy === "amount_asc") {
        return a.amount - b.amount;
      }
      if (sortBy === "amount_desc") {
        return b.amount - a.amount;
      }
      return 0;
    });
  }, [transactions, searchQuery, selectedDay, selectedMonth, selectedYear, selectedType, sortBy]);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const formatGroupDateHeader = (dateStr: string) => {
    const formatted = formatShortMonthDate(dateStr);
    if (dateStr === todayStr) return `Today · ${formatted}`;
    if (dateStr === yesterdayStr) return `Yesterday · ${formatted}`;
    return formatted;
  };

  // Group filteredTransactions by transaction_date with daily totals (including all transactions in that day)
  const groupedTransactions = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        date: string;
        items: TransactionRecord[];
        expenseTotal: number;
        incomeTotal: number;
      }
    >();

    filteredTransactions.forEach((tx) => {
      const d = tx.transaction_date;
      let grp = groupsMap.get(d);
      if (!grp) {
        grp = {
          date: d,
          items: [],
          expenseTotal: 0,
          incomeTotal: 0,
        };
        groupsMap.set(d, grp);
      }
      grp.items.push(tx);
      if (tx.transaction_type === "income") {
        grp.incomeTotal += tx.amount;
      } else {
        grp.expenseTotal += tx.amount;
      }
    });

    return Array.from(groupsMap.values());
  }, [filteredTransactions]);

  // Summary Totals for Filtered Transactions
  const {
    filteredInflow,
    filteredOutflow,
    cardSettlementOutflow,
  } = useMemo(() => {
    let inflow = 0;
    let spendingOutflow = 0;
    let ccSettlement = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.transaction_type === "income") {
        inflow += tx.amount;
      } else if (
        tx.expense_category === "Credit Card Payment" ||
        Boolean(tx.target_account_id)
      ) {
        ccSettlement += tx.amount;
      } else {
        spendingOutflow += tx.amount;
      }
    });
    // If the user filtered specifically to only Credit Card Payment rows, show that total;
    // otherwise exclude card bill settlements from spending outflow so card swipes are never double-counted.
    const effectiveOutflow =
      spendingOutflow === 0 && ccSettlement > 0 ? ccSettlement : spendingOutflow;
    return {
      filteredInflow: inflow,
      filteredOutflow: effectiveOutflow,
      cardSettlementOutflow:
        spendingOutflow > 0 && ccSettlement > 0 ? ccSettlement : 0,
    };
  }, [filteredTransactions]);

  // Selected Account object in Add Modal
  const selectedModalAccount = useMemo(
    () => activeAccounts.find((acc) => acc.account_id === txAccountId) || null,
    [activeAccounts, txAccountId]
  );

  // Available and unallocated balance breakdown for modal
  const modalAccountInfo = useMemo(() => {
    if (!selectedModalAccount) {
      return {
        allocatedSum: 0,
        unallocated: 0,
        currentAvailable: 0,
        isCreditCard: false,
      };
    }
    const isCreditCard = Boolean(
      selectedModalAccount.is_credit_card ||
        selectedModalAccount.account_type === "Credit Card"
    );
    if (isCreditCard) {
      const limit = Number(selectedModalAccount.credit_limit || 0);
      const hold = Number(selectedModalAccount.unpaid_financing_hold || 0);
      const availCredit = Math.max(
        0,
        Math.round(
          (limit - hold + selectedModalAccount.account_balance) * 100
        ) / 100
      );
      const maxRefundable = Math.abs(
        Math.min(0, selectedModalAccount.account_balance)
      );
      return {
        allocatedSum: 0,
        unallocated: 0,
        currentAvailable: txType === "expense" ? availCredit : maxRefundable,
        isCreditCard: true,
      };
    }

    const allocatedSum = selectedModalAccount.subaccounts.reduce(
      (sum, s) => sum + Number(s.subaccount_value),
      0
    );
    const unallocated = Math.max(
      0,
      Number((selectedModalAccount.account_balance - allocatedSum).toFixed(2))
    );

    let currentAvailable = selectedModalAccount.account_balance;
    if (selectedModalAccount.subaccounts.length > 0) {
      if (txSubAccountId) {
        const sub = selectedModalAccount.subaccounts.find(
          (s) => s.subaccount_id === txSubAccountId
        );
        currentAvailable = sub ? sub.subaccount_value : 0;
      } else {
        currentAvailable = unallocated;
      }
    }
    return {
      allocatedSum,
      unallocated,
      currentAvailable,
      isCreditCard: false,
    };
  }, [selectedModalAccount, txSubAccountId, txType]);

  // Open Add Transaction Modal
  const openAddTransactionModal = () => {
    const todayStr = getTodayDateString();
    setTxType("expense");
    setTxAmountInput("");
    setTxDescription("");
    setIsTodayChecked(true);
    setTxDate(todayStr);
    setTxCategory("");
    const defaultAcc = activeAccounts[0];
    setTxAccountId(defaultAcc ? defaultAcc.account_id : "");

    // If default account is 100% partitioned into sub-accounts, auto-select first sub-account
    if (defaultAcc && defaultAcc.subaccounts.length > 0) {
      const allocated = defaultAcc.subaccounts.reduce(
        (sum, s) => sum + Number(s.subaccount_value),
        0
      );
      if (defaultAcc.account_balance - allocated <= 0.001) {
        setTxSubAccountId(defaultAcc.subaccounts[0]?.subaccount_id || "");
      } else {
        setTxSubAccountId("");
      }
    } else {
      setTxSubAccountId("");
    }

    setAddModalError(null);
    setAddModalOpen(true);
  };

  // Handle "Today" Checkbox Toggle
  const handleTodayCheckboxChange = (checked: boolean) => {
    setIsTodayChecked(checked);
    if (checked) {
      setTxDate(getTodayDateString());
    }
  };

  // Handle Type Change in Modal
  const handleTxTypeChange = (newType: TransactionType) => {
    setTxType(newType);
    setTxCategory("");
  };

  // Handle Account Change in Modal
  const handleTxAccountChange = (newAccountId: string) => {
    setTxAccountId(newAccountId);
    const targetAcc = activeAccounts.find((a) => a.account_id === newAccountId);
    if (targetAcc && targetAcc.subaccounts.length > 0) {
      const allocated = targetAcc.subaccounts.reduce(
        (sum, s) => sum + Number(s.subaccount_value),
        0
      );
      if (targetAcc.account_balance - allocated <= 0.001) {
        setTxSubAccountId(targetAcc.subaccounts[0]?.subaccount_id || "");
        return;
      }
    }
    setTxSubAccountId("");
  };

  // Submit New Transaction to Supabase
  const handleAddTransactionSubmit = async () => {
    setAddModalError(null);

    if (!userId) {
      setAddModalError("You must be signed in to add a transaction.");
      return;
    }

    const parsedAmount = parseFloat(txAmountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAddModalError("Please enter a valid amount greater than RM 0.00.");
      return;
    }

    const roundedAmount = Math.round(parsedAmount * 100) / 100;

    if (!txDescription.trim()) {
      setAddModalError("Please enter a description for this transaction.");
      return;
    }

    const recordedDate = isTodayChecked ? getTodayDateString() : txDate;
    if (!recordedDate) {
      setAddModalError("Please select a transaction date.");
      return;
    }

    if (!txCategory) {
      setAddModalError(
        `Please select an ${txType === "expense" ? "expense" : "income"} category.`
      );
      return;
    }

    const parentAcc = activeAccounts.find((a) => a.account_id === txAccountId);
    if (!parentAcc) {
      setAddModalError("Please select an active account.");
      return;
    }

    const selectedSub =
      parentAcc.subaccounts.find((s) => s.subaccount_id === txSubAccountId) || null;

    const isCreditCard = Boolean(
      parentAcc.is_credit_card || parentAcc.account_type === "Credit Card"
    );

    if (isCreditCard) {
      const limit = Number(parentAcc.credit_limit || 0);
      const hold = Number(parentAcc.unpaid_financing_hold || 0);
      const availCredit = Math.max(
        0,
        Math.round((limit - hold + parentAcc.account_balance) * 100) / 100
      );
      if (txType === "expense") {
        if (roundedAmount > availCredit + 0.001) {
          setAddModalError(
            `Expense amount (RM ${formatAmount(
              roundedAmount
            )}) exceeds available credit limit on "${
              parentAcc.account_name
            }" (RM ${formatAmount(availCredit)}).`
          );
          return;
        }
      } else {
        const maxRefund = Math.abs(Math.min(0, parentAcc.account_balance));
        if (roundedAmount > maxRefund + 0.001) {
          setAddModalError(
            `Credit card income/refund (RM ${formatAmount(
              roundedAmount
            )}) cannot exceed the current swipe balance owed on "${
              parentAcc.account_name
            }" (RM ${formatAmount(maxRefund)}).`
          );
          return;
        }
      }
    } else {
      // Selected Account available & unallocated balance calculation
      const allocatedSum = parentAcc.subaccounts.reduce(
        (sum, s) => sum + Number(s.subaccount_value),
        0
      );
      const unallocatedBalance = Number(
        (parentAcc.account_balance - allocatedSum).toFixed(2)
      );

      // Validate sub-account / unallocated balance on expense
      if (txType === "expense") {
        if (selectedSub) {
          if (roundedAmount > selectedSub.subaccount_value + 0.001) {
            setAddModalError(
              `Expense amount (RM ${formatAmount(
                roundedAmount
              )}) exceeds available balance in sub-account "${
                selectedSub.subaccount_name
              }" (RM ${formatAmount(selectedSub.subaccount_value)}).`
            );
            return;
          }
        } else if (parentAcc.subaccounts.length > 0) {
          if (unallocatedBalance <= 0) {
            setAddModalError(
              `All funds in "${parentAcc.account_name}" are fully allocated to sub-accounts. Please select a sub-account for this expense.`
            );
            return;
          }
          if (roundedAmount > unallocatedBalance + 0.001) {
            setAddModalError(
              `Expense amount (RM ${formatAmount(
                roundedAmount
              )}) exceeds available unallocated balance in "${
                parentAcc.account_name
              }" (RM ${formatAmount(
                Math.max(0, unallocatedBalance)
              )}). Please select a sub-account or enter a lower amount.`
            );
            return;
          }
        } else {
          // Account has no sub-accounts: validate directly against account balance
          if (roundedAmount > parentAcc.account_balance + 0.001) {
            setAddModalError(
              `Expense amount (RM ${formatAmount(
                roundedAmount
              )}) exceeds available balance in "${
                parentAcc.account_name
              }" (RM ${formatAmount(parentAcc.account_balance)}).`
            );
            return;
          }
        }
      }
    }

    // Determine transaction time:
    // If "Today" checkbox is ticked -> use current live time (HH:mm)
    // If "Today" checkbox is unticked -> use 23:59 (11:59 PM)
    const recordedTime = isTodayChecked ? getCurrentTimeString() : "23:59";

    setSavingTx(true);
    try {
      // 1. Insert transaction row
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: userId,
        account_id: parentAcc.account_id,
        subaccount_id: selectedSub ? selectedSub.subaccount_id : null,
        transaction_type: txType,
        amount: roundedAmount,
        description: txDescription.trim(),
        expense_category: txType === "expense" ? txCategory : null,
        income_category: txType === "income" ? txCategory : null,
        transaction_date: recordedDate,
        transaction_time: recordedTime,
        is_active: true,
      });

      if (txError) throw txError;

      // 2. Update parent account balance
      const balanceDelta = txType === "income" ? roundedAmount : -roundedAmount;
      const newAccountBalance =
        Math.round((parentAcc.account_balance + balanceDelta) * 100) / 100;

      const { error: accError } = await supabase
        .from("accounts")
        .update({ account_balance: newAccountBalance })
        .eq("account_id", parentAcc.account_id)
        .eq("user_id", userId);

      if (accError) throw accError;

      // 3. Update sub-account balance if a sub-account was selected
      if (selectedSub) {
        const newSubBalance =
          Math.round((selectedSub.subaccount_value + balanceDelta) * 100) / 100;

        const { error: subError } = await supabase
          .from("subaccounts")
          .update({ subaccount_value: newSubBalance })
          .eq("subaccount_id", selectedSub.subaccount_id)
          .eq("user_id", userId);

        if (subError) throw subError;
      }

      setAddModalOpen(false);
      showToast(
        `"${txDescription.trim()}" (RM ${formatAmount(roundedAmount)}) added`,
        "success"
      );
      await fetchData();
    } catch (err: any) {
      setAddModalError(err.message || "Failed to record transaction.");
    } finally {
      setSavingTx(false);
    }
  };

  // Confirm Cancel Transaction in Supabase
  const handleConfirmCancelTransaction = async () => {
    if (!cancellingTx || !userId) return;
    setCancelModalError(null);
    setCancellingLoading(true);

    try {
      const parentAcc = allAccounts.find(
        (a) => a.account_id === cancellingTx.account_id
      );

      const reverseDelta =
        cancellingTx.transaction_type === "income"
          ? -cancellingTx.amount
          : cancellingTx.amount;

      // Guard 0a: If parentAcc is a Credit Card, ensure cancelling doesn't push balance > RM 0.00 or exceed available credit limit
      if (
        parentAcc &&
        (parentAcc.is_credit_card || parentAcc.account_type === "Credit Card")
      ) {
        const projectedBal =
          Math.round((parentAcc.account_balance + reverseDelta) * 100) / 100;
        if (projectedBal > 0.001) {
          const currentOwed = Math.abs(Math.min(0, parentAcc.account_balance));
          setCancelModalError(
            `Cannot cancel this card expense because "${
              parentAcc.account_name
            }" currently only owes RM ${formatAmount(
              currentOwed
            )} (the card balance was already paid down). Cancel the Credit Card Payment transaction first.`
          );
          setCancellingLoading(false);
          return;
        }
        const limit = Number(parentAcc.credit_limit || 0);
        const hold = Number(parentAcc.unpaid_financing_hold || 0);
        const availCredit = Math.max(
          0,
          Math.round((limit - hold + parentAcc.account_balance) * 100) / 100
        );
        if (
          cancellingTx.transaction_type === "income" &&
          cancellingTx.amount > availCredit + 0.001
        ) {
          setCancelModalError(
            `Cannot cancel this refund because restoring RM ${formatAmount(
              cancellingTx.amount
            )} onto "${
              parentAcc.account_name
            }" would exceed its available credit limit (RM ${formatAmount(
              availCredit
            )}).`
          );
          setCancellingLoading(false);
          return;
        }
      }

      // Guard 0b: If this is a "Pay card" settlement (target_account_id), ensure target card has enough available credit limit to restore the owed balance
      if (cancellingTx.target_account_id) {
        const targetCC = allAccounts.find(
          (a) => a.account_id === cancellingTx.target_account_id
        );
        if (
          targetCC &&
          (targetCC.is_credit_card || targetCC.account_type === "Credit Card")
        ) {
          const limit = Number(targetCC.credit_limit || 0);
          const hold = Number(targetCC.unpaid_financing_hold || 0);
          const availCredit = Math.max(
            0,
            Math.round((limit - hold + targetCC.account_balance) * 100) / 100
          );
          if (cancellingTx.amount > availCredit + 0.001) {
            setCancelModalError(
              `Cannot cancel this Credit Card Payment because restoring -RM ${formatAmount(
                cancellingTx.amount
              )} onto "${
                targetCC.account_name
              }" would exceed its remaining available credit limit (RM ${formatAmount(
                availCredit
              )}).`
            );
            setCancellingLoading(false);
            return;
          }
        }
      }

      // Guard 0c: If linked to a Financing installment whose parent plan is linked to a Credit Card,
      // ensure the Credit Card has enough available credit limit to absorb the restored installment hold.
      const { data: linkedInsts } = await supabase
        .from("financing_installments")
        .select("*")
        .eq("transaction_id", cancellingTx.transaction_id)
        .eq("user_id", userId)
        .eq("is_active", true);

      if (linkedInsts && linkedInsts.length > 0) {
        const planIds = Array.from(
          new Set(linkedInsts.map((i: any) => i.financing_id))
        );
        const { data: parentPlans } = await supabase
          .from("financing")
          .select("financing_id, financing_name, account_id, total_amount")
          .in("financing_id", planIds)
          .eq("user_id", userId);

        if (parentPlans && parentPlans.length > 0) {
          for (const plan of parentPlans) {
            if (plan.account_id) {
              const linkedCard = allAccounts.find(
                (a) => a.account_id === plan.account_id
              );
              if (
                linkedCard &&
                (linkedCard.is_credit_card ||
                  linkedCard.account_type === "Credit Card") &&
                linkedCard.credit_limit != null
              ) {
                const limit = Number(linkedCard.credit_limit || 0);
                const hold = Number(linkedCard.unpaid_financing_hold || 0);
                const availCredit = Math.max(
                  0,
                  Math.round(
                    (limit - hold + linkedCard.account_balance) * 100
                  ) / 100
                );
                const restoredHoldForPlan = linkedInsts
                  .filter((i: any) => i.financing_id === plan.financing_id)
                  .reduce(
                    (s: number, i: any) => s + Number(i.amount_paid || 0),
                    0
                  );

                if (restoredHoldForPlan > availCredit + 0.001) {
                  setCancelModalError(
                    `Cannot cancel this installment payment because restoring RM ${formatAmount(
                      restoredHoldForPlan
                    )} of installment hold onto "${
                      linkedCard.account_name
                    }" would exceed its remaining available credit limit (RM ${formatAmount(
                      availCredit
                    )}).`
                  );
                  setCancellingLoading(false);
                  return;
                }
              }
            }
          }
        }
      }

      // 1. Soft-delete the transaction
      const { error: txError } = await supabase
        .from("transactions")
        .update({ is_active: false })
        .eq("transaction_id", cancellingTx.transaction_id)
        .eq("user_id", userId);

      if (txError) throw txError;

      // 1b. Also soft-delete any linked Tabung contribution
      await supabase
        .from("tabung_contribution")
        .update({ is_active: false })
        .eq("transaction_id", cancellingTx.transaction_id)
        .eq("user_id", userId);

      // 1c. If this transaction was a Credit Card Payment (has target_account_id), reverse the target Credit Card balance too
      if (cancellingTx.target_account_id) {
        const targetCC = allAccounts.find(
          (a) => a.account_id === cancellingTx.target_account_id
        );
        if (targetCC) {
          const restoredCCBalance =
            Math.round(
              (targetCC.account_balance - cancellingTx.amount) * 100
            ) / 100;
          await supabase
            .from("accounts")
            .update({ account_balance: restoredCCBalance })
            .eq("account_id", targetCC.account_id)
            .eq("user_id", userId);
        }
      }

      // 1d. If linked to a Financing installment, revert that installment (and any cascaded installments) back to Pending
      if (linkedInsts && linkedInsts.length > 0) {
        for (const inst of linkedInsts) {
          const { data: siblingInsts } = await supabase
            .from("financing_installments")
            .select("*")
            .eq("financing_id", inst.financing_id)
            .eq("user_id", userId)
            .eq("is_active", true);

          const cascadeRegex = new RegExp(
            `(?:\\s*\\|\\s*)?(?:Settled early via Installment #${inst.installment_number}\\s*|Reduced by RM [0-9,.]+ from Installment #${inst.installment_number}\\s*)?\\[Cascaded from #${inst.installment_number}: RM ([0-9.]+)\\]`
          );

          if (siblingInsts) {
            for (const sib of siblingInsts) {
              if (
                sib.installment_id === inst.installment_id ||
                !sib.installment_notes
              ) {
                continue;
              }
              const match = sib.installment_notes.match(cascadeRegex);
              if (match) {
                const cascadedAmt =
                  Math.round(parseFloat(match[1] || "0") * 100) / 100;
                const restoredDue =
                  Math.round((Number(sib.amount_due) + cascadedAmt) * 100) /
                  100;
                const cleanedNote =
                  sib.installment_notes.replace(cascadeRegex, "").trim() ||
                  null;
                const wasCascadedPaid =
                  sib.status === "paid" && Number(sib.amount_paid) === 0;

                await supabase
                  .from("financing_installments")
                  .update({
                    amount_due: restoredDue,
                    status: wasCascadedPaid ? "pending" : sib.status,
                    paid_at: wasCascadedPaid ? null : sib.paid_at,
                    installment_notes: cleanedNote,
                  })
                  .eq("installment_id", sib.installment_id)
                  .eq("user_id", userId);
              }
            }
          }

          await supabase
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

          await supabase
            .from("financing")
            .update({ status: "active" })
            .eq("financing_id", inst.financing_id)
            .eq("user_id", userId);
        }
      }

      // 1e. If linked to a Monthly Commitment payment, revert it
      await supabase
        .from("commitment_payments")
        .update({
          is_paid: false,
          paid_at: null,
          account_id: null,
          subaccount_id: null,
          transaction_id: null,
          is_active: false,
        })
        .eq("transaction_id", cancellingTx.transaction_id)
        .eq("user_id", userId);

      // 1f. If linked to a Debt record, sync debt state
      const debtLink = debtLinks[cancellingTx.transaction_id];
      if (debtLink) {
        if (debtLink.kind === "settled") {
          await supabase
            .from("debts")
            .update({
              status: "pending",
              settled_at: null,
              settled_account_id: null,
              settled_subaccount_id: null,
              settled_transaction_id: null,
            })
            .eq("settled_transaction_id", cancellingTx.transaction_id)
            .eq("user_id", userId);
        } else if (debtLink.status === "pending") {
          await supabase
            .from("debts")
            .update({ is_active: false })
            .eq("transaction_id", cancellingTx.transaction_id)
            .eq("user_id", userId);
        } else {
          await supabase
            .from("debts")
            .update({
              account_id: null,
              subaccount_id: null,
              transaction_id: null,
            })
            .eq("transaction_id", cancellingTx.transaction_id)
            .eq("user_id", userId);
        }
      }

      // 2. Update parent account balance
      if (parentAcc) {
        const newAccountBalance =
          Math.round((parentAcc.account_balance + reverseDelta) * 100) / 100;

        const { error: accError } = await supabase
          .from("accounts")
          .update({ account_balance: newAccountBalance })
          .eq("account_id", parentAcc.account_id)
          .eq("user_id", userId);

        if (accError) throw accError;

        // 3. Update sub-account balance if present
        if (cancellingTx.subaccount_id) {
          const targetSub = parentAcc.subaccounts.find(
            (s) => s.subaccount_id === cancellingTx.subaccount_id
          );
          if (targetSub) {
            const newSubBalance = Math.max(
              0,
              Math.round((targetSub.subaccount_value + reverseDelta) * 100) / 100
            );
            const { error: subError } = await supabase
              .from("subaccounts")
              .update({ subaccount_value: newSubBalance })
              .eq("subaccount_id", targetSub.subaccount_id)
              .eq("user_id", userId);

            if (subError) throw subError;
          }
        }
      }

      const cancelledDesc = cancellingTx.description;
      setCancellingTx(null);
      showToast(`"${cancelledDesc}" transaction cancelled`, "danger");
      await fetchData();
    } catch (err: any) {
      setCancelModalError(err.message || "Failed to cancel transaction.");
    } finally {
      setCancellingLoading(false);
    }
  };

  // Balance calculations for Cancel Transaction Modal
  const cancelModalBalanceInfo = useMemo(() => {
    if (!cancellingTx) {
      return { balanceNow: 0, balanceAfter: 0 };
    }
    const acc = allAccounts.find((a) => a.account_id === cancellingTx.account_id);
    const isCc = Boolean(
      acc && (acc.is_credit_card || acc.account_type === "Credit Card")
    );
    const hold = isCc && acc ? Number(acc.unpaid_financing_hold || 0) : 0;
    const balanceNow = acc
      ? Number((acc.account_balance - hold).toFixed(2))
      : 0;
    const reverseDelta =
      cancellingTx.transaction_type === "income"
        ? -cancellingTx.amount
        : cancellingTx.amount;
    const balanceAfter = Number((balanceNow + reverseDelta).toFixed(2));
    return { balanceNow, balanceAfter };
  }, [cancellingTx, allAccounts]);

  const categoryOptions =
    txType === "expense"
      ? EXPENSE_CATEGORIES.filter((c) => c !== "Credit Card Payment")
      : INCOME_CATEGORIES;

  return (
    <div>
      {/* Header Row */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle mb-3">
            Track every income and expense in ringgit
          </p>
        </div>
        <div className="pt-1">
          <AddButton onClick={openAddTransactionModal}>Add transaction</AddButton>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="row g-4 mb-4">
        {/* Card 1: Spent Today (Gradient Hero Card) */}
        <div className="col-12 col-md-4">
          <div
            className="h-100 d-flex flex-column justify-content-between text-white"
            style={{
              background:
                "linear-gradient(90deg, #1d5bbf 0%, #3e8879 55%, #5ba77b 100%)",
              borderRadius: "18px",
              padding: "20px 24px",
              boxShadow: "0 4px 14px rgba(29, 91, 191, 0.12)",
            }}
          >
            <div>
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  fontSize: "0.78rem",
                  color: "rgba(255, 255, 255, 0.82)",
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                <span>Spent today</span>
                <span style={{ fontSize: "0.72rem" }}>
                  {formatShortMonthDate(todayStr)}
                </span>
              </div>
              <div
                style={{
                  fontSize: "1.55rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1.2,
                }}
              >
                RM {formatAmount(spentToday)}
              </div>
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(255, 255, 255, 0.78)",
                marginTop: "6px",
                lineHeight: 1.35,
              }}
            >
              Excludes commitments, financing, debts &amp; card bills
            </div>
          </div>
        </div>

        {/* Card 2: Filtered Inflow */}
        <div className="col-12 col-md-4">
          <div
            className="h-100 d-flex flex-column justify-content-center"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "20px 24px",
              border: "1px solid #eef2ed",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                color: "#6b7f72",
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              Filtered inflow
            </div>
            <div
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#10b981",
                lineHeight: 1.2,
              }}
            >
              RM {formatAmount(filteredInflow)}
            </div>
          </div>
        </div>

        {/* Card 3: Filtered Outflow */}
        <div className="col-12 col-md-4">
          <div
            className="h-100 d-flex flex-column justify-content-center"
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "20px 24px",
              border: "1px solid #eef2ed",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                color: "#6b7f72",
                fontWeight: 500,
                marginBottom: "6px",
              }}
            >
              Filtered outflow
            </div>
            <div
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#dc2626",
                lineHeight: 1.2,
              }}
            >
              RM {formatAmount(filteredOutflow)}
            </div>
            {cardSettlementOutflow > 0 && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#6b7f72",
                  marginTop: "4px",
                }}
              >
                Excludes RM {formatAmount(cardSettlementOutflow)} card bill settlement
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Type Segmented Pill Toggle (All | Expenses | Income) */}
      <div className="mb-3">
        <div
          className="d-flex d-sm-inline-flex align-items-center p-1"
          style={{
            backgroundColor: "#eef3ed",
            borderRadius: "50px",
          }}
        >
          {(
            [
              { key: "all", label: "All" },
              { key: "expense", label: "Expenses" },
              { key: "income", label: "Income" },
            ] as { key: string; label: string }[]
          ).map((tab) => {
            const active = selectedType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedType(tab.key)}
                className="btn btn-sm rounded-pill border-0 flex-fill flex-sm-grow-0"
                style={{
                  backgroundColor: active ? "#ffffff" : "transparent",
                  color: active ? "#1a2e23" : "#52665a",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.78rem",
                  padding: "6px 18px",
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
      </div>

      {/* Search & Filter Bar (Search | Day | Month | Year | Sort) */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          padding: "14px 18px",
          border: "1px solid #eef2ed",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
          marginBottom: "24px",
        }}
      >
        <div className="row g-2 align-items-center">
          {/* Search Input */}
          <div className="col-12 col-lg-4">
            <div
              className="fintrack-modal-input d-flex align-items-center"
              style={{
                gap: "10px",
                padding: "8px 14px",
              }}
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
                placeholder="Search description or category"
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

          {/* Dynamic Day Filter (1st position after Search) */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select fintrack-modal-input"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              style={{ fontSize: "0.84rem" }}
            >
              <option value="all">All days</option>
              {availableDays.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select fintrack-modal-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ fontSize: "0.84rem" }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Year Filter */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select fintrack-modal-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ fontSize: "0.84rem" }}
            >
              <option value="all">All years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select fintrack-modal-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ fontSize: "0.84rem" }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount_asc">Lower to higher</option>
              <option value="amount_desc">Higher to lower</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          border: "1px solid #eef2ed",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div
            className="text-center py-5"
            style={{ color: "#6b7f72", fontSize: "0.88rem" }}
          >
            <div
              className="spinner-border spinner-border-sm me-2 text-success"
              role="status"
            />
            Loading your transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ padding: "52px 24px", textAlign: "center" }}>
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
              <i className="bi bi-arrow-left-right" />
            </div>
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#1a2e23",
                marginBottom: "4px",
              }}
            >
              {transactions.length === 0
                ? "No transactions recorded yet"
                : "No transactions match your filters"}
            </h3>
            <p
              style={{
                fontSize: "0.82rem",
                color: "#6b7f72",
                marginBottom: 0,
              }}
            >
              {transactions.length === 0
                ? 'Click "+ Add transaction" to log your first income or expense.'
                : "Try selecting a different day, month, year, type, or clearing your search."}
            </p>
          </div>
        ) : (
          <>
            {/* =====================================================
                MOBILE MAE-STYLE GROUPED LIST (< 768px)
                ===================================================== */}
            <div className="d-md-none">
              {groupedTransactions.map((group, groupIdx) => (
                <div key={group.date}>
                  {/* Date Header Strip */}
                  <div
                    className="d-flex justify-content-between align-items-center"
                    style={{
                      backgroundColor: "#eef3ed",
                      borderTop: groupIdx === 0 ? "none" : "1px solid #e2ebe4",
                      borderBottom: "1px solid #e2ebe4",
                      padding: "9px 16px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#4a5d52",
                      }}
                    >
                      {formatGroupDateHeader(group.date)}
                    </span>
                    <div
                      className="d-flex align-items-center gap-2"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                      }}
                    >
                      {group.incomeTotal > 0 && (
                        <span style={{ color: "#16a34a" }}>
                          + RM {formatAmount(group.incomeTotal)}
                        </span>
                      )}
                      {group.expenseTotal > 0 && (
                        <span style={{ color: "#4a5d52" }}>
                          – RM {formatAmount(group.expenseTotal)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Day's Transactions */}
                  {group.items.map((tx) => {
                    const isIncome = tx.transaction_type === "income";
                    const categoryLabel = isIncome
                      ? tx.income_category
                      : tx.expense_category;

                    return (
                      <div
                        key={tx.transaction_id}
                        className="d-flex justify-content-between align-items-start gap-3"
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #f1f5f2",
                        }}
                      >
                        {/* Left Icon + Stacked Details */}
                        <div
                          className="d-flex align-items-start gap-3"
                          style={{ minWidth: 0, flex: 1 }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              backgroundColor: isIncome ? "#dcfce7" : "#fee2e2",
                              color: isIncome ? "#16a34a" : "#dc2626",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.9rem",
                              flexShrink: 0,
                              marginTop: "2px",
                            }}
                          >
                            <i
                              className={
                                isIncome
                                  ? "bi bi-arrow-down-right"
                                  : "bi bi-arrow-up-right"
                              }
                            />
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: "0.86rem",
                                fontWeight: 600,
                                color: "#1a2e23",
                                lineHeight: 1.35,
                                wordBreak: "break-word",
                              }}
                            >
                              {tx.description}
                            </div>

                            <div
                              className="d-flex align-items-center flex-wrap gap-1"
                              style={{
                                fontSize: "0.75rem",
                                color: "#6b7f72",
                                marginTop: "3px",
                                lineHeight: 1.3,
                              }}
                            >
                              <span>{categoryLabel || "Uncategorized"}</span>
                              <span>·</span>
                              <span>{tx.account_name}</span>
                              {tx.subaccount_name && (
                                <span
                                  style={{
                                    backgroundColor: "#f3f7f4",
                                    color: "#2e4738",
                                    padding: "1px 7px",
                                    borderRadius: "50px",
                                    fontSize: "0.68rem",
                                    fontWeight: 500,
                                    border: "1px solid #e2ebe4",
                                  }}
                                >
                                  {tx.subaccount_name}
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "#8b9d90",
                                marginTop: "3px",
                              }}
                            >
                              {tx.transaction_time}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Cancel Button */}
                        <div className="d-flex flex-column align-items-end flex-shrink-0">
                          <div
                            style={{
                              fontSize: "0.86rem",
                              fontWeight: 600,
                              color: isIncome ? "#16a34a" : "#dc2626",
                              whiteSpace: "nowrap",
                              lineHeight: 1.35,
                            }}
                          >
                            {isIncome
                              ? `+ RM ${formatAmount(tx.amount)}`
                              : `– RM ${formatAmount(tx.amount)}`}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalError(null);
                              setCancellingTx(tx);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              padding: "2px 0",
                              marginTop: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* =====================================================
                DESKTOP TABLE VIEW (>= 768px)
                ===================================================== */}
            <div className="table-responsive d-none d-md-block">
              <table
                className="table mb-0 align-middle"
                style={{
                  borderCollapse: "collapse",
                  fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid #eef2ed",
                      backgroundColor: "#fcfdfc",
                    }}
                  >
                    <th
                      style={{
                        padding: "14px 20px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Time
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Description
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Category
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Account
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Sub-Account
                    </th>
                    <th
                      className="text-end"
                      style={{
                        padding: "14px 16px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      className="text-end"
                      style={{
                        padding: "14px 20px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#6b7f72",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        border: "none",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions.map((group) => (
                    <React.Fragment key={group.date}>
                      {/* DATE GROUP HEADER BAR */}
                      <tr
                        style={{
                          backgroundColor: "#eef3ed",
                          borderTop: "1px solid #e2ebe4",
                          borderBottom: "1px solid #e2ebe4",
                        }}
                      >
                        <td
                          colSpan={7}
                          style={{
                            backgroundColor: "#eef3ed",
                            padding: "8px 20px",
                            border: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                color: "#4a5d52",
                              }}
                            >
                              {formatGroupDateHeader(group.date)}
                            </span>
                            <span
                              className="d-inline-flex align-items-center gap-3"
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 700,
                              }}
                            >
                              {group.incomeTotal > 0 && (
                                <span style={{ color: "#16a34a" }}>
                                  + RM {formatAmount(group.incomeTotal)}
                                </span>
                              )}
                              {group.expenseTotal > 0 && (
                                <span style={{ color: "#4a5d52" }}>
                                  – RM {formatAmount(group.expenseTotal)}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {group.items.map((tx) => {
                        const isIncome = tx.transaction_type === "income";
                        const categoryLabel = isIncome
                          ? tx.income_category
                          : tx.expense_category;

                        return (
                          <tr
                            key={tx.transaction_id}
                            style={{
                              borderBottom: "1px solid #f1f5f2",
                              transition: "background-color 0.15s ease",
                            }}
                          >
                            {/* TIME */}
                            <td
                              style={{
                                padding: "14px 20px",
                                border: "none",
                                whiteSpace: "nowrap",
                                fontSize: "0.82rem",
                                fontWeight: 500,
                                color: "#6b7f72",
                              }}
                            >
                              {tx.transaction_time}
                            </td>

                            {/* DESCRIPTION WITH ICON BADGE */}
                            <td style={{ padding: "14px 16px", border: "none" }}>
                              <div className="d-flex align-items-center gap-3">
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    backgroundColor: isIncome ? "#dcfce7" : "#fee2e2",
                                    color: isIncome ? "#16a34a" : "#dc2626",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.9rem",
                                    flexShrink: 0,
                                  }}
                                >
                                  <i
                                    className={
                                      isIncome
                                        ? "bi bi-arrow-down-right"
                                        : "bi bi-arrow-up-right"
                                    }
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: "0.87rem",
                                    fontWeight: 600,
                                    color: "#1a2e23",
                                  }}
                                >
                                  {tx.description}
                                </span>
                              </div>
                            </td>

                            {/* CATEGORY */}
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "0.84rem",
                                color: "#4a5d52",
                                border: "none",
                              }}
                            >
                              {categoryLabel || "—"}
                            </td>

                            {/* ACCOUNT */}
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "0.84rem",
                                color: "#4a5d52",
                                border: "none",
                              }}
                            >
                              {tx.account_name}
                            </td>

                            {/* SUB-ACCOUNT */}
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "0.84rem",
                                color: tx.subaccount_name ? "#4a5d52" : "#9caea1",
                                border: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tx.subaccount_name ? (
                                <span
                                  style={{
                                    backgroundColor: "#f3f7f4",
                                    color: "#2e4738",
                                    padding: "4px 10px",
                                    borderRadius: "50px",
                                    fontSize: "0.76rem",
                                    fontWeight: 500,
                                    border: "1px solid #e2ebe4",
                                  }}
                                >
                                  {tx.subaccount_name}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            {/* AMOUNT */}
                            <td
                              className="text-end"
                              style={{
                                padding: "14px 16px",
                                fontSize: "0.88rem",
                                fontWeight: 600,
                                color: isIncome ? "#16a34a" : "#1a2e23",
                                border: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isIncome
                                ? `+ RM ${formatAmount(tx.amount)}`
                                : `– RM ${formatAmount(tx.amount)}`}
                            </td>

                            {/* ACTION */}
                            <td
                              className="text-end"
                              style={{
                                padding: "14px 20px",
                                border: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelModalError(null);
                                  setCancellingTx(tx);
                                }}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#dc2626",
                                  fontSize: "0.78rem",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  padding: "4px 8px",
                                  borderRadius: "8px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  transition: "background-color 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor = "#fef2f2")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.backgroundColor = "transparent")
                                }
                              >
                                <i className="bi bi-arrow-counterclockwise" />
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* =========================================================
          MODAL 1: ADD TRANSACTION MODAL
         ========================================================= */}
      <Modal
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        centered
        width={520}
        className="fintrack-modal"
        title="Add transaction"
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "#6b7f72",
            marginTop: "-4px",
            marginBottom: "18px",
          }}
        >
          Record a new income or expense.
        </p>

        {activeAccounts.length === 0 && (
          <div
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#b45309",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            You have no active accounts yet. Please add an account on the Accounts
            page before recording a transaction.
          </div>
        )}

        {addModalError && (
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
            {addModalError}
          </div>
        )}

        {/* Row 1: Type & Amount (RM) */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-sm-6">
            <label className="fintrack-modal-label">Type</label>
            <select
              className="form-select fintrack-modal-input"
              value={txType}
              onChange={(e) =>
                handleTxTypeChange(e.target.value as TransactionType)
              }
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div className="col-12 col-sm-6">
            <label className="fintrack-modal-label">Amount (RM)</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control fintrack-modal-input"
              placeholder="0.00"
              value={txAmountInput}
              onChange={(e) =>
                setTxAmountInput(formatCentsInput(e.target.value))
              }
            />
          </div>
        </div>

        {/* Row 2: Description */}
        <div className="mb-3">
          <label className="fintrack-modal-label">Description</label>
          <input
            type="text"
            className="form-control fintrack-modal-input"
            placeholder="Groceries at Lotus's"
            value={txDescription}
            onChange={(e) => setTxDescription(e.target.value)}
          />
        </div>

        {/* Row 3: Date (with "Today" checkbox) & Dynamic Category */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-sm-6">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="fintrack-modal-label mb-0">Date</label>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.76rem",
                  fontWeight: 500,
                  color: "#2e4738",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={isTodayChecked}
                  onChange={(e) => handleTodayCheckboxChange(e.target.checked)}
                  style={{
                    accentColor: "#69a980",
                    width: "14px",
                    height: "14px",
                    cursor: "pointer",
                  }}
                />
                Today
              </label>
            </div>
            <input
              type="date"
              className="form-control fintrack-modal-input"
              value={isTodayChecked ? getTodayDateString() : txDate}
              max={getTodayDateString()}
              disabled={isTodayChecked}
              onChange={(e) => setTxDate(e.target.value)}
            />
            {!isTodayChecked && (
              <div
                style={{
                  fontSize: "0.69rem",
                  color: "#6b7f72",
                  marginTop: "4px",
                }}
              >
                Backdated entries default to 11:59 PM (23:59)
              </div>
            )}
          </div>

          <div className="col-12 col-sm-6">
            <label className="fintrack-modal-label">
              {txType === "expense" ? "Expense Category" : "Income Category"}
            </label>
            <select
              className="form-select fintrack-modal-input"
              value={txCategory}
              onChange={(e) => setTxCategory(e.target.value)}
            >
              <option value="">Select</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4: Account & Sub-account */}
        <div className="row g-3 mb-2">
          <div className="col-12 col-sm-6">
            <label className="fintrack-modal-label">Account</label>
            <select
              className="form-select fintrack-modal-input"
              value={txAccountId}
              onChange={(e) => handleTxAccountChange(e.target.value)}
              disabled={activeAccounts.length === 0}
            >
              {activeAccounts.length === 0 ? (
                <option value="">No accounts</option>
              ) : (
                activeAccounts.map((acc) => (
                  <option key={acc.account_id} value={acc.account_id}>
                    {acc.account_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="col-12 col-sm-6">
            <label className="fintrack-modal-label">Sub-account</label>
            <select
              className="form-select fintrack-modal-input"
              value={txSubAccountId}
              onChange={(e) => setTxSubAccountId(e.target.value)}
              disabled={
                !selectedModalAccount ||
                selectedModalAccount.subaccounts.length === 0
              }
            >
              {!selectedModalAccount ||
              selectedModalAccount.subaccounts.length === 0 ? (
                <option value="">No sub-accounts</option>
              ) : (
                <>
                  {modalAccountInfo.unallocated > 0 ? (
                    <option value="">None (Main account)</option>
                  ) : (
                    <option value="" disabled>
                      None (RM 0.00 unallocated)
                    </option>
                  )}
                  {selectedModalAccount.subaccounts.map((sub) => (
                    <option key={sub.subaccount_id} value={sub.subaccount_id}>
                      {sub.subaccount_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Available Balance Indicator */}
        {selectedModalAccount && (
          <div
            className="d-flex align-items-center justify-content-between px-3 py-2 mb-4"
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              borderRadius: "10px",
              fontSize: "0.78rem",
            }}
          >
            <span style={{ color: "#546e5f", fontWeight: 500 }}>
              {modalAccountInfo.isCreditCard
                ? txType === "income"
                  ? "Max refundable swipe balance:"
                  : "Available credit limit:"
                : `Available in ${txSubAccountId ? "sub-account" : "main account"}:`}
            </span>
            <span
              style={{
                fontWeight: 700,
                color:
                  modalAccountInfo.currentAvailable > 0
                    ? "#16a34a"
                    : "#dc2626",
              }}
            >
              RM {formatAmount(modalAccountInfo.currentAvailable)}
            </span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="d-flex justify-content-end gap-2">
          <Button
            className="fintrack-modal-cancel-btn"
            onClick={() => setAddModalOpen(false)}
            disabled={savingTx}
          >
            Cancel
          </Button>
          <Button
            className="fintrack-modal-primary-btn"
            onClick={handleAddTransactionSubmit}
            loading={savingTx}
            disabled={activeAccounts.length === 0}
          >
            Add transaction
          </Button>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 2: CANCEL THIS TRANSACTION? MODAL
         ========================================================= */}
      <Modal
        open={!!cancellingTx}
        onCancel={() => {
          if (!cancellingLoading) setCancellingTx(null);
        }}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        title="Cancel this transaction?"
      >
        <p
          style={{
            fontSize: "0.8rem",
            color: "#6b7f72",
            marginTop: "-4px",
            marginBottom: "16px",
          }}
        >
          Review the effect on your account before confirming.
        </p>

        {cancelModalError && (
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
            {cancelModalError}
          </div>
        )}

        {cancellingTx && debtLinks[cancellingTx.transaction_id] && (
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              color: "#2e4738",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            <i className="bi bi-arrow-left-right me-1" />
            {debtLinks[cancellingTx.transaction_id].kind === "settled" ? (
              <>
                Linked to Debt settlement with{" "}
                <strong>{debtLinks[cancellingTx.transaction_id].label}</strong>.
                Cancelling this transaction will also reopen that debt back to
                Pending.
              </>
            ) : debtLinks[cancellingTx.transaction_id].status === "pending" ? (
              <>
                Linked to Debt with{" "}
                <strong>{debtLinks[cancellingTx.transaction_id].label}</strong>.
                Cancelling this transaction will also remove that debt record.
              </>
            ) : (
              <>
                Linked to Debt with{" "}
                <strong>{debtLinks[cancellingTx.transaction_id].label}</strong>.
                Cancelling this transaction will unlink the initial account
                entry from that settled debt.
              </>
            )}
          </div>
        )}

        {cancellingTx && financingLinks[cancellingTx.transaction_id] && (
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              color: "#2e4738",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            <i className="bi bi-credit-card-2-front me-1" />
            Linked to Financing{" "}
            <strong>{financingLinks[cancellingTx.transaction_id]}</strong>.
            Cancelling this transaction will revert that installment back to{" "}
            <strong>Pending</strong>.
          </div>
        )}

        {cancellingTx && commitmentLinks[cancellingTx.transaction_id] && (
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              color: "#2e4738",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            <i className="bi bi-calendar2-check me-1" />
            Linked to Monthly Commitment{" "}
            <strong>{commitmentLinks[cancellingTx.transaction_id]}</strong>.
            Cancelling this transaction will revert that month back to{" "}
            <strong>Unpaid</strong>.
          </div>
        )}

        {cancellingTx && tabungLinks[cancellingTx.transaction_id] && (
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              color: "#2e4738",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            <i className="bi bi-piggy-bank me-1" />
            Linked to Tabung &quot;
            <strong>{tabungLinks[cancellingTx.transaction_id]}</strong>&quot;.
            Cancelling this transaction will also remove that entry from the fund.
          </div>
        )}

        {cancellingTx && cancellingTx.target_account_id && (
          <div
            style={{
              backgroundColor: "#f6faf7",
              border: "1px solid #e2ebe4",
              color: "#2e4738",
              borderRadius: "10px",
              padding: "9px 12px",
              fontSize: "0.78rem",
              marginBottom: "14px",
            }}
          >
            <i className="bi bi-credit-card me-1" />
            Linked to Credit Card Settlement for{" "}
            <strong>{cancellingTx.target_account_name || "Credit Card"}</strong>
            . Cancelling this transaction will also restore the owed swipe
            balance on that card.
          </div>
        )}

        {cancellingTx && (
          <>
            <div
              style={{
                backgroundColor: "#f9fbf7",
                border: "1px solid #e6ece7",
                borderRadius: "14px",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              {/* TRANSACTION */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Transaction
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {cancellingTx.description}
                </span>
              </div>

              {/* DATE */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Date
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {formatDisplayDate(cancellingTx.transaction_date)} · {cancellingTx.transaction_time}
                </span>
              </div>

              {/* CATEGORY */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Category
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {cancellingTx.transaction_type === "expense"
                    ? cancellingTx.expense_category
                    : cancellingTx.income_category}
                </span>
              </div>

              {/* AMOUNT */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Amount
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {cancellingTx.transaction_type === "income"
                    ? `+ RM ${formatAmount(cancellingTx.amount)}`
                    : `– RM ${formatAmount(cancellingTx.amount)}`}
                </span>
              </div>

              {/* ACCOUNT */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Account
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {cancellingTx.account_name}
                </span>
              </div>

              {/* SUB-ACCOUNT (if present) */}
              {cancellingTx.subaccount_name && (
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{
                    padding: "11px 16px",
                    borderBottom: "1px solid #e9efe9",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "#6b7f72",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Sub-Account
                  </span>
                  <span
                    style={{
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      color: "#1a2e23",
                    }}
                  >
                    {cancellingTx.subaccount_name}
                  </span>
                </div>
              )}

              {/* EFFECT ON ACCOUNT */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Effect on account
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color:
                      cancellingTx.transaction_type === "income"
                        ? "#dc2626"
                        : "#16a34a",
                  }}
                >
                  {cancellingTx.transaction_type === "income"
                    ? `Deducting RM ${formatAmount(cancellingTx.amount)}`
                    : `Refunding RM ${formatAmount(cancellingTx.amount)}`}
                </span>
              </div>

              {/* BALANCE NOW */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid #e9efe9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Balance now
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    color: "#1a2e23",
                  }}
                >
                  {formatSignedRM(cancelModalBalanceInfo.balanceNow)}
                </span>
              </div>

              {/* BALANCE AFTER CANCELLING */}
              <div
                className="d-flex justify-content-between align-items-center"
                style={{
                  padding: "11px 16px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "#6b7f72",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Balance after cancelling
                </span>
                <span
                  style={{
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#1a2e23",
                  }}
                >
                  {formatSignedRM(cancelModalBalanceInfo.balanceAfter)}
                </span>
              </div>
            </div>

            <div className="fintrack-modal-actions">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setCancellingTx(null)}
                disabled={cancellingLoading}
              >
                Keep transaction
              </Button>
              <Button
                className="fintrack-modal-danger-btn"
                onClick={handleConfirmCancelTransaction}
                loading={cancellingLoading}
              >
                Cancel transaction
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
