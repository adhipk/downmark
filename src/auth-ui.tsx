import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

interface AuthUIProps {
  onAuthenticated: (username: string) => void;
}

export function AuthUI({ onAuthenticated }: AuthUIProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleRegister = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start registration
      const optionsResponse = await fetch("/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        const data = await optionsResponse.json();
        throw new Error(data.error || "Registration failed");
      }

      const options = await optionsResponse.json();

      // Trigger passkey creation
      const registrationResponse = await startRegistration(options);

      // Finish registration
      const verifyResponse = await fetch("/auth/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, response: registrationResponse }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.error || "Registration verification failed");
      }

      const result = await verifyResponse.json();
      onAuthenticated(result.username);
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Start authentication
      const optionsResponse = await fetch("/auth/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!optionsResponse.ok) {
        const data = await optionsResponse.json();
        throw new Error(data.error || "Login failed");
      }

      const options = await optionsResponse.json();

      // Trigger passkey authentication
      const authResponse = await startAuthentication(options);

      // Finish authentication
      const verifyResponse = await fetch("/auth/login/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, response: authResponse }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.error || "Login verification failed");
      }

      const result = await verifyResponse.json();
      onAuthenticated(result.username);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Downmark</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Sign in with your passkey" : "Create a new account"}
        </p>

        <div className="auth-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                mode === "login" ? handleLogin() : handleRegister();
              }
            }}
            disabled={loading}
            className="auth-input"
          />

          {error && <div className="auth-error">{error}</div>}

          <button
            onClick={mode === "login" ? handleLogin : handleRegister}
            disabled={loading}
            className="auth-button"
          >
            {loading
              ? "Loading..."
              : mode === "login"
              ? "Sign In with Passkey"
              : "Create Passkey"}
          </button>

          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            disabled={loading}
            className="auth-toggle"
          >
            {mode === "login"
              ? "Don't have an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="auth-info">
          <p>
            🔐 This app uses passkeys for secure, passwordless authentication.
            Your device will prompt you to use your fingerprint, face, or PIN.
          </p>
        </div>
      </div>
    </div>
  );
}
