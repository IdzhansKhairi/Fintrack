"use client";

import { useState } from 'react';
import { usePathname } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { useNavigationLoading } from "../contexts/NavigationLoadingContext";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LaptopOutlined, NotificationOutlined, UserOutlined, DashboardOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Breadcrumb, Layout, Menu, theme } from 'antd';

import "./components.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/reset.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@sweetalert2/theme-bootstrap-4/bootstrap-4.min.css';

import Swal from 'sweetalert2';
import Image from 'next/image'
import Link from "next/link"
import React from "react";

const { Sider } = Layout;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface SidebarProps {
  isOpen: boolean;
  onMenuClick?: () => void;
}

export default function Sidebar({ isOpen, onMenuClick }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { startNavigation } = useNavigationLoading();

  // Handle menu item click - close sidebar on mobile + trigger loading
  const handleMenuClick = (info: any) => {
    const currentActiveKeys = getActiveKey();
    
    // Only show loading overlay when navigating to a different page
    if (info.key && !currentActiveKeys.includes(info.key)) {
      startNavigation();
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 768 && onMenuClick) {
      onMenuClick();
    }
  };

  // Get the active menu key based on current pathname
  const getActiveKey = (): string[] => {
    // Map pathnames to menu keys
    const pathToKey: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/dashboard/finance-dashboard': 'finance-dashboard',
      '/dashboard/add-transaction': 'add-transaction',
      '/dashboard/transaction-record': 'transaction-record',
      '/dashboard/spending-insights': 'spending-insights',
      '/dashboard/commitment': 'commitment',
      '/dashboard/wishlist': 'wishlist',
      '/dashboard/debts-tracker': 'debts',
      '/dashboard/financing': 'financing',
      '/dashboard/payment-qr': 'payment-qr'
    };

    const key = pathToKey[pathname];
    return key ? [key] : ['dashboard'];
  };

  // Get the parent menu keys that should be open based on current pathname
  const getOpenKeys = (): string[] => {
    const openKeys: string[] = [];

    // Transactions submenu
    if (['/dashboard/add-transaction', '/dashboard/transaction-record', '/dashboard/spending-insights'].includes(pathname)) {
      openKeys.push('transactions');
    }

    // Budgeting submenu
    if (['/dashboard/commitment', '/dashboard/wishlist', '/dashboard/debts-tracker', '/dashboard/financing'].includes(pathname)) {
      openKeys.push('budgeting');
    }

    // Quick Access submenu
    if (['/dashboard/payment-qr'].includes(pathname)) {
      openKeys.push('quick-access');
    }

    return openKeys;
  };

  // All authenticated users can access all pages
  const canAccess = (path: string) => {
    // If user is logged in, they can access everything
    return !!user;
  }

  // Define the sidebar accessibility 
  const sidebarItems: MenuProps['items'] = [];

  // Dashboard
  sidebarItems.push({
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: <Link href="/dashboard" className="text-decoration-none">Dashboard</Link>
  });

  // Financial Tracker Apps Related:
  // --------------------------------------------------------------------------------------------

  const transactionsChildren: MenuProps['items'] = [];
  if (canAccess("/dashboard/add-transaction")) {
    transactionsChildren.push({
      key: 'add-transaction',
      icon: <i className='bi bi-currency-dollar'></i>,
      label: <Link href="/dashboard/add-transaction" className='text-decoration-none'>Add Transaction</Link>
    })
  }
  if (canAccess("/dashboard/transaction-record")) {
    transactionsChildren.push({
      key: 'transaction-record',
      icon: <i className='bi bi-table'></i>,
      label: <Link href="/dashboard/transaction-record" className='text-decoration-none'>Transaction Records</Link>
    })
  }
  if (canAccess("/dashboard/spending-insights")) {
    transactionsChildren.push({
      key: 'spending-insights',
      icon: <i className='bi bi-bar-chart-line'></i>,
      label: <Link href="/dashboard/spending-insights" className='text-decoration-none'>Spending Insights</Link>
    })
  }
  if (transactionsChildren.length > 0) {
    sidebarItems.push({
      key: 'transactions',
      icon: <i className='bi bi-journal-text'></i>,
      label: <span>Transactions</span>,
      children: transactionsChildren
    })
  }

  const budgetingChildren: MenuProps['items'] = [];
  if (canAccess("/dashboard/commitment")) {
    budgetingChildren.push({
      key: 'commitment',
      icon: <i className='bi bi-cash-stack'></i>,
      label: <Link href="/dashboard/commitment" className='text-decoration-none'>Commitments</Link>
    })
  }
  if (canAccess("/dashboard/financing")) {
    budgetingChildren.push({
      key: 'financing',
      icon: <i className='bi bi-bank'></i>,
      label: <Link href="/dashboard/financing" className='text-decoration-none'>Financing</Link>
    })
  }
  if (canAccess("/dashboard/commitment")) {
    budgetingChildren.push({
      key: 'wishlist',
      icon: <i className='bi bi-gift'></i>,
      label: <Link href="/dashboard/wishlist" className='text-decoration-none'>Wishlists</Link>
    })
  }
  if (canAccess("/dashboard/debts-tracker")) {
    budgetingChildren.push({
      key: 'debts',
      icon: <i className='bi bi-person-check'></i>,
      label: <Link href="/dashboard/debts-tracker" className='text-decoration-none'>Debts</Link>
    })
  }
  if (budgetingChildren.length > 0) {
    sidebarItems.push({
      key: 'budgeting',
      icon: <i className='bi bi-wallet2'></i>,
      label: <span>Budgeting</span>,
      children: budgetingChildren
    })
  }

  // Quick Access Section:
  // --------------------------------------------------------------------------------------------

  const quickAccessChildren: MenuProps['items'] = [];
  if (canAccess("/dashboard/payment-qr")) {
    quickAccessChildren.push({
      key: 'payment-qr',
      icon: <i className='bi bi-qr-code'></i>,
      label: <Link href="/dashboard/payment-qr" className='text-decoration-none'>Payment QR</Link>
    })
  }
  if (quickAccessChildren.length > 0) {
    sidebarItems.push({
      key: 'quick-access',
      icon: <i className='bi bi-lightning-charge'></i>,
      label: <span>Quick Access</span>,
      children: quickAccessChildren
    })
  }

  // --------------------------------------------------------------------------------------------

  const getLinkClass = (path: string) =>
    pathname === path
      ? "sidebar-link active" : "sidebar-link";

  return (

    <div className={`${geistSans.variable} ${geistMono.variable} antialiased bg-dark h-100`}>
      <Sider trigger={null} collapsible width={290} className='bg-dark' collapsed={!isOpen}>
        <Menu
          mode="inline"
          selectedKeys={getActiveKey()}
          defaultOpenKeys={getOpenKeys()}
          style={{ borderInlineEnd: 0 }}
          className='bg-dark h-100'
          theme="dark"
          items={sidebarItems}
          onClick={handleMenuClick}
        />
      </Sider>
    </div>

    // <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
    //     <div className="d-flex" style={{ minHeight: "100vh" }}>

    //       {/* Sidebar */}
    //       <div className={`bg-dark p-3 sidebar ${!isOpen ? "closed" : ""}`}>

    //         {/* Dashboard */}
    //         <div className="mb-4">
    //           <Link href="/dashboard" className={`p-1 ps-2 my-2 ${getLinkClass("/dashboard")}`}>
    //             <i className="bi bi-speedometer2 me-2"></i>Dashboard
    //           </Link>
    //         </div>

    //         {/* Visitor Management Section */}
    //         {(canAccess("/dashboard/registration") || canAccess("/dashboard/visitor-list")) && (
    //           <div className="mb-4">

    //             <h6 className="p-1 ps-2 pb-0 mb-0 text-secondary">Visitor Management</h6>

    //             {canAccess("/dashboard/registration") && (
    //               <Link href="/dashboard/registration" className={`p-1 ps-2 my-1 ${getLinkClass("/dashboard/registration")}`}>
    //                 <i className="bi bi-person-check me-2"></i>Registration
    //               </Link>
    //             )}

    //             {canAccess("/dashboard/visitor-list") && (
    //               <Link href="/dashboard/visitor-list" className={`p-1 ps-2 my-1 ${getLinkClass("/dashboard/visitor-list")}`}>
    //                 <i className="bi bi-card-list me-2"></i>Visitor List
    //               </Link>
    //             )}

    //           </div>
    //         )}


    //         {/* Admin Section */}
    //         {(canAccess("/dashboard/security-list") || canAccess("/dashboard/report")) && (
    //           <div className="mb-4">
    //             <h6 className="p-1 ps-2 pb-0 mb-0 text-secondary">Managerial</h6>
    //             {canAccess("/dashboard/security-list") && (
    //               <Link href="/dashboard/security-list" className={`p-1 ps-2 my-1 ${getLinkClass("/dashboard/security-list")}`}>
    //                 <i className="bi bi-person-lines-fill me-2"></i>Security List
    //               </Link>
    //             )}
    //             {canAccess("/dashboard/report") && (
    //               <Link href="/dashboard/report" className={`p-1 ps-2 my-1 ${getLinkClass("/dashboard/report")}`}>
    //                 <i className="bi bi-file-earmark-text me-2"></i>Report
    //               </Link>
    //             )}
    //           </div>
    //         )}            
    //     </div>

    //   </div>
    // </div>
  );
}
