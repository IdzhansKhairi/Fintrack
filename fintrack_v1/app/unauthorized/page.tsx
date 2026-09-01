"use client";

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="text-center">
        <h1 className="display-1">403</h1>
        <h2 className="mb-3">Access Denied</h2>
        <p className="text-muted mb-4">You don't have permission to access this page.</p>
        <Link href="/login" className="btn btn-primary">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
