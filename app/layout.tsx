"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Spade, Users, Trophy, BarChart2, Medal, Lock, Unlock, X } from "lucide-react";
import { AdminProvider, useAdmin } from "./context/AdminContext";
import { useState } from "react";

const navItems = [
  { href: "/", icon: Spade, label: "Games" },
  { href: "/players", icon: Users, label: "Players" },
  { href: "/rankings", icon: Trophy, label: "Rankings" },
  { href: "/stats", icon: BarChart2, label: "Stats" },
  { href: "/achievements", icon: Medal, label: "Medals" },
];

function AdminModal({ onClose }: { onClose: () => void }) {
  const { isAdmin, login, logout } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!pin) return;
    setLoading(true);
    setError("");
    const result = await login(pin);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Invalid PIN");
      setPin("");
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[430px] bg-[#161b16] border-t border-[#2d3d2d] rounded-t-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">
            {isAdmin ? "Admin Mode" : "Admin Login"}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {isAdmin ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl mb-4">
              <Unlock size={18} className="text-[#10b981]" />
              <div>
                <p className="text-sm font-semibold text-[#10b981]">Admin mode active</p>
                <p className="text-xs text-gray-500">You can create games and enter scores</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl border border-[#2d3d2d] text-gray-400 font-semibold text-sm hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              Sign out of admin
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-[#1f2d1f] border border-[#2d3d2d] rounded-xl mb-4">
              <Lock size={18} className="text-gray-500" />
              <div>
                <p className="text-sm font-semibold text-gray-300">Viewer mode</p>
                <p className="text-xs text-gray-500">Enter your PIN to manage games and scores</p>
              </div>
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin PIN"
              autoFocus
              className="w-full bg-[#0f160f] border border-[#2d3d2d] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#10b981] mb-3 text-center text-xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={loading || !pin}
              className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-[#10b981]/30 disabled:text-white/40 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? "Verifying..." : "Unlock"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { isAdmin, isLoading } = useAdmin();
  const [showAdminModal, setShowAdminModal] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0f160f] border-t border-[#1f2d1f] z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/games")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  isActive ? "text-[#10b981]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}

          {/* Admin lock button */}
          {!isLoading && (
            <button
              onClick={() => setShowAdminModal(true)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isAdmin ? "text-[#10b981]" : "text-gray-600 hover:text-gray-400"
              }`}
              title={isAdmin ? "Admin mode active" : "Admin login"}
            >
              {isAdmin ? <Unlock size={22} /> : <Lock size={22} />}
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </nav>

      {showAdminModal && <AdminModal onClose={() => setShowAdminModal(false)} />}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Oh Hell Tracker</title>
      </head>
      <body className="bg-[#0a0f0a] text-white">
        <AdminProvider>
          <div className="min-h-screen flex flex-col max-w-[430px] mx-auto">
            <main className="flex-1 overflow-y-auto pb-20">{children}</main>
            <BottomNav />
          </div>
        </AdminProvider>
      </body>
    </html>
  );
}
