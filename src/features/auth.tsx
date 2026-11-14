import { useEffect, useState } from "react";
import { Wallet, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ThemeControl } from "./theme";
import { UpdateControl } from "./updates";
export function Auth({
  resetMode = false,
  onRecovered,
}: {
  resetMode?: boolean;
  onRecovered?: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [setupComplete, setSetupComplete] = useState<boolean | null>(null),
    [setupError, setSetupError] = useState(false),
    [recovery, setRecovery] = useState(false),
    [visible, setVisible] = useState(false);
  async function loadSetup() {
    setSetupError(false);
    try {
      const { data, error } = await supabase!.rpc(
        "administrator_setup_complete",
      );
      if (error) throw error;
      setSetupComplete(data);
      if (data) setSetup(false);
    } catch {
      setSetupError(true);
    }
  }
  useEffect(() => {
    void loadSetup();
  }, []);
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img className="brand-icon" src="/brand.svg" alt="" />
        Badminton Ledger
        <ThemeControl compact />
      </div>
      <section className="auth-card">
        <span className="auth-symbol">
          <Wallet size={28} />
        </span>
        <div className="eyebrow">LESS BOOKKEEPING. MORE BADMINTON.</div>
        <h1>
          {resetMode
            ? "Choose a new password."
            : setup
              ? "Set up your ledger."
              : recovery
                ? "Reset your password."
                : "Welcome back."}
        </h1>
        <p>Your club’s finances, in one clear view.</p>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setMessage("");
            const f = new FormData(e.currentTarget);
            try {
              const email = String(f.get("email")),
                password = String(f.get("password"));
              const result = resetMode
                ? await supabase!.auth.updateUser({ password })
                : recovery
                  ? await supabase!.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin,
                    })
                  : setup
                    ? await supabase!.auth.signUp({
                        email,
                        password,
                        options: { emailRedirectTo: window.location.origin },
                      })
                    : await supabase!.auth.signInWithPassword({
                        email,
                        password,
                      });
              if (result.error) throw result.error;
              if (setup) {
                setSetupComplete(true);
                setSetup(false);
                setMessage(
                  "Check your email to confirm your administrator account, then sign in.",
                );
              }
              if (recovery)
                setMessage("Check your email for the recovery link.");
              if (resetMode) {
                setMessage("Password updated.");
                onRecovered?.();
              }
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e.message
                  : "Could not complete the request. Try again.",
              );
              if (setup) void loadSetup();
            } finally {
              setBusy(false);
            }
          }}
        >
          {!resetMode && (
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                defaultValue="khalids8774@gmail.com"
                readOnly={setup}
              />
            </label>
          )}
          {(!recovery || resetMode) && (
            <label htmlFor="auth-password">
              {resetMode || setup ? "New password" : "Password"}
              <div className="password-field">
                <input
                  id="auth-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={
                    resetMode || setup ? "new-password" : "current-password"
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}
          {message && (
            <div className="info-box" role="status">
              {message}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : resetMode
                ? "Save new password"
                : setup
                  ? "Create administrator account"
                  : recovery
                    ? "Send recovery email"
                    : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!resetMode && (
          <>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRecovery(!recovery);
                setSetup(false);
                setVisible(false);
              }}
            >
              {recovery ? "Back to sign in" : "Forgot password?"}
            </button>
            {setupComplete === false && (
              <button
                className="text-button setup-button"
                disabled={busy}
                onClick={() => {
                  setSetup(!setup);
                  setRecovery(false);
                  setVisible(false);
                }}
              >
                {setup
                  ? "Already set up? Sign in"
                  : "First time? Set up administrator account"}
              </button>
            )}
            {setupError && (
              <button className="text-button" onClick={() => void loadSetup()}>
                Retry setup status
              </button>
            )}
          </>
        )}
        <div className="auth-updates">
          <UpdateControl />
        </div>
        <p className="form-hint">
          Private administrator access. Members don’t need an account.
        </p>
      </section>
      <span className="auth-footer">
        <ShieldCheck size={15} />
        Your club. Your records.
      </span>
    </div>
  );
}
