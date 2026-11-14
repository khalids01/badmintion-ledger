import { useState } from "react";
import { Wallet, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
export function Auth({
  onPreview,
  resetMode = false,
  onRecovered,
}: {
  onPreview: () => void;
  resetMode?: boolean;
  onRecovered?: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [recovery, setRecovery] = useState(false),
    [reset, setReset] = useState(resetMode);
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img className="brand-icon" src="/brand.svg" alt=""/>Badminton Ledger
      </div>
      <section className="auth-card">
        <span className="auth-symbol">
          <Wallet size={28} />
        </span>
        <div className="eyebrow">LESS BOOKKEEPING. MORE BADMINTON.</div>
        <h1>
          {reset
            ? "A fresh start."
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
            setBusy(true);
            setMessage("");
            const f = new FormData(e.currentTarget);
            try {
              const result = reset
                ? await supabase!.auth.updateUser({
                    password: String(f.get("password")),
                  })
                : recovery
                  ? await supabase!.auth.resetPasswordForEmail(
                      String(f.get("email")),
                      { redirectTo: window.location.origin },
                    )
                  : setup
                    ? await supabase!.auth.signUp({
                        email: String(f.get("email")),
                        password: String(f.get("password")),
                        options: { emailRedirectTo: window.location.origin },
                      })
                    : await supabase!.auth.signInWithPassword({
                        email: String(f.get("email")),
                        password: String(f.get("password")),
                      });
              if (result.error) throw result.error;
              if (setup)
                setMessage(
                  "Check your email to confirm your administrator account, then sign in.",
                );
              if (recovery)
                setMessage("Check your email for the recovery link.");
              if (reset) {
                setReset(false);
                setMessage("Password updated.");
                onRecovered?.();
              }
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!reset && (
            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                defaultValue="khalids8774@gmail.com"
                readOnly={setup}
                placeholder="you@example.com"
              />
            </label>
          )}
          {(!recovery || reset) && (
            <label>
              {reset || setup ? "New password" : "Password"}
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete={
                  reset || setup ? "new-password" : "current-password"
                }
                placeholder="Your password"
              />
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
              : reset
                ? "Save new password"
                : setup
                  ? "Create administrator account"
                  : recovery
                    ? "Send recovery email"
                    : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRecovery(!recovery);
            setSetup(false);
          }}
        >
          {recovery ? "Back to sign in" : "Forgot password?"}
        </button>
        <button
          className="text-button setup-button"
          onClick={() => {
            setSetup(!setup);
            setRecovery(false);
          }}
        >
          {setup
            ? "Already set up? Sign in"
            : "First time? Set up administrator account"}
        </button>
        <div className="auth-divider">JUST LOOKING AROUND?</div>
        <button className="button secondary" onClick={onPreview}>
          Explore the sample ledger
          <ArrowUpRight size={16} />
        </button>
        <p className="form-hint">
          Private administrator access. Members don’t need an account.
        </p>
      </section>
      <span className="auth-footer">
        <ShieldCheck size={15} /> Your club. Your records. Your peace of mind.
      </span>
    </div>
  );
}
