"use client";

import React, { useEffect, useState, useCallback } from "react";
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

      const [accountsRes, subaccountsRes] = await Promise.all([
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

      if (accountsRes.error) throw accountsRes.error;
      if (subaccountsRes.error) throw subaccountsRes.error;

      const rawAccounts = accountsRes.data || [];
      const rawSubs = subaccountsRes.data || [];

      const merged: Account[] = rawAccounts.map((acc) => ({
        ...acc,
        account_balance: Number(acc.account_balance),
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

  // Combined balance across all active accounts
  const combinedBalance = accounts.reduce(
    (sum, acc) => sum + Number(acc.account_balance),
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
    return `updated ${latest.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
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
    setAccountModalError(null);
    setAccountModalOpen(true);
  };

  const handleOpenEditAccount = (account: Account) => {
    setAccountModalMode("edit");
    setEditingAccount(account);
    setCustomAccountName(account.account_name);
    setAccountType(account.account_type);
    setAccountBalanceInput(Number(account.account_balance).toFixed(2));
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

    const parsedBalance = parseFloat(accountBalanceInput);
    if (isNaN(parsedBalance)) {
      setAccountModalError("Please enter a valid balance amount.");
      return;
    }

    const roundedBalance = Math.round(parsedBalance * 100) / 100;

    // If editing an account with sub-accounts, make sure total balance is not less than allocated sub-accounts sum
    if (accountModalMode === "edit" && editingAccount) {
      const allocatedSum = editingAccount.subaccounts.reduce(
        (sum, s) => sum + Number(s.subaccount_value),
        0
      );
      if (editingAccount.subaccounts.length > 0 && roundedBalance < allocatedSum - 0.001) {
        setAccountModalError(
          `Account balance cannot be lower than the total already allocated in sub-accounts (RM ${formatAmount(
            allocatedSum
          )}).`
        );
        return;
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
        <Card className="rounded-4 border-0 shadow-sm text-center py-5">
          <div
            className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
            style={{
              width: 56,
              height: 56,
              backgroundColor: "#eef3ed",
              color: "#57926e",
              fontSize: "1.5rem",
            }}
          >
            <i className="bi bi-wallet2" />
          </div>
          <h3 className="fw-bold mb-1">No accounts added yet</h3>
          <p className="text-secondary small mb-0">
            Add your first bank account, e-wallet, card, or retirement fund to
            start tracking your net worth.
          </p>
        </Card>
      ) : (
        <div className="row g-4">
          {accounts.map((account) => {
            const hasSubAccounts = account.subaccounts.length > 0;
            const allocatedTotal = account.subaccounts.reduce(
              (sum, s) => sum + Number(s.subaccount_value),
              0
            );
            const unallocatedBalance = Math.max(
              0,
              Number(account.account_balance) - allocatedTotal
            );
            const isNegative = Number(account.account_balance) < 0;
            const badgeColor = account.color || "#1e4db7";

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
                        {hasSubAccounts
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
                        {formatSignedRM(Number(account.account_balance))}
                      </h4>
                    </div>

                    {/* Sub-Accounts List (if any) */}
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

                  {/* Add Sub-Account Button */}
                  <div className="mt-3 pt-1">
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
                placeholder="e.g. Maybank Islamic Current, CIMB Savings, KWSP"
                className="form-control fintrack-modal-input"
                required
              />
            </div>

            {/* Type & Balance Row */}
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
