"use client";
import React, { useEffect, useState } from "react";
import { Menu, ConfigProvider } from "antd";
import type { MenuProps } from "antd";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";
import "./components.css";

interface UserProfile {
  fullName: string;
  email: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<UserProfile>({
    fullName: "Fintrack User",
    email: "",
  });
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;

      const resolvedName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "User";
      const resolvedEmail = profile?.email || user.email || "";

      setUserProfile({
        fullName: resolvedName,
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

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    router.push(key);
  };

  return (
    <>
      <div
        className="sidebar d-flex flex-column justify-content-between"
        style={{ width: 260, height: "100vh", flexShrink: 0 }}
      >
        <div style={{ overflowY: "auto", flexGrow: 1 }}>
          {/* Logo Section */}
          <div className="px-3 py-4 border-bottom">
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

          {/* Navigation Menu */}
          <ConfigProvider
            theme={{
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
            }}
          >
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

        {/* User Footer Section */}
        <div className="px-3 py-3 border-top d-flex align-items-center justify-content-between gap-2">
          <div
            className="d-flex align-items-center gap-2"
            style={{ minWidth: 0, flexGrow: 1 }}
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
          </div>

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
    </>
  );
}
