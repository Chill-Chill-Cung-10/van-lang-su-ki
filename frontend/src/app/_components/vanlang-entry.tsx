"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import VanlangGameShell from "./vanlang-game-shell";
import { VanlangPrologue } from "./vanlang-prologue";
import "./vanlang-entry.css";

type Account = {
  name: string;
  email: string;
  passwordHash: string;
};

type AuthMode = "login" | "register";
type EntryStage = "menu" | "prologue" | "game";

const ACCOUNTS_KEY = "vanlang-accounts-v1";
const SESSION_KEY = "vanlang-session-v1";
const GAME_PROGRESS_KEY = "vanlang-game-mock-v4";

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readAccounts(): Account[] {
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
  } catch {
    return [];
  }
}

function subscribeToSession(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("vanlang-session", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("vanlang-session", onStoreChange);
  };
}

const getSessionSnapshot = () => window.localStorage.getItem(SESSION_KEY) ?? "";
const getServerSessionSnapshot = () => "";

function DrumMotif({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="112" />
      <circle cx="120" cy="120" r="88" />
      <circle cx="120" cy="120" r="49" />
      <path d="m120 66 10 34 32-14-21 29 31 18-37-2-4 36-11-34-30 18 19-31-32-15 37-1 6-38Z" />
      <path d="M22 120h49M169 120h49M120 22v45M120 173v45M51 51l34 34M155 155l34 34M189 51l-34 34M85 155l-34 34" />
    </svg>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmation("");
  };

  const showError = (nextError: string) => {
    setError(nextError);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || (mode === "register" && !name.trim())) {
      showError("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      showError("Vui lòng nhập đúng định dạng email.");
      return;
    }
    if (password.length < 6) {
      showError("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }
    if (mode === "register" && password !== confirmation) {
      showError("Mật khẩu nhập lại chưa khớp.");
      return;
    }

    setBusy(true);
    const accounts = readAccounts();
    const existing = accounts.find((account) => account.email === normalizedEmail);
    const passwordHash = await hashPassword(password);

    if (mode === "register") {
      if (existing) {
        showError("Email này đã được đăng ký. Hãy chuyển sang đăng nhập.");
      } else {
        const account = { name: name.trim(), email: normalizedEmail, passwordHash };
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
        setMode("login");
        setPassword("");
        setConfirmation("");
        setMessage("Tạo tài khoản thành công. Bạn có thể đăng nhập ngay, không cần xác thực.");
      }
    } else if (!existing || existing.passwordHash !== passwordHash) {
      showError("Email hoặc mật khẩu chưa đúng.");
    } else {
      window.localStorage.setItem(SESSION_KEY, existing.email);
      onAuthenticated();
    }

    setBusy(false);
  };

  return (
    <main id="noi-dung-chinh" className="entry-scene auth-scene">
      <Image className="entry-backdrop" src="/vanlang-battlefield.png" alt="" fill priority sizes="100vw" />
      <div className="entry-overlay" aria-hidden="true" />
      <div className="mist mist-one" aria-hidden="true" />
      <div className="mist mist-two" aria-hidden="true" />

      <section className="auth-layout" aria-label="Đăng nhập Văn Lang Sử Ký">
        <div className="auth-intro">
          <DrumMotif className="auth-drum" />
          <p className="era-label">Dấu Ấn Đại Việt</p>
          <h1>Văn Lang<br />Sử Ký</h1>
          <p className="auth-tagline">Khởi hành về buổi đầu dựng nước, nơi ký ức của núi sông đang chờ được đánh thức.</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Tài khoản">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>Đăng nhập</button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")}>Đăng ký</button>
          </div>

          <div className="auth-heading">
            <p className="section-kicker">{mode === "login" ? "Chào mừng trở lại" : "Tạo hành trang mới"}</p>
            <h2>{mode === "login" ? "Tiếp tục hành trình" : "Đăng ký tài khoản"}</h2>
            <p>{mode === "login" ? "Đăng nhập để bước vào thế giới Văn Lang." : "Không email xác thực, không mã OTP. Đăng ký xong là có thể đăng nhập."}</p>
          </div>

          {error ? <div ref={errorRef} className="form-notice error" role="alert" tabIndex={-1}>{error}</div> : null}
          {message ? <div className="form-notice success" role="status">{message}</div> : null}

          <form onSubmit={submit} noValidate>
            {mode === "register" ? (
              <label>
                Tên hiển thị
                <input name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </label>
            ) : null}
            <label>
              Email
              <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
            </label>
            <label>
              Mật khẩu
              <input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required />
            </label>
            {mode === "register" ? (
              <label>
                Nhập lại mật khẩu
                <input name="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={6} required />
              </label>
            ) : null}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function MainMenu({ account, onStart, onContinue, onLogout }: { account: Account; onStart: () => void; onContinue: () => void; onLogout: () => void }) {
  const router = useRouter();
  const [hasSave] = useState(() => typeof window !== "undefined" && Boolean(window.localStorage.getItem(GAME_PROGRESS_KEY)));
  const [showOptions, setShowOptions] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const menuItems = useMemo(
    () => [
      ...(hasSave ? [{ label: "Tiếp tục", action: onContinue }] : []),
      { label: "Bắt đầu", action: onStart },
      { label: "Editor Mode", action: () => router.push("/admin/maps") },
      { label: "Lựa chọn", action: () => setShowOptions(true) },
    ],
    [hasSave, onContinue, onStart, router],
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showOptions) {
        if (event.key === "Escape") setShowOptions(false);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setSelected((current) => (current + direction + menuItems.length) % menuItems.length);
      }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        menuItems[selected]?.action();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuItems, selected, showOptions]);

  return (
    <main id="noi-dung-chinh" className="entry-scene menu-scene">
      <Image className="entry-backdrop" src="/vanlang-battlefield.png" alt="" fill priority sizes="100vw" />
      <div className="entry-overlay" aria-hidden="true" />
      <div className="mist mist-one" aria-hidden="true" />
      <div className="mist mist-two" aria-hidden="true" />
      <DrumMotif className="title-drum" />

      <header className="game-title">
        <p>Biên niên dựng nước</p>
        <h1>Văn Lang Sử Ký</h1>
        <span aria-hidden="true" />
      </header>

      <nav className="ceremonial-menu" aria-label="Menu chính">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={selected === index ? "selected" : ""}
            aria-current={selected === index ? "true" : undefined}
            onMouseEnter={() => setSelected(index)}
            onFocus={() => setSelected(index)}
            onClick={item.action}
          >
            <span aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="player-mark">
        <span>Người chơi</span>
        <strong>{account.name}</strong>
        <button type="button" onClick={onLogout}>Đăng xuất</button>
      </div>

      <p className="menu-hint">Dùng ↑ ↓ để lựa chọn · Enter để xác nhận</p>

      {showOptions ? (
        <div className="options-backdrop" role="presentation" onMouseDown={() => setShowOptions(false)}>
          <section className="options-panel" role="dialog" aria-modal="true" aria-labelledby="options-title" onMouseDown={(event) => event.stopPropagation()}>
            <p className="section-kicker">Thiết lập hành trình</p>
            <h2 id="options-title">Lựa chọn</h2>
            <button className="option-row" type="button" onClick={() => setSoundOn((current) => !current)}>
              <span>Âm thanh</span><strong>{soundOn ? "Bật" : "Tắt"}</strong>
            </button>
            <button className="options-close" type="button" onClick={() => setShowOptions(false)}>Đóng</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function VanlangEntry() {
  const sessionEmail = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSessionSnapshot);
  const account = useMemo(
    () => sessionEmail ? readAccounts().find((item) => item.email === sessionEmail) ?? null : null,
    [sessionEmail],
  );
  const [stage, setStage] = useState<EntryStage>("menu");
  const [gameInitialScreen, setGameInitialScreen] = useState<"map" | undefined>();

  if (stage === "game") {
    return <VanlangGameShell accountId={account?.email ?? sessionEmail} initialScreen={gameInitialScreen} onBackToMenu={() => setStage("menu")} />;
  }
  if (!account) {
    return <AuthScreen onAuthenticated={() => { setStage("menu"); window.dispatchEvent(new Event("vanlang-session")); }} />;
  }
  if (stage === "prologue") {
    return (
      <VanlangPrologue
        onComplete={() => {
          window.localStorage.setItem(`vanlang-prologue-seen:${account.email}`, "true");
          setGameInitialScreen("map");
          setStage("game");
        }}
      />
    );
  }

  return (
    <MainMenu
      account={account}
      onStart={() => {
        const hasSeenPrologue = window.localStorage.getItem(`vanlang-prologue-seen:${account.email}`) === "true";
        setGameInitialScreen(undefined);
        setStage(hasSeenPrologue ? "game" : "prologue");
      }}
      onContinue={() => { setGameInitialScreen(undefined); setStage("game"); }}
      onLogout={() => { window.localStorage.removeItem(SESSION_KEY); setStage("menu"); window.dispatchEvent(new Event("vanlang-session")); }}
    />
  );
}
