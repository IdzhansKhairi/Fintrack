"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/utils/supabase/client";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isAuthPage = pathname === "/login" || pathname === "/auth";
  const [checkingAuth, setCheckingAuth] = useState(!isAuthPage);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session && !isAuthPage) {
        router.replace("/login");
      } else if (session && isAuthPage) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    };

    verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !isAuthPage) {
        router.replace("/login");
      } else if (session && isAuthPage) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, isAuthPage, router, supabase]);

  if (isAuthPage) {
    return (
      <main style={{ minHeight: "100vh", width: "100%", overflowX: "hidden" }}>
        {children}
      </main>
    );
  }

  if (checkingAuth) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ height: "100vh", width: "100vw", backgroundColor: "#f9fbf5" }}
      >
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="d-flex flex-column flex-lg-row"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      <Sidebar />
      <main
        className="flex-grow-1"
        style={{ overflowY: "auto", overflowX: "hidden", minWidth: 0 }}
      >
        <div className="page-body-padding p-3 p-sm-4 p-lg-5">{children}</div>
      </main>
    </div>
  );
}
