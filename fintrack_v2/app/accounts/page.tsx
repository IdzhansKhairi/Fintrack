"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, Modal, Button } from "antd";
import AddButton from "@/components/AddButtton";
import ConfirmModal from "@/components/ConfirmModal";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import { createClient } from "@/utils/supabase/client";

interface SubAccount {
  subaccount_id: string;
  account_id: string;
  user_id: string;
  subaccount_name: string;
  subaccount_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subaccounts: SubAccount[];
}

const ACCOUNT_TYPES = [
  "Bank",
  "E-Wallet",
  "Credit Card",
  "Cash",
  "Retirement",
  "Investment",
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

function formatCentsInput(rawValue: string, allowNegative = false): string {
  const isNegative = allowNegative && rawValue.includes("-");
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return isNegative ? "-" : "";
  }
  const cents = parseInt(digits, 10);
  if (cents === 0) {
    return rawValue === "0" ? "0.00" : "";
  }
  const formatted = (cents / 100).toFixed(2);
  return isNegative ? `-${formatted}` : formatted;
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

function getUnallocated(account: Account): number {
  const allocated = account.subaccounts.reduce(
    (sum, s) => sum + Number(s.subaccount_value),
    0
  );
  return Math.max(0, round2(Number(account.account_balance) - allocated));
}

function getAvailableCashBalance(account: Account, subaccountId: string): number {
  if (subaccountId) {
    const sub = account.subaccounts.find(
      (s) => s.subaccount_id === subaccountId
    );
    return sub ? Number(sub.subaccount_value) : 0;
  }
  if (account.subaccounts.length > 0) {
    return getUnallocated(account);
  }
  return Number(account.account_balance);
}

function getCreditCardAvailableLimit(account: Account): number {
  const limit = Number(account.credit_limit || 0);
  const hold = Number(account.unpaid_financing_hold || 0);
  const balance = Number(account.account_balance || 0); // <= 0 for owed swipes
  return Math.max(0, round2(limit - hold + balance));
}

function DateInputDDMMYYYY({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (val: string) => void;
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
        placeholder="DD-MM-YYYY"
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

export default function AccountsPage() {
  const supabase = createClient();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Add / Edit Account Modal State
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [customAccountName, setCustomAccountName] = useState<string>("");
  const [accountType, setAccountType] = useState<string>("Bank");
  const [accountBalanceInput, setAccountBalanceInput] = useState<string>("");
  const [creditLimitInput, setCreditLimitInput] = useState<string>("");
  const [creditOwedInput, setCreditOwedInput] = useState<string>("0.00");
  const [accountModalError, setAccountModalError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Add / Edit Sub-Account Modal State
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalMode, setSubModalMode] = useState<"add" | "edit">("add");
  const [targetParentAccount, setTargetParentAccount] = useState<Account | null>(null);
  const [editingSubAccount, setEditingSubAccount] = useState<SubAccount | null>(null);
  const [subAccountName, setSubAccountName] = useState<string>("");
  const [subAccountBalanceInput, setSubAccountBalanceInput] = useState<string>("");
  const [subModalError, setSubModalError] = useState<string | null>(null);
  const [savingSubAccount, setSavingSubAccount] = useState(false);

  // Pay Credit Card Modal State
  const [payingCard, setPayingCard] = useState<Account | null>(null);
  const [payCardAmountInput, setPayCardAmountInput] = useState<string>("");
  const [payCardDate, setPayCardDate] = useState<string>(getTodayDateString());
  const [payCardSourceAccId, setPayCardSourceAccId] = useState<string>("");
  const [payCardSourceSubId, setPayCardSourceSubId] = useState<string>("");
  const [payCardNote, setPayCardNote] = useState<string>("");
  const [payCardError, setPayCardError] = useState<string | null>(null);
  const [payingCardLoading, setPayingCardLoading] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [deletingSubAccount, setDeletingSubAccount] = useState<{
    sub: SubAccount;
    parent: Account;
  } | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

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

  const nonCreditAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => !a.is_credit_card && a.account_type !== "Credit Card"
      ),
    [accounts]
  );

  const selectedPayCardSourceAcc = useMemo(
    () =>
      nonCreditAccounts.find((a) => a.account_id === payCardSourceAccId) ||
      null,
    [nonCreditAccounts, payCardSourceAccId]
  );

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserId(user.id);

      // Ensure user profile row exists in public.profiles
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || null,
          preferred_name: user.user_metadata?.preferred_name || null,
        },
        { onConflict: "id" }
      );

      const [accountsRes, subaccountsRes, financingRes, instRes] =
        await Promise.all([
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

      const rawAccounts = accountsRes.data || [];
      const rawSubs = subaccountsRes.data || [];
      const rawPlans = financingRes.data || [];
      const rawInsts = instRes.data || [];

      // Compute unpaid financing hold per linked credit card account_id
      const holdByAccountId = new Map<string, number>();
      rawPlans.forEach((p) => {
        if (!p.account_id || p.status !== "active") return;
        const planInsts = rawInsts.filter(
          (i) => i.financing_id === p.financing_id
        );
        const planPaid = planInsts
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
        const remainingHold =
          planInsts.length > 0
            ? Math.max(
                round2(Math.max(0, Number(p.total_amount || 0) - planPaid)),
                round2(
                  planInsts
                    .filter((i) => i.status === "pending")
                    .reduce((sum, i) => sum + Number(i.amount_due || 0), 0)
                )
              )
            : round2(Math.max(0, Number(p.total_amount || 0)));
        if (remainingHold > 0) {
          holdByAccountId.set(
            p.account_id,
            round2((holdByAccountId.get(p.account_id) || 0) + remainingHold)
          );
        }
      });

      const merged: Account[] = rawAccounts.map((acc) => ({
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
          .filter((sub) => sub.account_id === acc.account_id)
          .map((sub) => ({
            ...sub,
            subaccount_value: Number(sub.subaccount_value),
          })),
      }));

      setAccounts(merged);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Combined balance across all active accounts (including credit card financing holds)
  const combinedBalance = accounts.reduce(
    (sum, acc) =>
      sum +
      Number(acc.account_balance) -
      (acc.is_credit_card ? Number(acc.unpaid_financing_hold || 0) : 0),
    0
  );

  // Relative updated date label
  const getUpdatedLabel = () => {
    if (accounts.length === 0) return "no accounts yet";
    const timestamps: number[] = [];
    accounts.forEach((acc) => {
      if (acc.updated_at) timestamps.push(new Date(acc.updated_at).getTime());
      acc.subaccounts.forEach((sub) => {
        if (sub.updated_at) timestamps.push(new Date(sub.updated_at).getTime());
      });
    });
    if (timestamps.length === 0) return "updated today";
    const latest = new Date(Math.max(...timestamps));
    const now = new Date();
    const isSameDay =
      latest.getDate() === now.getDate() &&
      latest.getMonth() === now.getMonth() &&
      latest.getFullYear() === now.getFullYear();

    if (isSameDay) return "updated today";
    const dd = String(latest.getDate()).padStart(2, "0");
    const mm = String(latest.getMonth() + 1).padStart(2, "0");
    const yyyy = latest.getFullYear();
    return `updated ${dd}-${mm}-${yyyy}`;
  };

  // ==========================================
  // HANDLERS: ADD / EDIT ACCOUNT
  // ==========================================
  const handleOpenAddAccount = () => {
    setAccountModalMode("add");
    setEditingAccount(null);
    setCustomAccountName("");
    setAccountType("Bank");
    setAccountBalanceInput("");
    setCreditLimitInput("");
    setCreditOwedInput("0.00");
    setAccountModalError(null);
    setAccountModalOpen(true);
  };

  const handleOpenEditAccount = (account: Account) => {
    setAccountModalMode("edit");
    setEditingAccount(account);
    setCustomAccountName(account.account_name);
    setAccountType(account.account_type);
    setAccountBalanceInput(Number(account.account_balance).toFixed(2));
    setCreditLimitInput(
      account.credit_limit !== null && account.credit_limit !== undefined
        ? Number(account.credit_limit).toFixed(2)
        : ""
    );
    setCreditOwedInput(Math.abs(Number(account.account_balance)).toFixed(2));
    setAccountModalError(null);
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountModalError(null);

    if (!userId) return;

    const finalAccountName = customAccountName.trim();

    if (!finalAccountName) {
      setAccountModalError("Please enter an account name.");
      return;
    }

    const isCC = accountType === "Credit Card";
    let roundedBalance = 0;
    let roundedLimit: number | null = null;

    if (isCC) {
      if (
        accountModalMode === "edit" &&
        editingAccount &&
        editingAccount.subaccounts.length > 0
      ) {
        setAccountModalError(
          "Cannot change account type to Credit Card while it has active sub-accounts. Please remove its sub-accounts first."
        );
        return;
      }

      const parsedLimit = parseFloat(creditLimitInput);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        setAccountModalError(
          "Please enter a valid credit limit greater than RM 0.00."
        );
        return;
      }
      roundedLimit = round2(parsedLimit);

      const parsedOwed = parseFloat(creditOwedInput || "0");
      if (isNaN(parsedOwed) || parsedOwed < 0) {
        setAccountModalError("Please enter a valid current amount owed.");
        return;
      }
      const roundedOwed = round2(parsedOwed);
      const currentHold = editingAccount
        ? Number(editingAccount.unpaid_financing_hold || 0)
        : 0;
      if (roundedOwed + currentHold > roundedLimit + 0.001) {
        setAccountModalError(
          `Current amount owed (RM ${formatAmount(roundedOwed)})${
            currentHold > 0
              ? ` plus active financing holds (RM ${formatAmount(currentHold)})`
              : ""
          } cannot exceed the credit limit (RM ${formatAmount(roundedLimit)}).`
        );
        return;
      }
      roundedBalance = roundedOwed > 0 ? -Math.abs(roundedOwed) : 0;
    } else {
      if (
        accountModalMode === "edit" &&
        editingAccount &&
        editingAccount.is_credit_card &&
        Number(editingAccount.unpaid_financing_hold || 0) > 0
      ) {
        setAccountModalError(
          `Cannot change account type from Credit Card while it has active linked financing installments (RM ${formatAmount(
            Number(editingAccount.unpaid_financing_hold || 0)
          )}). Please unlink or settle the financing plan first.`
        );
        return;
      }

      const parsedBalance = parseFloat(accountBalanceInput);
      if (isNaN(parsedBalance)) {
        setAccountModalError("Please enter a valid balance amount.");
        return;
      }
      roundedBalance = round2(parsedBalance);

      // If editing an account with sub-accounts, make sure total balance is not less than allocated sub-accounts sum
      if (accountModalMode === "edit" && editingAccount) {
        const allocatedSum = editingAccount.subaccounts.reduce(
          (sum, s) => sum + Number(s.subaccount_value),
          0
        );
        if (
          editingAccount.subaccounts.length > 0 &&
          roundedBalance < allocatedSum - 0.001
        ) {
          setAccountModalError(
            `Account balance cannot be lower than the total already allocated in sub-accounts (RM ${formatAmount(
              allocatedSum
            )}).`
          );
          return;
        }
      }
    }

    setSavingAccount(true);
    try {
      if (accountModalMode === "add") {
        const randomColor =
          RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];

        const { error } = await supabase.from("accounts").insert({
          user_id: userId,
          account_name: finalAccountName,
          account_type: accountType,
          account_balance: roundedBalance,
          is_credit_card: isCC,
          credit_limit: roundedLimit,
          color: randomColor,
          is_active: true,
        });

        if (error) throw error;
        showToast(`Account "${finalAccountName}" added`, "success");
      } else if (accountModalMode === "edit" && editingAccount) {
        const { error } = await supabase
          .from("accounts")
          .update({
            account_name: finalAccountName,
            account_type: accountType,
            account_balance: roundedBalance,
            is_credit_card: isCC,
            credit_limit: roundedLimit,
          })
          .eq("account_id", editingAccount.account_id)
          .eq("user_id", userId);

        if (error) throw error;
        showToast(`Account "${finalAccountName}" updated`, "success");
      }

      setAccountModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      setAccountModalError(err.message || "Failed to save account.");
    } finally {
      setSavingAccount(false);
    }
  };

  // ==========================================
  // HANDLERS: PAY CREDIT CARD
  // ==========================================
  const handleOpenPayCard = (card: Account) => {
    const owed = Math.abs(Math.min(0, Number(card.account_balance)));
    setPayingCard(card);
    setPayCardAmountInput(owed > 0 ? owed.toFixed(2) : "");
    setPayCardDate(getTodayDateString());
    const defaultSrc = nonCreditAccounts[0] || null;
    setPayCardSourceAccId(defaultSrc ? defaultSrc.account_id : "");
    setPayCardSourceSubId("");
    setPayCardNote("");
    setPayCardError(null);
  };

  const handleConfirmPayCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !payingCard) return;
    setPayCardError(null);

    const amount = round2(parseFloat(payCardAmountInput || "0"));
    if (isNaN(amount) || amount <= 0) {
      setPayCardError("Please enter a payment amount greater than RM 0.00.");
      return;
    }

    const maxOwed = round2(
      Math.abs(Math.min(0, Number(payingCard.account_balance)))
    );
    if (amount > maxOwed + 0.001) {
      setPayCardError(
        `Payment amount cannot exceed the current card swipe balance owed (RM ${formatAmount(
          maxOwed
        )}).`
      );
      return;
    }

    if (!payCardDate) {
      setPayCardError("Please select a payment date (DD-MM-YYYY).");
      return;
    }

    const sourceAccount =
      nonCreditAccounts.find((a) => a.account_id === payCardSourceAccId) ||
      null;
    if (!sourceAccount) {
      setPayCardError("Please select a bank/cash account to pay from.");
      return;
    }

    const sourceSub = payCardSourceSubId
      ? sourceAccount.subaccounts.find(
          (s) => s.subaccount_id === payCardSourceSubId
        ) || null
      : null;

    const availableCash = getAvailableCashBalance(
      sourceAccount,
      payCardSourceSubId
    );
    if (amount > availableCash + 0.001) {
      setPayCardError(
        `Insufficient balance in ${
          sourceSub
            ? `${sourceAccount.account_name} (${sourceSub.subaccount_name})`
            : sourceAccount.account_name
        }. Available: RM ${formatAmount(availableCash)}.`
      );
      return;
    }

    setPayingCardLoading(true);
    try {
      // 1. Deduct from source bank/cash account
      const newSourceBal = round2(Number(sourceAccount.account_balance) - amount);
      const { error: srcErr } = await supabase
        .from("accounts")
        .update({ account_balance: newSourceBal })
        .eq("account_id", sourceAccount.account_id)
        .eq("user_id", userId);
      if (srcErr) throw srcErr;

      if (sourceSub) {
        const newSubBal = round2(Number(sourceSub.subaccount_value) - amount);
        const { error: subErr } = await supabase
          .from("subaccounts")
          .update({ subaccount_value: newSubBal })
          .eq("subaccount_id", sourceSub.subaccount_id)
          .eq("user_id", userId);
        if (subErr) throw subErr;
      }

      // 2. Increase credit card balance toward RM 0.00
      const newCardBal = Math.min(
        0,
        round2(Number(payingCard.account_balance) + amount)
      );
      const { error: cardErr } = await supabase
        .from("accounts")
        .update({ account_balance: newCardBal })
        .eq("account_id", payingCard.account_id)
        .eq("user_id", userId);
      if (cardErr) throw cardErr;

      // 3. Record expense transaction with target_account_id pointing to the credit card
      const txDesc = payCardNote.trim()
        ? `Credit Card Payment — ${payingCard.account_name} (${payCardNote.trim()})`
        : `Credit Card Payment — ${payingCard.account_name}`;

      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: userId,
        account_id: sourceAccount.account_id,
        subaccount_id: sourceSub ? sourceSub.subaccount_id : null,
        target_account_id: payingCard.account_id,
        transaction_type: "expense",
        amount: amount,
        description: txDesc,
        expense_category: "Credit Card Payment",
        income_category: null,
        transaction_date: payCardDate,
        transaction_time: getCurrentTimeString(),
        is_active: true,
      });
      if (txErr) throw txErr;

      const cardName = payingCard.account_name;
      setPayingCard(null);
      await fetchAccounts();
      showToast(
        `Paid RM ${formatAmount(amount)} to ${cardName} from ${sourceAccount.account_name}`,
        "success"
      );
    } catch (err: any) {
      setPayCardError(err.message || "Failed to process credit card payment.");
    } finally {
      setPayingCardLoading(false);
    }
  };

  // ==========================================
  // HANDLERS: ADD / EDIT SUB-ACCOUNT
  // ==========================================
  const handleOpenAddSubAccount = (parent: Account) => {
    setSubModalMode("add");
    setTargetParentAccount(parent);
    setEditingSubAccount(null);
    setSubAccountName("");
    setSubAccountBalanceInput("");
    setSubModalError(null);
    setSubModalOpen(true);
  };

  const handleOpenEditSubAccount = (parent: Account, sub: SubAccount) => {
    setSubModalMode("edit");
    setTargetParentAccount(parent);
    setEditingSubAccount(sub);
    setSubAccountName(sub.subaccount_name);
    setSubAccountBalanceInput(Number(sub.subaccount_value).toFixed(2));
    setSubModalError(null);
    setSubModalOpen(true);
  };

  const getMaxAllocatableForModal = (): number => {
    if (!targetParentAccount) return 0;
    const otherSubsTotal = targetParentAccount.subaccounts
      .filter(
        (s) =>
          subModalMode === "add" ||
          s.subaccount_id !== editingSubAccount?.subaccount_id
      )
      .reduce((sum, s) => sum + Number(s.subaccount_value), 0);

    return Math.max(0, Number(targetParentAccount.account_balance) - otherSubsTotal);
  };

  const handleSaveSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubModalError(null);

    if (!userId || !targetParentAccount) return;

    const trimmedName = subAccountName.trim();
    if (!trimmedName) {
      setSubModalError("Please enter a sub-account name.");
      return;
    }

    const parsedValue = parseFloat(subAccountBalanceInput);
    if (isNaN(parsedValue) || parsedValue < 0) {
      setSubModalError("Please enter a valid positive balance amount.");
      return;
    }

    const roundedValue = Math.round(parsedValue * 100) / 100;
    const maxAllowed = Math.round(getMaxAllocatableForModal() * 100) / 100;

    if (roundedValue > maxAllowed + 0.001) {
      setSubModalError(
        `Amount exceeds the remaining unallocated balance of RM ${formatAmount(
          maxAllowed
        )} in ${targetParentAccount.account_name}.`
      );
      return;
    }

    setSavingSubAccount(true);
    try {
      if (subModalMode === "add") {
        const { error } = await supabase.from("subaccounts").insert({
          account_id: targetParentAccount.account_id,
          user_id: userId,
          subaccount_name: trimmedName,
          subaccount_value: roundedValue,
          is_active: true,
        });

        if (error) throw error;
        showToast(
          `Sub-account "${trimmedName}" added to ${targetParentAccount.account_name}`,
          "success"
        );
      } else if (subModalMode === "edit" && editingSubAccount) {
        const { error } = await supabase
          .from("subaccounts")
          .update({
            subaccount_name: trimmedName,
            subaccount_value: roundedValue,
          })
          .eq("subaccount_id", editingSubAccount.subaccount_id)
          .eq("user_id", userId);

        if (error) throw error;
        showToast(`Sub-account "${trimmedName}" updated`, "success");
      }

      setSubModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      setSubModalError(err.message || "Failed to save sub-account.");
    } finally {
      setSavingSubAccount(false);
    }
  };

  // ==========================================
  // HANDLERS: SOFT DELETE ACCOUNT & SUB-ACCOUNT
  // ==========================================
  const handleConfirmDeleteAccount = async () => {
    if (!deletingAccount || !userId) return;
    setDeletingLoading(true);
    try {
      await Promise.all([
        supabase
          .from("accounts")
          .update({ is_active: false })
          .eq("account_id", deletingAccount.account_id)
          .eq("user_id", userId),
        supabase
          .from("subaccounts")
          .update({ is_active: false })
          .eq("account_id", deletingAccount.account_id)
          .eq("user_id", userId),
        supabase
          .from("financing")
          .update({ account_id: null })
          .eq("account_id", deletingAccount.account_id)
          .eq("user_id", userId),
      ]);

      const removedAccName = deletingAccount.account_name;
      setDeletingAccount(null);
      showToast(`Account "${removedAccName}" removed`, "danger");
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to remove account:", err);
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleConfirmDeleteSubAccount = async () => {
    if (!deletingSubAccount || !userId) return;
    setDeletingLoading(true);
    try {
      await supabase
        .from("subaccounts")
        .update({ is_active: false })
        .eq("subaccount_id", deletingSubAccount.sub.subaccount_id)
        .eq("user_id", userId);

      const removedSubName = deletingSubAccount.sub.subaccount_name;
      setDeletingSubAccount(null);
      showToast(`Sub-account "${removedSubName}" removed`, "danger");
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to remove sub-account:", err);
    } finally {
      setDeletingLoading(false);
    }
  };

  const maxAllocatableInModal = getMaxAllocatableForModal();

  return (
    <div>
      {/* 1. Page Title, Subtitle, Add Account Button */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle mb-0">
            Bank accounts, e-wallets, cards, retirement and investments — with
            sub-accounts
          </p>
        </div>
        <div>
          <AddButton onClick={handleOpenAddAccount}>Add account</AddButton>
        </div>
      </div>

      {/* 2. Combined Balance Banner (Full Width) */}
      <div
        className="w-100 p-4 rounded-4 text-white mb-4 shadow-sm"
        style={{
          background:
            "linear-gradient(90deg, #1d5bbf 0%, #3e8879 55%, #5ba77b 100%)",
        }}
      >
        <span
          className="small text-white-50 fw-medium d-block"
          style={{ fontSize: "0.78rem" }}
        >
          Combined balance
        </span>
        <h2
          className="text-white fw-bold my-1"
          style={{ fontSize: "2.1rem", letterSpacing: "-0.5px" }}
        >
          {formatSignedRM(combinedBalance)}
        </h2>
        <span className="small text-white-50" style={{ fontSize: "0.78rem" }}>
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"} ·{" "}
          {getUpdatedLabel()}
        </span>
      </div>

      {/* 3. Bootstrap Grid for Account Cards */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div
          className="text-center py-5 px-3"
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "18px",
            border: "1px solid #eef2ed",
            padding: "52px 24px",
          }}
        >
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
            <i className="bi bi-wallet2" />
          </div>
          <h3
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#1a2e23",
              marginBottom: "4px",
            }}
          >
            No accounts added yet
          </h3>
          <p
            style={{
              fontSize: "0.82rem",
              color: "#6b7f72",
              marginBottom: 0,
            }}
          >
            Click &quot;+ Add account&quot; to add your bank accounts, e-wallets, cards or investment accounts.
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {accounts.map((account) => {
            const isCreditCard = Boolean(
              account.is_credit_card || account.account_type === "Credit Card"
            );
            const hasSubAccounts =
              !isCreditCard && account.subaccounts.length > 0;
            const allocatedTotal = account.subaccounts.reduce(
              (sum, s) => sum + Number(s.subaccount_value),
              0
            );
            const unallocatedBalance = Math.max(
              0,
              Number(account.account_balance) - allocatedTotal
            );
            const financingHold = Number(account.unpaid_financing_hold || 0);
            const swipeBalance = Number(account.account_balance);
            const hasSwipeDebt = swipeBalance < 0;
            const displayedBalance = isCreditCard
              ? round2(swipeBalance - financingHold)
              : swipeBalance;
            const isNegative = displayedBalance < 0;
            const badgeColor = account.color || "#1e4db7";
            const availableCreditLimit = isCreditCard
              ? getCreditCardAvailableLimit(account)
              : 0;
            const totalCreditLimit = Number(account.credit_limit || 0);

            return (
              <div
                key={account.account_id}
                className="col-12 col-md-6 col-xl-4"
              >
                <Card
                  className="rounded-4 border-0 shadow-sm h-100 position-relative"
                  styles={{
                    body: {
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      padding: "22px",
                    },
                  }}
                >
                  <div>
                    {/* Card Header */}
                    <div className="d-flex justify-content-between align-items-start mb-3 position-relative">
                      <div className="d-flex align-items-center gap-2 pe-2">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                          style={{
                            width: 38,
                            height: 38,
                            backgroundColor: badgeColor,
                          }}
                        >
                          <i
                            className={`bi ${getAccountTypeIcon(
                              account.account_type
                            )}`}
                          />
                        </div>
                        <div>
                          <h6
                            className="fw-bold mb-1"
                            style={{ fontSize: "0.92rem", color: "#1a2e23" }}
                          >
                            {account.account_name}
                          </h6>
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
                            {account.account_type}
                          </span>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditAccount(account)}
                          className="btn btn-sm text-secondary p-0 border-0"
                          title="Edit account"
                        >
                          <i
                            className="bi bi-pencil"
                            style={{ fontSize: "0.85rem" }}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAccount(account)}
                          className="btn btn-sm p-0 border-0 text-danger"
                          title="Remove account"
                        >
                          <i
                            className="bi bi-trash3"
                            style={{ fontSize: "0.85rem" }}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Account Balance */}
                    <div className="mt-3">
                      <span
                        className="text-secondary d-block"
                        style={{ fontSize: "0.73rem" }}
                      >
                        {isCreditCard
                          ? "Current balance"
                          : hasSubAccounts
                            ? "Total account balance"
                            : "Current balance"}
                      </span>
                      <h4
                        className="fw-bold mt-1 mb-0"
                        style={{
                          fontSize: "1.35rem",
                          color: isNegative ? "#dc2626" : "#1a2e23",
                        }}
                      >
                        {formatSignedRM(displayedBalance)}
                      </h4>

                      {/* Credit Card Limit Subtitle & Financing Hold Breakdown */}
                      {isCreditCard && (
                        <div className="mt-2">
                          <div
                            className="d-flex justify-content-between align-items-center"
                            style={{ fontSize: "0.75rem", color: "#4b6355" }}
                          >
                            <span>Available credit limit:</span>
                            <strong style={{ color: "#1a2e23" }}>
                              RM {formatAmount(availableCreditLimit)}
                              {totalCreditLimit > 0
                                ? ` / RM ${formatAmount(totalCreditLimit)}`
                                : ""}
                            </strong>
                          </div>

                          {financingHold > 0 && (
                            <div
                              className="mt-1 pt-1"
                              style={{
                                borderTop: "1px dashed #e2ebe4",
                                fontSize: "0.71rem",
                              }}
                            >
                              <div
                                className="d-flex justify-content-between align-items-center"
                                style={{ color: "#6b7f72" }}
                              >
                                <span>Daily swipes owed:</span>
                                <strong>{formatSignedRM(swipeBalance)}</strong>
                              </div>
                              <div
                                className="d-flex justify-content-between align-items-center mt-1"
                                style={{ color: "#1d4ed8" }}
                              >
                                <span>
                                  <i className="bi bi-lock-fill me-1" />
                                  Held in installments:
                                </span>
                                <strong>-RM {formatAmount(financingHold)}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sub-Accounts List (if any, non-credit cards only) */}
                    {hasSubAccounts && (
                      <div
                        className="mt-3 rounded-3 p-2"
                        style={{
                          backgroundColor: "#f8faf7",
                          border: "1px solid #edf2ec",
                        }}
                      >
                        {account.subaccounts.map((sub, idx) => (
                          <div
                            key={sub.subaccount_id}
                            className={`d-flex justify-content-between align-items-center py-2 px-1 ${
                              idx < account.subaccounts.length - 1
                                ? "border-bottom"
                                : ""
                            }`}
                            style={{ borderColor: "#e9efe8" }}
                          >
                            <div
                              className="d-flex align-items-center gap-2 text-truncate pe-2"
                              style={{ fontSize: "0.78rem", color: "#1a2e23" }}
                            >
                              <i className="bi bi-piggy-bank text-secondary" />
                              <span className="fw-medium text-truncate">
                                {sub.subaccount_name}
                              </span>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                              <span
                                className="fw-semibold"
                                style={{ fontSize: "0.78rem", color: "#1a2e23" }}
                              >
                                RM {formatAmount(Number(sub.subaccount_value))}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenEditSubAccount(account, sub)
                                }
                                className="btn btn-sm text-secondary p-0 border-0"
                                title="Edit sub-account"
                              >
                                <i
                                  className="bi bi-pencil"
                                  style={{ fontSize: "0.78rem" }}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingSubAccount({
                                    sub,
                                    parent: account,
                                  })
                                }
                                className="btn btn-sm text-danger p-0 border-0"
                                title="Remove sub-account"
                              >
                                <i
                                  className="bi bi-trash3"
                                  style={{ fontSize: "0.78rem" }}
                                />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Allocation Summary Row */}
                        <div
                          className="d-flex justify-content-between align-items-center pt-2 px-1 border-top mt-1"
                          style={{
                            fontSize: "0.7rem",
                            color: "#6b7f72",
                            borderColor: "#e2ebe0",
                          }}
                        >
                          <span>
                            Allocated: RM {formatAmount(allocatedTotal)}
                          </span>
                          <span>
                            Remaining: RM {formatAmount(unallocatedBalance)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Action: Pay Card (for Credit Cards) OR Add Sub-Account */}
                  <div className="mt-3 pt-1">
                    {isCreditCard ? (
                      <button
                        type="button"
                        disabled={!hasSwipeDebt}
                        onClick={() => handleOpenPayCard(account)}
                        className="btn btn-sm w-100 rounded-pill fw-medium"
                        style={{
                          backgroundColor: hasSwipeDebt ? "#f9fbf5" : "#f4f6f4",
                          border: "1px solid #e2ebe0",
                          color: hasSwipeDebt ? "#1a2e23" : "#94a39b",
                          fontSize: "0.78rem",
                          padding: "7px 12px",
                          cursor: hasSwipeDebt ? "pointer" : "not-allowed",
                          transition: "all 0.15s ease",
                        }}
                        title={
                          hasSwipeDebt
                            ? "Pay credit card swipe balance"
                            : financingHold > 0
                              ? "No daily swipe balance owed (pay installments via Financing page)"
                              : "No swipe balance owed (RM 0.00)"
                        }
                      >
                        <i className="bi bi-plus-lg me-1" /> Pay card
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenAddSubAccount(account)}
                        className="btn btn-sm w-100 rounded-pill fw-medium"
                        style={{
                          backgroundColor: "#f9fbf5",
                          border: "1px solid #e2ebe0",
                          color: "#1a2e23",
                          fontSize: "0.78rem",
                          padding: "7px 12px",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f0f4ec")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "#f9fbf5")
                        }
                      >
                        <i className="bi bi-plus-lg me-1" /> Add sub-account
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          MODAL 1: ADD / EDIT ACCOUNT MODAL
          ========================================================= */}
      <Modal
        open={accountModalOpen}
        onCancel={() => setAccountModalOpen(false)}
        footer={null}
        centered
        width={480}
        className="fintrack-modal"
        destroyOnHidden
      >
        <div>
          <h3
            className="mb-1"
            style={{ fontSize: "1.18rem", fontWeight: 600, color: "#1a2e23" }}
          >
            {accountModalMode === "add"
              ? "Add account"
              : `Edit ${editingAccount?.account_name || "account"}`}
          </h3>

          {accountModalMode === "edit" &&
            editingAccount &&
            accountType !== "Credit Card" &&
            editingAccount.subaccounts.length > 0 && (
              <p
                className="text-secondary mb-3"
                style={{ fontSize: "0.8rem" }}
              >
                RM{" "}
                {formatAmount(
                  editingAccount.subaccounts.reduce(
                    (s, item) => s + Number(item.subaccount_value),
                    0
                  )
                )}{" "}
                is currently allocated across{" "}
                {editingAccount.subaccounts.length} sub-account
                {editingAccount.subaccounts.length > 1 ? "s" : ""}.
              </p>
            )}

          <form onSubmit={handleSaveAccount} className="mt-3">
            {/* Account Name Field (Typed text input for both Add and Edit) */}
            <div className="mb-3">
              <label className="fintrack-modal-label">Account name</label>
              <input
                type="text"
                value={customAccountName}
                onChange={(e) => setCustomAccountName(e.target.value)}
                placeholder="e.g. Maybank Islamic Current, CIMB Savings, Visa Signature"
                className="form-control fintrack-modal-input"
                required
              />
            </div>

            {accountType === "Credit Card" ? (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="fintrack-modal-label">Type</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="form-select fintrack-modal-input"
                    >
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-6">
                    <label className="fintrack-modal-label">
                      Credit limit (RM)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={creditLimitInput}
                      onChange={(e) =>
                        setCreditLimitInput(
                          formatCentsInput(e.target.value, false)
                        )
                      }
                      placeholder="e.g. 8000.00"
                      className="form-control fintrack-modal-input"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="fintrack-modal-label">
                    Current swipe amount owed (RM){" "}
                    <span style={{ fontWeight: 400, color: "#6b7f72" }}>
                      (defaults to 0.00)
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={creditOwedInput}
                    onChange={(e) =>
                      setCreditOwedInput(
                        formatCentsInput(e.target.value, false)
                      )
                    }
                    placeholder="0.00"
                    className="form-control fintrack-modal-input"
                  />
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#6b7f72",
                      marginTop: "4px",
                    }}
                  >
                    Credit cards start at <strong>RM 0.00</strong>. Enter only
                    your unpaid <strong>daily card swipes</strong> here (linked
                    Financing installments are tracked automatically).
                  </div>
                  {(() => {
                    const parsedLimit = Math.max(
                      0,
                      round2(parseFloat(creditLimitInput || "0") || 0)
                    );
                    const parsedSwipeOwed = Math.max(
                      0,
                      round2(parseFloat(creditOwedInput || "0") || 0)
                    );
                    const activeHold =
                      accountModalMode === "edit" && editingAccount
                        ? round2(Number(editingAccount.unpaid_financing_hold || 0))
                        : 0;
                    const totalDisplayedDebt = round2(
                      parsedSwipeOwed + activeHold
                    );
                    const projectedAvailLimit = Math.max(
                      0,
                      round2(parsedLimit - totalDisplayedDebt)
                    );
                    if (
                      parsedLimit <= 0 &&
                      parsedSwipeOwed <= 0 &&
                      activeHold <= 0
                    ) {
                      return null;
                    }
                    return (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 12px",
                          borderRadius: "10px",
                          backgroundColor: "#f6f8f6",
                          border: "1px solid #e4ece6",
                          fontSize: "0.75rem",
                          color: "#334155",
                        }}
                      >
                        <div className="d-flex justify-content-between mb-1">
                          <span style={{ color: "#6b7f72" }}>
                            Daily swipes owed (editable above):
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                parsedSwipeOwed > 0 ? "#dc2626" : "#1a2e23",
                            }}
                          >
                            {parsedSwipeOwed > 0
                              ? `-RM ${formatAmount(parsedSwipeOwed)}`
                              : "RM 0.00"}
                          </span>
                        </div>
                        {activeHold > 0 && (
                          <div className="d-flex justify-content-between mb-1">
                            <span style={{ color: "#6b7f72" }}>
                              Active installments held (Financing):
                            </span>
                            <span
                              style={{ fontWeight: 600, color: "#dc2626" }}
                            >
                              -RM {formatAmount(activeHold)}
                            </span>
                          </div>
                        )}
                        <div
                          className="d-flex justify-content-between pt-1 mt-1"
                          style={{ borderTop: "1px dashed #d5e0d8" }}
                        >
                          <span style={{ fontWeight: 600, color: "#1a2e23" }}>
                            Total displayed card balance:
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                totalDisplayedDebt > 0 ? "#dc2626" : "#1a2e23",
                            }}
                          >
                            {totalDisplayedDebt > 0
                              ? `-RM ${formatAmount(totalDisplayedDebt)}`
                              : "RM 0.00"}
                          </span>
                        </div>
                        {parsedLimit > 0 && (
                          <div className="d-flex justify-content-between mt-1">
                            <span style={{ color: "#6b7f72" }}>
                              Projected available credit limit:
                            </span>
                            <span
                              style={{ fontWeight: 600, color: "#15803d" }}
                            >
                              RM {formatAmount(projectedAvailLimit)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              /* Type & Balance Row for Non-Credit Card Accounts */
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="fintrack-modal-label">Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="form-select fintrack-modal-input"
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6">
                  <label className="fintrack-modal-label">Balance (RM)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={accountBalanceInput}
                    onChange={(e) =>
                      setAccountBalanceInput(
                        formatCentsInput(e.target.value, true)
                      )
                    }
                    placeholder="0.00"
                    className="form-control fintrack-modal-input"
                  />
                </div>
              </div>
            )}

            {accountModalError && (
              <div
                className="alert alert-danger py-2 small mb-3"
                role="alert"
              >
                {accountModalError}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setAccountModalOpen(false)}
                disabled={savingAccount}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                className="fintrack-modal-primary-btn"
                loading={savingAccount}
              >
                {accountModalMode === "add" ? "Add account" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 2.5: PAY CREDIT CARD MODAL
          ========================================================= */}
      <Modal
        open={Boolean(payingCard)}
        onCancel={() => !payingCardLoading && setPayingCard(null)}
        footer={null}
        centered
        width={480}
        className="fintrack-modal"
        destroyOnHidden
      >
        {payingCard && (
          <div>
            <h3
              className="mb-1"
              style={{ fontSize: "1.18rem", fontWeight: 600, color: "#1a2e23" }}
            >
              Pay {payingCard.account_name}
            </h3>
            <p
              className="text-secondary mb-3"
              style={{ fontSize: "0.8rem", lineHeight: 1.5 }}
            >
              Settle your credit card swipe balance using a bank, e-wallet or
              cash account. (Installment plans are paid from the Financing or
              Commitments page.)
            </p>

            {payCardError && (
              <div
                className="alert alert-danger py-2 small mb-3"
                role="alert"
              >
                {payCardError}
              </div>
            )}

            {/* Card Summary Box */}
            <div
              className="rounded-3 p-3 mb-3"
              style={{
                backgroundColor: "#f8faf8",
                border: "1px solid #e6ece7",
                fontSize: "0.8rem",
              }}
            >
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary">Current swipe balance:</span>
                <strong style={{ color: "#dc2626" }}>
                  {formatSignedRM(Number(payingCard.account_balance))}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary">Available credit limit:</span>
                <strong style={{ color: "#1a2e23" }}>
                  RM {formatAmount(getCreditCardAvailableLimit(payingCard))}
                  {payingCard.credit_limit
                    ? ` / RM ${formatAmount(Number(payingCard.credit_limit))}`
                    : ""}
                </strong>
              </div>
            </div>

            <form onSubmit={handleConfirmPayCard}>
              {/* Amount & Date Row */}
              <div className="row g-2 mb-3">
                <div className="col-12 col-sm-6">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="fintrack-modal-label mb-0">
                      Amount to pay (RM)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPayCardAmountInput(
                          Math.abs(Number(payingCard.account_balance)).toFixed(
                            2
                          )
                        )
                      }
                      className="btn btn-sm py-0 px-2 rounded-pill"
                      style={{
                        fontSize: "0.68rem",
                        backgroundColor: "#e8f3ec",
                        color: "#4a7d5e",
                        fontWeight: 600,
                        border: "none",
                      }}
                    >
                      Full
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={payCardAmountInput}
                    onChange={(e) =>
                      setPayCardAmountInput(
                        formatCentsInput(e.target.value, false)
                      )
                    }
                    placeholder="0.00"
                    className="form-control fintrack-modal-input"
                  />
                </div>

                <div className="col-12 col-sm-6">
                  <label className="fintrack-modal-label">
                    Payment date (DD-MM-YYYY)
                  </label>
                  <DateInputDDMMYYYY
                    value={payCardDate}
                    onChange={setPayCardDate}
                    required
                  />
                </div>
              </div>

              {/* Source Account & Optional Sub-Account */}
              <div
                style={{
                  backgroundColor: "#f6faf7",
                  border: "1px solid #e2ebe4",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "14px",
                }}
              >
                <div className="mb-2">
                  <label className="fintrack-modal-label">
                    Pay from account (non-credit card)
                  </label>
                  <select
                    className="form-select fintrack-modal-input"
                    value={payCardSourceAccId}
                    onChange={(e) => {
                      setPayCardSourceAccId(e.target.value);
                      setPayCardSourceSubId("");
                    }}
                    required
                  >
                    <option value="">Select account...</option>
                    {nonCreditAccounts.map((acc) => (
                      <option key={acc.account_id} value={acc.account_id}>
                        {acc.account_name} (Available: RM{" "}
                        {formatAmount(getAvailableCashBalance(acc, ""))})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPayCardSourceAcc &&
                  selectedPayCardSourceAcc.subaccounts.length > 0 && (
                    <div className="mb-2">
                      <label className="fintrack-modal-label">
                        Sub-account (optional)
                      </label>
                      <select
                        className="form-select fintrack-modal-input"
                        value={payCardSourceSubId}
                        onChange={(e) => setPayCardSourceSubId(e.target.value)}
                      >
                        <option value="">
                          Unallocated (RM{" "}
                          {formatAmount(
                            getUnallocated(selectedPayCardSourceAcc)
                          )}
                          )
                        </option>
                        {selectedPayCardSourceAcc.subaccounts.map((sub) => (
                          <option
                            key={sub.subaccount_id}
                            value={sub.subaccount_id}
                          >
                            {sub.subaccount_name} (RM{" "}
                            {formatAmount(Number(sub.subaccount_value))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* Live Impact Preview */}
                {selectedPayCardSourceAcc &&
                  parseFloat(payCardAmountInput || "0") > 0 &&
                  (() => {
                    const amt = round2(parseFloat(payCardAmountInput || "0"));
                    const srcAvailBefore = getAvailableCashBalance(
                      selectedPayCardSourceAcc,
                      payCardSourceSubId
                    );
                    const srcAvailAfter = round2(srcAvailBefore - amt);
                    const cardBalBefore = Number(payingCard.account_balance);
                    const cardBalAfter = Math.min(
                      0,
                      round2(cardBalBefore + amt)
                    );
                    const cardLimitBefore =
                      getCreditCardAvailableLimit(payingCard);
                    const cardLimitAfter = round2(cardLimitBefore + amt);

                    return (
                      <div
                        className="pt-2 mt-2"
                        style={{
                          borderTop: "1px solid #e2ebe4",
                          fontSize: "0.75rem",
                          color: "#2e4738",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span>{selectedPayCardSourceAcc.account_name}:</span>
                          <strong>
                            RM {formatAmount(srcAvailBefore)} →{" "}
                            {formatSignedRM(srcAvailAfter)}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span>{payingCard.account_name} balance:</span>
                          <strong>
                            {formatSignedRM(cardBalBefore)} →{" "}
                            {formatSignedRM(cardBalAfter)}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span>Available credit limit:</span>
                          <strong style={{ color: "#15803d" }}>
                            RM {formatAmount(cardLimitBefore)} → RM{" "}
                            {formatAmount(cardLimitAfter)}
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Optional Note */}
              <div className="mb-3">
                <label className="fintrack-modal-label">Note (optional)</label>
                <input
                  type="text"
                  value={payCardNote}
                  onChange={(e) => setPayCardNote(e.target.value)}
                  placeholder="e.g. Monthly statement settlement"
                  className="form-control fintrack-modal-input"
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button
                  className="fintrack-modal-cancel-btn"
                  onClick={() => setPayingCard(null)}
                  disabled={payingCardLoading}
                >
                  Cancel
                </Button>
                <Button
                  htmlType="submit"
                  className="fintrack-modal-primary-btn"
                  loading={payingCardLoading}
                >
                  Confirm payment
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* =========================================================
          MODAL 2: ADD / EDIT SUB-ACCOUNT MODAL
          ========================================================= */}
      <Modal
        open={subModalOpen}
        onCancel={() => setSubModalOpen(false)}
        footer={null}
        centered
        width={480}
        className="fintrack-modal"
        destroyOnHidden
      >
        <div>
          <h3
            className="mb-1"
            style={{ fontSize: "1.18rem", fontWeight: 600, color: "#1a2e23" }}
          >
            {subModalMode === "add"
              ? `Add sub-account to ${targetParentAccount?.account_name || ""}`
              : `Edit sub-account in ${targetParentAccount?.account_name || ""}`}
          </h3>
          <p
            className="text-secondary mb-3"
            style={{ fontSize: "0.8rem", lineHeight: 1.5 }}
          >
            Use sub-accounts for pots inside one account — EPF accounts, savings
            pots, or anything you want to split.
          </p>

          <form onSubmit={handleSaveSubAccount}>
            {/* Sub-account Name */}
            <div className="mb-3">
              <label className="fintrack-modal-label">Sub-account name</label>
              <input
                type="text"
                required
                value={subAccountName}
                onChange={(e) => setSubAccountName(e.target.value)}
                placeholder="Account 1 / Travel Pot"
                className="form-control fintrack-modal-input"
              />
            </div>

            {/* Sub-account Balance with Available Amount Reflection */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="fintrack-modal-label mb-0">
                  Balance (RM)
                </label>
                {targetParentAccount && (
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="text-secondary"
                      style={{ fontSize: "0.74rem" }}
                    >
                      Available to add:{" "}
                      <strong style={{ color: "#4a7d5e" }}>
                        RM {formatAmount(maxAllocatableInModal)}
                      </strong>
                    </span>
                    {maxAllocatableInModal > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSubAccountBalanceInput(
                            maxAllocatableInModal.toFixed(2)
                          )
                        }
                        className="btn btn-sm py-0 px-2 rounded-pill"
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
                )}
              </div>

              <input
                type="text"
                inputMode="numeric"
                required
                value={subAccountBalanceInput}
                onChange={(e) =>
                  setSubAccountBalanceInput(
                    formatCentsInput(e.target.value, false)
                  )
                }
                placeholder="0.00"
                className="form-control fintrack-modal-input"
              />
            </div>

            {subModalError && (
              <div
                className="alert alert-danger py-2 small mb-3"
                role="alert"
              >
                {subModalError}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button
                className="fintrack-modal-cancel-btn"
                onClick={() => setSubModalOpen(false)}
                disabled={savingSubAccount}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                className="fintrack-modal-primary-btn"
                loading={savingSubAccount}
              >
                {subModalMode === "add" ? "Add sub-account" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* =========================================================
          MODAL 3: REMOVE ACCOUNT CONFIRMATION MODAL
          ========================================================= */}
      <ConfirmModal
        open={!!deletingAccount}
        title={
          deletingAccount
            ? `Remove "${deletingAccount.account_name}"?`
            : "Remove account?"
        }
        description={
          deletingAccount && (
            <div
              className="rounded-3 p-3 mt-2"
              style={{ backgroundColor: "#f6f8f5" }}
            >
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Account</span>
                <span className="fw-semibold text-dark">
                  {deletingAccount.account_name}
                </span>
              </div>
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Balance removed</span>
                <span className="fw-semibold text-dark">
                  {formatSignedRM(Number(deletingAccount.account_balance))}
                </span>
              </div>
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Combined balance after</span>
                <span className="fw-semibold text-dark">
                  {formatSignedRM(
                    combinedBalance - Number(deletingAccount.account_balance)
                  )}
                </span>
              </div>
              {deletingAccount.is_credit_card &&
                Number(deletingAccount.unpaid_financing_hold || 0) > 0 && (
                  <div
                    className="mt-2 pt-2"
                    style={{
                      borderTop: "1px solid #e2ebe4",
                      fontSize: "0.75rem",
                      color: "#4338ca",
                    }}
                  >
                    <i className="bi bi-info-circle me-1" />
                    Active financing plans holding{" "}
                    <strong>
                      RM{" "}
                      {formatAmount(
                        Number(deletingAccount.unpaid_financing_hold || 0)
                      )}
                    </strong>{" "}
                    on this card will be automatically unlinked and kept as
                    standalone plans.
                  </div>
                )}
            </div>
          )
        }
        confirmText="Remove account"
        cancelText="Keep account"
        variant="danger"
        loading={deletingLoading}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => setDeletingAccount(null)}
      />

      {/* =========================================================
          MODAL 4: REMOVE SUB-ACCOUNT CONFIRMATION MODAL
          ========================================================= */}
      <ConfirmModal
        open={!!deletingSubAccount}
        title={
          deletingSubAccount
            ? `Remove "${deletingSubAccount.sub.subaccount_name}"?`
            : "Remove sub-account?"
        }
        description={
          deletingSubAccount && (
            <div
              className="rounded-3 p-3 mt-2"
              style={{ backgroundColor: "#f6f8f5" }}
            >
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Sub-account</span>
                <span className="fw-semibold text-dark">
                  {deletingSubAccount.sub.subaccount_name}
                </span>
              </div>
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Parent account</span>
                <span className="fw-semibold text-dark">
                  {deletingSubAccount.parent.account_name}
                </span>
              </div>
              <div className="d-flex justify-content-between py-1">
                <span className="text-secondary">Amount freed up</span>
                <span className="fw-semibold text-dark">
                  RM {formatAmount(Number(deletingSubAccount.sub.subaccount_value))}
                </span>
              </div>
            </div>
          )
        }
        confirmText="Remove sub-account"
        cancelText="Keep sub-account"
        variant="danger"
        loading={deletingLoading}
        onConfirm={handleConfirmDeleteSubAccount}
        onCancel={() => setDeletingSubAccount(null)}
      />

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
