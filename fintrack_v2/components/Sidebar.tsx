"use client";
import React, { useEffect, useState } from "react";
import { Menu, ConfigProvider, Modal } from "antd";
import type { MenuProps } from "antd";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";
import BottomToast, { BottomToastType } from "@/components/BottomToast";
import "./components.css";

interface UserProfile {
  fullName: string;
  preferredName: string;
  email: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<UserProfile>({
    fullName: "Fintrack User",
    preferredName: "User",
    email: "",
  });
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Profile Edit Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPreferredName, setEditPreferredName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileModalError, setProfileModalError] = useState<string | null>(null);

  // Toast
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type: BottomToastType;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, preferred_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      const resolvedFullName =
        profile?.full_name?.trim() ||
        user.user_metadata?.full_name?.trim() ||
        user.email?.split("@")[0] ||
        "User";
      const resolvedPreferred =
        profile?.preferred_name?.trim() ||
        user.user_metadata?.preferred_name?.trim() ||
        resolvedFullName.split(/\s+/)[0] ||
        "User";
      const resolvedEmail = profile?.email || user.email || "";

      setUserProfile({
        fullName: resolvedFullName,
        preferredName: resolvedPreferred,
        email: resolvedEmail,
      });
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setLogoutModalOpen(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleOpenProfileModal = () => {
    setEditFullName(userProfile.fullName);
    setEditPreferredName(userProfile.preferredName);
    setEditEmail(userProfile.email);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setProfileModalError(null);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileModalError(null);

    const trimmedFull = editFullName.trim();
    const trimmedPreferred =
      editPreferredName.trim() || trimmedFull.split(/\s+/)[0] || trimmedFull;
    const trimmedEmail = editEmail.trim();

    if (!trimmedFull) {
      setProfileModalError("Full name is required.");
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setProfileModalError("Please enter a valid email address.");
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.length < 6) {
        setProfileModalError("Password must be at least 6 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setProfileModalError("Passwords do not match.");
        return;
      }
    }

    setSavingProfile(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        throw new Error("User session not found. Please log in again.");
      }

      const authUpdates: {
        email?: string;
        password?: string;
        data?: { full_name: string; preferred_name: string };
      } = {
        data: {
          full_name: trimmedFull,
          preferred_name: trimmedPreferred,
        },
      };

      if (trimmedEmail !== user.email) {
        authUpdates.email = trimmedEmail;
      }
      if (newPassword.trim()) {
        authUpdates.password = newPassword.trim();
      }

      // 1. Update Supabase Auth user record (updates user_metadata & auth credentials)
      const { error: authUpdateErr } = await supabase.auth.updateUser(
        authUpdates
      );
      if (authUpdateErr) throw authUpdateErr;

      // 2. Update profiles table directly (use update instead of upsert to satisfy RLS policy)
      const { data: updateData, error: profileUpdateErr } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedFull,
          preferred_name: trimmedPreferred,
          email: trimmedEmail,
        })
        .eq("id", user.id)
        .select();

      if (profileUpdateErr || !updateData || updateData.length === 0) {
        // Fallback: update only names if email is restricted by RLS
        const { error: fallbackErr } = await supabase
          .from("profiles")
          .update({
            full_name: trimmedFull,
            preferred_name: trimmedPreferred,
          })
          .eq("id", user.id);

        if (fallbackErr) {
          console.warn("Profile table update fallback note:", fallbackErr);
        }
      }

      // 3. Update local state
      setUserProfile({
        fullName: trimmedFull,
        preferredName: trimmedPreferred,
        email: trimmedEmail,
      });

      setProfileModalOpen(false);
      setToastInfo({
        message: "Profile updated successfully!",
        type: "success",
      });

      // Refresh page so dashboard greeting and other views reflect new name
      router.refresh();
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      setProfileModalError(
        err.message || "Failed to update profile. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const menuItems: MenuProps["items"] = [
    {
      type: "group",
      key: "grp-overview",
      label: "Overview",
      children: [
        { key: "/dashboard", icon: <i className="bi bi-grid-1x2" />, label: "Dashboard" },
        { key: "/insights", icon: <i className="bi bi-pie-chart" />, label: "Insights" },
      ],
    },
    {
      type: "group",
      key: "grp-cash-flow",
      label: "Cash Flow",
      children: [
        { key: "/accounts", icon: <i className="bi bi-wallet2" />, label: "Accounts" },
        { key: "/transaction", icon: <i className="bi bi-arrow-left-right" />, label: "Transactions" },
        { key: "/qrcodes", icon: <i className="bi bi-qr-code-scan" />, label: "QR Codes" },
      ],
    },
    {
      type: "group",
      key: "grp-budgeting",
      label: "Budgeting",
      children: [
        { key: "/commitments", icon: <i className="bi bi-arrow-repeat" />, label: "Commitments" },
        { key: "/financing", icon: <i className="bi bi-credit-card-2-front" />, label: "Financing" },
        { key: "/debts", icon: <i className="bi bi-cash-coin" />, label: "Debts" },
      ],
    },
    {
      type: "group",
      key: "grp-goals",
      label: "Goals & Planning",
      children: [
        { key: "/tabung", icon: <i className="bi bi-piggy-bank" />, label: "Tabung" },
        { key: "/wishlist", icon: <i className="bi bi-heart" />, label: "Wishlist" },
      ],
    },
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    setMobileMenuOpen(false);
    router.push(key);
  };

  const menuConfigTheme = {
    components: {
      Menu: {
        darkItemBg: "transparent",
        darkItemColor: "#dbe7da",
        darkItemHoverBg: "rgba(10, 55, 35)",
        darkItemHoverColor: "#ffffff",
        darkItemSelectedBg: "rgba(105, 169, 128)",
        darkItemSelectedColor: "#ffffff",
        darkSubMenuItemBg: "transparent",
        itemBorderRadius: 12,
        itemHeight: 38,
        iconSize: 13,
        itemMarginInline: 12,
        itemMarginBlock: 4,
        itemPaddingInline: 16,
      },
    },
  };

  return (
    <>
      {/* =====================================================================
          MOBILE & TABLET TOP NAVBAR (< 992px / below lg)
      ===================================================================== */}
      <nav className="sidebar d-flex d-lg-none align-items-center justify-content-between px-3 py-2 flex-shrink-0 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm border-0 p-1 d-flex align-items-center justify-content-center mobile-hamburger-btn ${
              mobileMenuOpen ? "is-open" : ""
            }`}
            style={{ color: "#eef8ea" }}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <i className="bi bi-list" style={{ fontSize: "1.55rem", lineHeight: 1 }} />
          </button>
          <Link
            href="/dashboard"
            className="d-flex align-items-center text-decoration-none"
          >
            <Image
              src="/images/fintrack-logo.png"
              alt="Fintrack Logo"
              width={34}
              height={34}
              className="me-2 logo-img"
            />
            <div className="d-flex flex-column">
              <span className="fs-6 fw-bold logo-text lh-1">Fintrack</span>
              <span className="logo-subtext" style={{ fontSize: "0.62rem" }}>
                Personal finance
              </span>
            </div>
          </Link>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm p-0 border-0 d-flex align-items-center"
            onClick={handleOpenProfileModal}
            title="Edit profile & account settings"
            aria-label="Edit profile"
          >
            <div className="sidebar-avatar" style={{ width: 32, height: 32, fontSize: "0.75rem" }}>
              {getInitials(userProfile.fullName)}
            </div>
          </button>
          <button
            type="button"
            className="sidebar-logout-btn"
            style={{ width: 32, height: 32 }}
            onClick={() => setLogoutModalOpen(true)}
            title="Sign out"
            aria-label="Sign out"
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: "0.95rem" }} />
          </button>
        </div>
      </nav>

      {/* =====================================================================
          MOBILE & TABLET BOOTSTRAP OFFCANVAS DRAWER (< 992px / below lg)
      ===================================================================== */}
      <div
        className={`offcanvas-backdrop fade d-lg-none mobile-sidebar-backdrop ${
          mobileMenuOpen ? "show" : ""
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`offcanvas offcanvas-start sidebar d-flex d-lg-none flex-column justify-content-between mobile-sidebar-drawer ${
          mobileMenuOpen ? "show" : ""
        }`}
        tabIndex={-1}
        role="dialog"
        aria-modal={mobileMenuOpen}
        aria-hidden={!mobileMenuOpen}
        aria-label="Navigation menu"
        style={{ overflow: "hidden" }}
      >
        {/* Fixed Header: Logo & Close Button (never scrolls) */}
        <div className="px-3 py-3 border-bottom d-flex align-items-center justify-content-between flex-shrink-0">
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="d-flex align-items-end text-decoration-none"
          >
            <Image
              src="/images/fintrack-logo.png"
              alt="Fintrack Logo"
              width={40}
              height={40}
              className="me-2 logo-img"
            />
            <div className="d-flex flex-column">
              <span className="fs-5 fw-bold logo-text lh-1">Fintrack</span>
              <span className="logo-subtext mt-1">Personal finance</span>
            </div>
          </Link>
          <button
            type="button"
            className="btn btn-sm border-0 p-1 mobile-sidebar-close-btn"
            style={{ color: "#dbe7da" }}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <i className="bi bi-x-lg" style={{ fontSize: "1.1rem" }} />
          </button>
        </div>

        {/* Scrollable Navigation Menu Only */}
        <div style={{ overflowY: "auto", overflowX: "hidden", flexGrow: 1, minHeight: 0 }}>
          <ConfigProvider theme={menuConfigTheme}>
            <Menu
              mode="inline"
              theme="dark"
              selectedKeys={[pathname]}
              items={menuItems}
              onClick={handleMenuClick}
              className="pt-2 pb-2"
              style={{
                background: "transparent",
                border: "none",
                fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: "0.78rem",
              }}
            />
          </ConfigProvider>
        </div>

        {/* Fixed User Footer Section (never scrolls) */}
        <div className="px-3 py-3 border-top d-flex align-items-center justify-content-between gap-2 flex-shrink-0">
          <button
            type="button"
            className="sidebar-profile-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              handleOpenProfileModal();
            }}
            title="Edit profile & account settings"
          >
            <div className="sidebar-avatar">
              {getInitials(userProfile.fullName)}
            </div>
            <div className="d-flex flex-column" style={{ minWidth: 0 }}>
              <span className="sidebar-user-name text-truncate">
                {userProfile.fullName}
              </span>
              {userProfile.email && (
                <span className="sidebar-user-email text-truncate">
                  {userProfile.email}
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              setLogoutModalOpen(true);
            }}
            title="Sign out"
            aria-label="Sign out"
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: "1rem" }} />
          </button>
        </div>
      </div>

      {/* =====================================================================
          DESKTOP SIDEBAR (>= 992px / lg and above)
      ===================================================================== */}
      <div
        className="sidebar d-none d-lg-flex flex-column justify-content-between"
        style={{ width: 260, height: "100dvh", flexShrink: 0, overflow: "hidden" }}
      >
        {/* Fixed Logo Section (never scrolls) */}
        <div className="px-3 py-4 border-bottom flex-shrink-0">
          <Link
            href="/dashboard"
            className="d-flex align-items-end text-decoration-none"
          >
            <Image
              src="/images/fintrack-logo.png"
              alt="Fintrack Logo"
              width={46}
              height={46}
              className="me-3 logo-img"
            />
            <div className="d-flex flex-column">
              <span className="fs-5 fw-bold logo-text lh-1">Fintrack</span>
              <span className="logo-subtext mt-1">Personal finance</span>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation Menu Only */}
        <div style={{ overflowY: "auto", overflowX: "hidden", flexGrow: 1, minHeight: 0 }}>
          <ConfigProvider theme={menuConfigTheme}>
            <Menu
              mode="inline"
              theme="dark"
              selectedKeys={[pathname]}
              items={menuItems}
              onClick={handleMenuClick}
              className="pt-3 pb-3"
              style={{
                background: "transparent",
                border: "none",
                fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: "0.75rem",
              }}
            />
          </ConfigProvider>
        </div>

        {/* Fixed User Footer Section (never scrolls) */}
        <div className="px-3 py-3 border-top d-flex align-items-center justify-content-between gap-2 flex-shrink-0">
          <button
            type="button"
            className="sidebar-profile-btn"
            onClick={handleOpenProfileModal}
            title="Edit profile & account settings"
          >
            <div className="sidebar-avatar">
              {getInitials(userProfile.fullName)}
            </div>
            <div className="d-flex flex-column" style={{ minWidth: 0 }}>
              <span className="sidebar-user-name text-truncate">
                {userProfile.fullName}
              </span>
              {userProfile.email && (
                <span className="sidebar-user-email text-truncate">
                  {userProfile.email}
                </span>
              )}
            </div>
          </button>

          {/* Dedicated Sign Out Icon Button */}
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => setLogoutModalOpen(true)}
            title="Sign out"
            aria-label="Sign out"
          >
            <i className="bi bi-box-arrow-right" style={{ fontSize: "1rem" }} />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        open={logoutModalOpen}
        title="Sign out of Fintrack?"
        description="Are you sure you want to sign out of your account? You will need to sign in again to access your financial dashboard."
        confirmText="Sign out"
        cancelText="Cancel"
        variant="danger"
        icon={<i className="bi bi-box-arrow-right" />}
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalOpen(false)}
      />

      {/* Account Profile & Settings Modal */}
      <Modal
        open={profileModalOpen}
        onCancel={() => !savingProfile && setProfileModalOpen(false)}
        footer={null}
        centered
        width={460}
        className="fintrack-modal"
        destroyOnHidden
        styles={{
          body: {
            padding: "8px 4px",
          },
        }}
      >
        <div className="d-flex align-items-center gap-3 mb-3">
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#69a980",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(editFullName || userProfile.fullName)}
          </div>
          <div>
            <h5
              className="fw-bold mb-0"
              style={{ color: "#1a2e23", fontSize: "1.1rem" }}
            >
              Account profile
            </h5>
            <span style={{ fontSize: "0.78rem", color: "#6b7f72" }}>
              Update your personal details and credentials
            </span>
          </div>
        </div>

        {profileModalError && (
          <div
            className="alert alert-danger py-2 px-3 mb-3 d-flex align-items-center gap-2"
            style={{ fontSize: "0.82rem", borderRadius: "10px" }}
          >
            <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
            <span>{profileModalError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="d-flex flex-column gap-3">
          <div>
            <label
              className="form-label mb-1"
              style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1a2e23" }}
            >
              Full name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="e.g. Ahmad Zulkifli"
              style={{
                borderRadius: "10px",
                border: "1px solid #dbe2dc",
                fontSize: "0.86rem",
                padding: "9px 13px",
              }}
              required
            />
          </div>

          <div>
            <label
              className="form-label mb-1"
              style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1a2e23" }}
            >
              Preferred name / Nickname
            </label>
            <input
              type="text"
              className="form-control"
              value={editPreferredName}
              onChange={(e) => setEditPreferredName(e.target.value)}
              placeholder="e.g. Ahmad (used in greetings)"
              style={{
                borderRadius: "10px",
                border: "1px solid #dbe2dc",
                fontSize: "0.86rem",
                padding: "9px 13px",
              }}
            />
            <span style={{ fontSize: "0.72rem", color: "#8b9d90" }}>
              Used in the dashboard greeting (&quot;Welcome back,{" "}
              {editPreferredName.trim() || "Ahmad"}&quot;)
            </span>
          </div>

          <div>
            <label
              className="form-label mb-1"
              style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1a2e23" }}
            >
              Email address <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              className="form-control"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="name@example.com"
              style={{
                borderRadius: "10px",
                border: "1px solid #dbe2dc",
                fontSize: "0.86rem",
                padding: "9px 13px",
              }}
              required
            />
          </div>

          <div
            style={{
              backgroundColor: "#f7faf8",
              borderRadius: "14px",
              padding: "14px 16px",
              border: "1px solid #eef2ed",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "#1a2e23",
                }}
              >
                Change password
              </span>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none"
                style={{
                  fontSize: "0.75rem",
                  color: "#69a980",
                  fontWeight: 600,
                }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#6b7f72",
                display: "block",
                marginBottom: "10px",
              }}
            >
              Leave blank if you do not want to change your password
            </span>

            <div className="d-flex flex-column gap-2">
              <input
                type={showPassword ? "text" : "password"}
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                style={{
                  borderRadius: "10px",
                  border: "1px solid #dbe2dc",
                  fontSize: "0.86rem",
                  padding: "9px 13px",
                  backgroundColor: "#ffffff",
                }}
              />
              {newPassword && (
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #dbe2dc",
                    fontSize: "0.86rem",
                    padding: "9px 13px",
                    backgroundColor: "#ffffff",
                  }}
                  required={Boolean(newPassword)}
                />
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2 pt-2 border-top">
            <button
              type="button"
              className="btn btn-sm border-0"
              style={{
                backgroundColor: "#f1f5f3",
                color: "#4b5e52",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "8px 18px",
              }}
              onClick={() => setProfileModalOpen(false)}
              disabled={savingProfile}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm"
              style={{
                backgroundColor: "#69a980",
                color: "#ffffff",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "8px 22px",
                border: "none",
              }}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bottom Toast Notification */}
      <BottomToast
        open={Boolean(toastInfo)}
        message={toastInfo?.message || ""}
        type={toastInfo?.type || "success"}
        onClose={() => setToastInfo(null)}
      />
    </>
  );
}
