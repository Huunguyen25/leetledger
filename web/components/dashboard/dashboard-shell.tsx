"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DashboardProvider,
  useDashboard,
} from "./dashboard-provider";
import { Icon, type IconName } from "./icons";
import { ProblemDrawer } from "./ui";

const navigation: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Overview", href: "/", icon: "overview" },
  { label: "Problems", href: "/problems", icon: "problems" },
  { label: "Reviews", href: "/reviews", icon: "reviews" },
  { label: "History", href: "/history", icon: "history" },
  { label: "Insights", href: "/insights", icon: "insights" },
  { label: "Profiles", href: "/profiles", icon: "profiles" },
];

function ShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [online, setOnline] = useState(true);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpPassword, setOtpPassword] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [authFlow, setAuthFlow] = useState<"sign-in" | "sign-up">("sign-in");
  const [otpSent, setOtpSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const {
    authConfigured,
    sessionEmail,
    dataStatus,
    dataError,
    requestSignInOtp,
    requestSignUpOtp,
    verifyOtp,
    signOut,
  } = useDashboard();
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const title =
    navigation.find(({ href }) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href),
    )?.label ?? "Overview";

  useEffect(() => {
    const savedCollapsed =
      window.localStorage.getItem("leetledger-sidebar") === "collapsed";
    const savedTheme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(savedCollapsed);
      setTheme(savedTheme);
      setOnline(window.navigator.onLine);
    });
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = "hidden";
    const firstLink = sidebar.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab" || !sidebar.current) return;
      const items = sidebar.current.querySelectorAll<HTMLElement>(
        "a, button:not([disabled])",
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        accountOpen &&
        account.current &&
        !account.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [accountOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement?.tagName ?? "").toUpperCase(),
        )
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".global-search input")
          ?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      window.localStorage.setItem(
        "leetledger-sidebar",
        value ? "expanded" : "collapsed",
      );
      return !value;
    });
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("leetledger-theme", next);
    setTheme(next);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get("q") ?? "").trim();
    router.push(query ? `/problems?q=${encodeURIComponent(query)}` : "/problems");
  }

  async function onAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      if (!otpSent) {
        if (authFlow === "sign-in") {
          await requestSignInOtp(otpEmail.trim(), otpPassword);
        } else {
          await requestSignUpOtp(otpEmail.trim(), otpPassword);
        }
        setOtpSent(true);
        setAuthMessage("Check your email for the six-digit code.");
      } else {
        await verifyOtp(
          otpEmail.trim(),
          otpToken.trim(),
          authFlow === "sign-up" ? "signup" : "email",
        );
        setOtpToken("");
        setOtpSent(false);
        setOtpPassword("");
        setAccountOpen(false);
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function onSignOut() {
    setAuthBusy(true);
    try {
      await signOut();
      setAccountOpen(false);
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className={`dashboard-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar${mobileOpen ? " mobile-open" : ""}`}
        aria-label="Primary navigation"
      >
        <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            LL
          </span>
          <span className="brand-name">LeetLedger</span>
        </Link>
        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
                <span className="nav-tooltip" role="tooltip">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <footer className="sidebar-footer">
          <button
            type="button"
            className="collapse-button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "expand" : "collapse"} size={18} />
            <span className="sidebar-footer-copy">Collapse sidebar</span>
          </button>
          <span className="sidebar-footer-copy">
            {dataStatus === "live"
              ? "Synced with Supabase"
              : dataStatus === "cache"
                ? "Cached data · refreshing"
                : dataStatus === "checking"
                  ? "Connecting to Supabase…"
                  : dataStatus === "signed-out"
                    ? "Sign in to load reviews"
                    : "Supabase unavailable"}
          </span>
        </footer>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Icon name="menu" />
          </button>
          <span className="topbar-title">{title}</span>
          <form className="global-search" role="search" onSubmit={onSearch}>
            <label>
              <span className="sr-only">Search tracked problems</span>
              <Icon name="search" size={17} />
              <input
                name="q"
                type="search"
                placeholder="Search problems…"
                autoComplete="off"
              />
              <kbd>/</kbd>
            </label>
          </form>
          <button
            type="button"
            className="icon-button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <div className="account-wrap" ref={account}>
            <button
              type="button"
              className="account-button"
              aria-label="Open account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((value) => !value)}
            >
              {sessionEmail?.slice(0, 1).toUpperCase() ?? "S"}
            </button>
            {accountOpen && (
              <div className="account-menu" role="menu">
                {sessionEmail ? (
                  <>
                    <div>
                      <strong>{sessionEmail}</strong>
                      <span>
                        {dataStatus === "live"
                          ? "Reviews synced"
                          : dataStatus === "cache"
                            ? "Showing cached reviews"
                            : "Could not load reviews"}
                      </span>
                    </div>
                    <Link
                      href="/profiles"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      Profile settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={authBusy}
                      onClick={() => void onSignOut()}
                    >
                      Sign out
                    </button>
                  </>
                ) : authConfigured ? (
                  <form className="account-auth" onSubmit={onAuthSubmit}>
                    <div>
                      <strong>Sign in to sync</strong>
                      <span>Use email, password, then OTP verification.</span>
                    </div>
                    <label>
                      <span>Action</span>
                      <select
                        value={authFlow}
                        disabled={otpSent || authBusy}
                        onChange={(event) =>
                          setAuthFlow(event.target.value as "sign-in" | "sign-up")
                        }
                      >
                        <option value="sign-in">Sign in</option>
                        <option value="sign-up">Create account</option>
                      </select>
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={otpEmail}
                        disabled={otpSent || authBusy}
                        onChange={(event) => setOtpEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Password</span>
                      <input
                        type="password"
                        required
                        autoComplete={
                          authFlow === "sign-up" ? "new-password" : "current-password"
                        }
                        value={otpPassword}
                        disabled={otpSent || authBusy}
                        onChange={(event) => setOtpPassword(event.target.value)}
                      />
                    </label>
                    {otpSent && (
                      <label>
                        <span>Six-digit code</span>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={otpToken}
                          disabled={authBusy}
                          onChange={(event) => setOtpToken(event.target.value)}
                        />
                      </label>
                    )}
                    {(authMessage || dataError) && (
                      <p role="status">{authMessage ?? dataError}</p>
                    )}
                    <button
                      type="submit"
                      className="button primary"
                      disabled={authBusy}
                    >
                      {authBusy
                        ? "Working…"
                        : otpSent
                          ? "Verify code"
                          : authFlow === "sign-up"
                            ? "Create + send code"
                            : "Sign in + send code"}
                    </button>
                    {otpSent && (
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpToken("");
                          setAuthMessage(null);
                        }}
                      >
                        Use different credentials
                      </button>
                    )}
                  </form>
                ) : (
                  <div>
                    <strong>Supabase is not configured</strong>
                    <span>
                      Add NEXT_PUBLIC_SUPABASE_URL and a publishable key to
                      enable account sync.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="route-host">{children}</main>
      </div>
      {!online && (
        <div className="offline-banner" role="status">
          Offline — showing available cached data
        </div>
      )}
      <ProblemDrawer />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <ShellContent>{children}</ShellContent>
    </DashboardProvider>
  );
}
