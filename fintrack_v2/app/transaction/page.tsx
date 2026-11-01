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
  "Others",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Freelance / Side Income",
  "Gift / Allowance",
  "Payback / Reimbursement",
  "Investment Return",
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

export default function TransactionPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState<string>("");
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

      const [accountsRes, subaccountsRes, transactionsRes] = await Promise.all([
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
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      const rawAccounts = accountsRes.data || [];
      const rawSubs = subaccountsRes.data || [];
      const rawTxs = transactionsRes.data || [];

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
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  }, [transactions, searchQuery, selectedMonth, selectedYear, selectedType, sortBy]);

  // Summary Totals for Filtered Transactions
  const { filteredInflow, filteredOutflow, netAmount } = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.transaction_type === "income") {
        inflow += tx.amount;
      } else {
        outflow += tx.amount;
      }
    });
    return {
      filteredInflow: inflow,
      filteredOutflow: outflow,
      netAmount: inflow - outflow,
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
      return { allocatedSum: 0, unallocated: 0, currentAvailable: 0 };
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
    return { allocatedSum, unallocated, currentAvailable };
  }, [selectedModalAccount, txSubAccountId]);

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

    // Selected Account available & unallocated balance calculation
    const allocatedSum = parentAcc.subaccounts.reduce(
      (sum, s) => sum + Number(s.subaccount_value),
      0
    );
    const unallocatedBalance = Number((parentAcc.account_balance - allocatedSum).toFixed(2));

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
            }" (RM ${formatAmount(Math.max(0, unallocatedBalance))}). Please select a sub-account or enter a lower amount.`
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

      // 1. Soft-delete the transaction
      const { error: txError } = await supabase
        .from("transactions")
        .update({ is_active: false })
        .eq("transaction_id", cancellingTx.transaction_id)
        .eq("user_id", userId);

      if (txError) throw txError;

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
    const balanceNow = acc ? acc.account_balance : 0;
    const reverseDelta =
      cancellingTx.transaction_type === "income"
        ? -cancellingTx.amount
        : cancellingTx.amount;
    const balanceAfter = Number((balanceNow + reverseDelta).toFixed(2));
    return { balanceNow, balanceAfter };
  }, [cancellingTx, allAccounts]);

  const categoryOptions =
    txType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

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
        <div className="col-12 col-md-4">
          <div
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

        <div className="col-12 col-md-4">
          <div
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
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div
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
              Net
            </div>
            <div
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: netAmount < 0 ? "#dc2626" : "#1a2e23",
                lineHeight: 1.2,
              }}
            >
              {formatSignedRM(netAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
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

          {/* Type Filter */}
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="form-select fintrack-modal-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ fontSize: "0.84rem" }}
            >
              <option value="all">All types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
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
        <div className="table-responsive">
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
                  Date
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
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-5"
                    style={{ color: "#6b7f72", fontSize: "0.88rem", border: "none" }}
                  >
                    Loading your transactions...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-5"
                    style={{ color: "#6b7f72", fontSize: "0.88rem", border: "none" }}
                  >
                    {transactions.length === 0
                      ? 'No transactions recorded yet. Click "+ Add transaction" to log your first income or expense.'
                      : "No transactions match your current filters."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
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
                      {/* DATE & TIME */}
                      <td
                        style={{
                          padding: "14px 20px",
                          border: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.84rem",
                            fontWeight: 500,
                            color: "#1a2e23",
                            lineHeight: 1.3,
                          }}
                        >
                          {tx.transaction_date}
                        </div>
                        <div
                          style={{
                            fontSize: "0.74rem",
                            color: "#8b9d90",
                            marginTop: "2px",
                          }}
                        >
                          {tx.transaction_time}
                        </div>
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
                })
              )}
            </tbody>
          </table>
        </div>
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
          <div className="col-6">
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

          <div className="col-6">
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
          <div className="col-6">
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

          <div className="col-6">
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
          <div className="col-6">
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

          <div className="col-6">
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
              Available in {txSubAccountId ? "sub-account" : "main account"}:
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
                  {cancellingTx.transaction_date} · {cancellingTx.transaction_time}
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

            <div className="d-flex justify-content-center gap-2">
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
