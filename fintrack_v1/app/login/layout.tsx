import type { ReactNode } from "react";

export const metadata = { 
  title: "Finttrack Login" 
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {children}
    </div>
  );
}
