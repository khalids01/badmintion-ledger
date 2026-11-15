import { LanguageControl } from "./language";
import { t } from "../lib/i18n";
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
    [signup, setSignup] = useState(false),
    [signupEnabled, setSignupEnabled] = useState(false),
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
      const registration = await supabase!.rpc("signup_enabled");
      setSignupEnabled(!registration.error && registration.data === true);
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
        <LanguageControl compact />
        <ThemeControl compact />
      </div>
      <section className="auth-card">
        <span className="auth-symbol">
          <Wallet size={28} />
        </span>
        <div className="eyebrow">{t("LESS BOOKKEEPING. MORE BADMINTON.")}</div>
        <h1>
          {resetMode
            ? t("Choose a new password.")
            : signup
              ? t("Join your club.")
              : setup
                ? t("Set up your ledger.")
                : recovery
                  ? t("Reset your password.")
                  : t("Welcome back.")}
        </h1>
        <p>{t("Your club’s finances, in one clear view.")}</p>
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
                  : setup || signup
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
              if (signup) {
                setSignup(false);
                setMessage(
                  "Check your email to confirm your account, then sign in. Club access requires administrator approval.",
                );
              }
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
                  : t("Could not complete the request. Try again."),
              );
              if (setup) void loadSetup();
            } finally {
              setBusy(false);
            }
          }}
        >
          {!resetMode && (
            <label>
              {t("Email address")}
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                defaultValue={setup ? "khalids8774@gmail.com" : ""}
                key={setup ? "setup" : signup ? "signup" : "signin"}
                readOnly={setup}
              />
            </label>
          )}
          {(!recovery || resetMode) && (
            <label htmlFor="auth-password">
              {resetMode || setup || signup ? t("New password") : t("Password")}
              <div className="password-field">
                <input
                  id="auth-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={
                    resetMode || setup || signup
                      ? "new-password"
                      : "current-password"
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? t("Hide password") : t("Show password")}
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
              {t(message)}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy
              ? t("Please wait…")
              : resetMode
                ? t("Save new password")
                : signup
                  ? t("Create account")
                  : setup
                    ? t("Create administrator account")
                    : recovery
                      ? t("Send recovery email")
                      : t("Sign in")}
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
                setSignup(false);
                setVisible(false);
              }}
            >
              {recovery ? t("Back to sign in") : t("Forgot password?")}
            </button>
            {signupEnabled && setupComplete === true && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setSignup(!signup);
                  setSetup(false);
                  setRecovery(false);
                  setVisible(false);
                  setMessage("");
                }}
              >
                {signup ? t("Back to sign in") : t("Create an account")}
              </button>
            )}
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
                  ? t("Already set up? Sign in")
                  : t("First time? Set up administrator account")}
              </button>
            )}
            {setupError && (
              <button className="text-button" onClick={() => void loadSetup()}>
                {t("Retry setup status")}
              </button>
            )}
          </>
        )}
        <div className="auth-updates">
          <UpdateControl />
        </div>
        <p className="form-hint">
          {t("New accounts need administrator approval to access the club.")}
        </p>
      </section>
      <span className="auth-footer">
        <ShieldCheck size={15} />
        {t("Your club. Your records.")}
      </span>
    </div>
  );
}
