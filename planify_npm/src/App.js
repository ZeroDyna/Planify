import { useState, useEffect } from "react";

export default function LoginApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showAccountConfirmed, setShowAccountConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState("balance");

  const SUPABASE_URL = "https://sopeknspwpauugvarnvw.supabase.co";
  const SUPABASE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcGVrbnNwd3BhdXVndmFybnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjE2ODksImV4cCI6MjA3NTMzNzY4OX0.Pay7ePl_elXtwHVHBvL-loqf0WC-47l_uDurKkGKwR8";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const confirmed = params.get("confirmed");
    const hash = window.location.hash;

    if (
      type === "signup" ||
      confirmed === "true" ||
      hash.includes("type=signup")
    ) {
      setShowAccountConfirmed(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (isSignUp) {
      if (password !== confirmPassword) {
        setMessage("Las contraseñas no coinciden");
        setLoading(false);
        return;
      }
      if (username.trim().length < 3) {
        setMessage("El nombre de usuario debe tener al menos 3 caracteres");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setMessage("La contraseña debe tener al menos 6 caracteres");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isSignUp ? "signup" : "token?grant_type=password";
      const url = `${SUPABASE_URL}/auth/v1/${endpoint}`;

      const body = isSignUp
        ? {
            email,
            password,
            options: {
              data: {
                username: username,
              },
            },
          }
        : { email, password };

      console.log("Enviando body:", JSON.stringify(body, null, 2));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      console.log("Respuesta de Supabase:", data);

      if (response.ok) {
        if (isSignUp) {
          setShowEmailConfirmation(true);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setUsername("");
        } else {
          setUser(data.user);
          setMessage("¡Inicio de sesión exitoso!");
          setEmail("");
          setPassword("");
        }
      } else {
        setMessage(
          data.error_description || data.msg || "Error en la autenticación"
        );
      }
    } catch (error) {
      setMessage("Error de conexión. Verifica tu configuración de Supabase.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMessage("Sesión cerrada");
    setActiveTab("balance");
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setShowEmailConfirmation(false);
  };

  const handleBackToLogin = () => {
    setShowEmailConfirmation(false);
    setShowAccountConfirmed(false);
    setIsSignUp(false);
    setMessage("");
  };

  // Componente de ícono de verificación con emoji
  const SuccessIcon = () => (
    <div className="success-icon-container">
      <span style={{ fontSize: "3rem" }}>✅</span>
    </div>
  );

  // Componente de ícono de email con emoji
  const MailIcon = () => (
    <div className="success-icon-container">
      <span style={{ fontSize: "3rem" }}>✉️</span>
    </div>
  );

  if (showAccountConfirmed) {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            <SuccessIcon />
            <h2 className="welcome-title">¡Cuenta creada exitosamente!</h2>
            <p className="user-email" style={{ marginBottom: "1.5rem" }}>
              Tu correo ha sido verificado correctamente. Ya puedes iniciar
              sesión con tu cuenta.
            </p>
            <button onClick={handleBackToLogin} className="btn btn-primary">
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showEmailConfirmation) {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            <MailIcon />
            <h2 className="welcome-title">¡Verifica tu correo!</h2>
            <p className="user-email" style={{ marginBottom: "1rem" }}>
              Hemos enviado un enlace de verificación a tu correo electrónico.
            </p>
            <p className="subtitle" style={{ marginBottom: "1.5rem" }}>
              Por favor, haz clic en el enlace del correo para confirmar tu
              registro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    const displayName = user.user_metadata?.username || user.email;

    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="logo">📋 Planify</div>
          <button onClick={handleLogout} className="btn-logout">
            Cerrar Sesión
          </button>
        </div>

        <div className="tabs-container">
          <button
            className={`tab ${activeTab === "balance" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("balance")}
          >
            BALANCE
          </button>
          <button
            className={`tab ${activeTab === "dailyinput" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("dailyinput")}
          >
            DAILY INPUT
          </button>

          <button
            className={`tab ${activeTab === "goals" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("goals")}
          >
            GOALS
          </button>
          <button
            className={`tab ${activeTab === "config" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            CONCEPTOS
          </button>
          <button
            className={`tab ${activeTab === "account" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("account")}
          >
            ACCOUNT
          </button>
        </div>

        <div className="dashboard-content">
          {activeTab === "balance" && (
            <div className="text-center" style={{ padding: "2rem" }}>
              <p>Próximamente: Balance</p>
            </div>
          )}

          {activeTab === "dailyinput" && (
            <div className="text-center" style={{ padding: "2rem" }}>
              <p>Próximamente: Daily Input</p>
            </div>
          )}

          {activeTab === "goals" && (
            <div className="text-center" style={{ padding: "2rem" }}>
              <p>Próximamente: Goals</p>
            </div>
          )}

          {activeTab === "config" && (
            <div className="text-center" style={{ padding: "2rem" }}>
              <p>Próximamente: Conceptos</p>
            </div>
          )}

          {activeTab === "account" && (
            <div className="text-center" style={{ padding: "2rem" }}>
              <p>Cuenta: {displayName}</p>
              <p>Email: {user.email}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="login-card">
        <div className="header-section text-center">
          <div className="logo">📋 Planify</div>
          <h1 className="title">
            {isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}
          </h1>
          <p className="subtitle">
            {isSignUp ? "Regístrate para comenzar" : "Bienvenido de nuevo"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="form-section">
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Nombre de Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="nombre de usuario"
                required
                minLength={3}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Confirmar Contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          {message && (
            <div
              className={`message ${
                message.includes("exitoso") || message.includes("creada")
                  ? "message-success"
                  : "message-error"
              }`}
            >
              {message}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading
              ? "Procesando..."
              : isSignUp
              ? "Crear Cuenta"
              : "Iniciar Sesión"}
          </button>
        </form>

        <div className="toggle-section">
          <button onClick={handleToggleMode} className="btn-link">
            {isSignUp
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿No tienes cuenta? Regístrate"}
          </button>
        </div>
      </div>
    </div>
  );
}
