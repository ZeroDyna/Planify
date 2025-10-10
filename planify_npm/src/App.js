import { Component } from "react";

export default class LoginApp extends Component {
  constructor(props) {
    super(props);

    this.state = {
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
      isSignUp: false,
      message: "",
      loading: false,
      user: null,
      showEmailConfirmation: false,
      showAccountConfirmed: false,
      activeTab: "balance",
      showForgotPassword: false,
      showOtpVerification: false,
      showResetPassword: false,
      showPasswordResetSuccess: false,
      otpCode: "",
      recoveryEmail: "",
      newPassword: "",
      confirmNewPassword: "",
      accessToken: null,
    };

    this.SUPABASE_URL = "https://sopeknspwpauugvarnvw.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcGVrbnNwd3BhdXVndmFybnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjE2ODksImV4cCI6MjA3NTMzNzY4OX0.Pay7ePl_elXtwHVHBvL-loqf0WC-47l_uDurKkGKwR8";
  }

  componentDidMount() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const confirmed = params.get("confirmed");
    const hash = window.location.hash;

    if (
      type === "signup" ||
      confirmed === "true" ||
      hash.includes("type=signup")
    ) {
      this.setState({ showAccountConfirmed: true });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  handleAuth = async () => {
    this.setState({ loading: true, message: "" });
    const { isSignUp, password, confirmPassword, username, email } = this.state;

    if (isSignUp) {
      if (password !== confirmPassword) {
        this.setState({
          message: "Las contraseñas no coinciden",
          loading: false,
        });
        return;
      }
      if (username.trim().length < 4) {
        this.setState({
          message: "El nombre de usuario debe tener al menos 4 caracteres",
          loading: false,
        });
        return;
      }
      if (password.length < 6) {
        this.setState({
          message: "La contraseña debe tener al menos 6 caracteres",
          loading: false,
        });
        return;
      }
    }

    try {
      const endpoint = isSignUp ? "signup" : "token?grant_type=password";
      const url = `${this.SUPABASE_URL}/auth/v1/${endpoint}`;
      const body = isSignUp
        ? { email, password, options: { data: { username } } }
        : { email, password };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (isSignUp) {
          this.setState({
            showEmailConfirmation: true,
            email: "",
            password: "",
            confirmPassword: "",
            username: "",
          });
        } else {
          this.setState({
            user: data.user,
            message: "¡Inicio de sesión exitoso!",
            email: "",
            password: "",
          });
        }
      } else {
        if (
          isSignUp &&
          (data.msg === "User already registered" ||
            data.error_description?.includes("already registered") ||
            data.message?.includes("already registered"))
        ) {
          this.setState({
            message:
              "Este correo electrónico ya está registrado. Por favor, inicia sesión.",
          });
        } else {
          this.setState({
            message:
              data.error_description || data.msg || "Error en la autenticación",
          });
        }
      }
    } catch (error) {
      this.setState({
        message: "Error de conexión. Verifica tu configuración de Supabase.",
      });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleForgotPassword = async () => {
    this.setState({ loading: true, message: "" });
    const { recoveryEmail } = this.state;

    if (!recoveryEmail || !recoveryEmail.includes("@")) {
      this.setState({
        message: "Por favor, ingresa un correo electrónico válido.",
        loading: false,
      });
      return;
    }

    try {
      // Verificamos si el email existe usando nuestra Edge Function
      const checkEmailUrl = `${this.SUPABASE_URL}/functions/v1/check-email-exists`;
      const checkResponse = await fetch(checkEmailUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${this.SUPABASE_KEY}`,
        },
        body: JSON.stringify({ email: recoveryEmail }),
      });

      const checkData = await checkResponse.json();

      if (!checkData.exists) {
        this.setState({
          message:
            "Este correo electrónico no está registrado en nuestro sistema.",
          loading: false,
        });
        return;
      }

      // Si el email existe, procedemos a enviar el código OTP de recuperación
      const recoverUrl = `${this.SUPABASE_URL}/auth/v1/recover`;
      const recoverResponse = await fetch(recoverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: recoveryEmail,
        }),
      });

      if (recoverResponse.ok) {
        this.setState({
          showForgotPassword: false,
          showOtpVerification: true,
          message: "",
        });
      } else {
        this.setState({
          message: "Error al enviar el código. Inténtalo de nuevo.",
        });
      }
    } catch (error) {
      console.error("Error en forgot password:", error);
      this.setState({ message: "Error de conexión. Inténtalo de nuevo." });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleVerifyOtp = async () => {
    this.setState({ loading: true, message: "" });
    const { recoveryEmail, otpCode } = this.state;

    try {
      const url = `${this.SUPABASE_URL}/auth/v1/verify`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: recoveryEmail,
          token: otpCode,
          type: "recovery",
        }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        this.setState({
          showOtpVerification: false,
          showResetPassword: true,
          message: "",
          accessToken: data.access_token,
        });
      } else {
        this.setState({
          message:
            "El código ingresado es incorrecto. Por favor, verifica e intenta de nuevo.",
        });
      }
    } catch (error) {
      this.setState({
        message: "Error al verificar el código. Inténtalo de nuevo.",
      });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleResetPassword = async () => {
    this.setState({ loading: true, message: "" });
    const { newPassword, confirmNewPassword, accessToken } = this.state;

    if (newPassword !== confirmNewPassword) {
      this.setState({
        message: "Las contraseñas no coinciden",
        loading: false,
      });
      return;
    }

    if (newPassword.length < 6) {
      this.setState({
        message: "La contraseña debe tener al menos 6 caracteres",
        loading: false,
      });
      return;
    }

    try {
      const url = `${this.SUPABASE_URL}/auth/v1/user`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (response.ok) {
        this.setState({
          showResetPassword: false,
          showPasswordResetSuccess: true,
          newPassword: "",
          confirmNewPassword: "",
          otpCode: "",
          recoveryEmail: "",
          accessToken: null,
        });
      } else {
        this.setState({
          message:
            "Error al cambiar la contraseña. El código puede haber expirado.",
        });
      }
    } catch (error) {
      this.setState({
        message: "Error al cambiar la contraseña. Inténtalo de nuevo.",
      });
    } finally {
      this.setState({ loading: false });
    }
  };

  handleLogout = () => {
    this.setState({
      user: null,
      message: "Sesión cerrada",
      activeTab: "balance",
    });
  };

  handleToggleMode = () => {
    this.setState((prevState) => ({
      isSignUp: !prevState.isSignUp,
      message: "",
      password: "",
      confirmPassword: "",
      username: "",
      showEmailConfirmation: false,
    }));
  };

  handleBackToLogin = () => {
    this.setState({
      showEmailConfirmation: false,
      showAccountConfirmed: false,
      showForgotPassword: false,
      showOtpVerification: false,
      showResetPassword: false,
      showPasswordResetSuccess: false,
      isSignUp: false,
      message: "",
      recoveryEmail: "",
      otpCode: "",
      newPassword: "",
      confirmNewPassword: "",
      accessToken: null,
    });
  };

  handleGoToForgotPassword = () => {
    this.setState({ showForgotPassword: true, message: "" });
  };

  renderIcon(emoji) {
    return (
      <div className="success-icon-container">
        <span style={{ fontSize: "3rem" }}>{emoji}</span>
      </div>
    );
  }

  renderAccountConfirmed() {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            {this.renderIcon("✅")}
            <h2 className="welcome-title">¡Cuenta creada exitosamente!</h2>
            <p className="user-email" style={{ marginBottom: "1.5rem" }}>
              Tu correo ha sido verificado correctamente. Ya puedes iniciar
              sesión con tu cuenta.
            </p>
            <button
              onClick={this.handleBackToLogin}
              className="btn btn-primary"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderEmailConfirmation() {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            {this.renderIcon("✉️")}
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

  renderForgotPassword() {
    const { recoveryEmail, message, loading } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("🔒")}
            <h1 className="title">Recuperar Contraseña</h1>
            <p className="subtitle">
              Ingresa tu correo electrónico para recibir un código de
              recuperación
            </p>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) =>
                  this.setState({ recoveryEmail: e.target.value })
                }
                className="form-input"
                placeholder="tu@email.com"
              />
            </div>

            {message && <div className="message message-error">{message}</div>}

            <button
              onClick={this.handleForgotPassword}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </div>

          <div className="toggle-section">
            <button onClick={this.handleBackToLogin} className="btn-link">
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderOtpVerification() {
    const { otpCode, message, loading, recoveryEmail } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("✉️")}
            <h1 className="title">Verificar Código</h1>
            <p className="subtitle">Hemos enviado un código de 6 dígitos a</p>
            <p className="user-email" style={{ marginBottom: "1rem" }}>
              {recoveryEmail}
            </p>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Código de Verificación</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => this.setState({ otpCode: e.target.value })}
                className="form-input"
                placeholder="000000"
                maxLength={6}
                style={{
                  textAlign: "center",
                  fontSize: "1.5rem",
                  letterSpacing: "0.5rem",
                }}
              />
            </div>

            {message && <div className="message message-error">{message}</div>}

            <button
              onClick={this.handleVerifyOtp}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Verificando..." : "Verificar código"}
            </button>
          </div>

          <div className="toggle-section">
            <button onClick={this.handleBackToLogin} className="btn-link">
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderResetPassword() {
    const { newPassword, confirmNewPassword, message, loading } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("🔑")}
            <h1 className="title">Nueva Contraseña</h1>
            <p className="subtitle">Ingresa tu nueva contraseña</p>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Nueva Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => this.setState({ newPassword: e.target.value })}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) =>
                  this.setState({ confirmNewPassword: e.target.value })
                }
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            {message && <div className="message message-error">{message}</div>}

            <button
              onClick={this.handleResetPassword}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </div>

          <div className="toggle-section">
            <button onClick={this.handleBackToLogin} className="btn-link">
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderPasswordResetSuccess() {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            {this.renderIcon("✅")}
            <h2 className="welcome-title">
              ¡Contraseña cambiada exitosamente!
            </h2>
            <p className="user-email" style={{ marginBottom: "1.5rem" }}>
              Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar
              sesión con tu nueva contraseña.
            </p>
            <button
              onClick={this.handleBackToLogin}
              className="btn btn-primary"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderDashboard() {
    const { user, activeTab } = this.state;
    const displayName = user.user_metadata?.username || user.email;

    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="logo">📋 Planify</div>
          <button onClick={this.handleLogout} className="btn-logout">
            Cerrar Sesión
          </button>
        </div>

        <div className="tabs-container">
          <button
            className={`tab ${activeTab === "balance" ? "tab-active" : ""}`}
            onClick={() => this.setState({ activeTab: "balance" })}
          >
            BALANCE
          </button>
          <button
            className={`tab ${activeTab === "dailyinput" ? "tab-active" : ""}`}
            onClick={() => this.setState({ activeTab: "dailyinput" })}
          >
            DAILY INPUT
          </button>
          <button
            className={`tab ${activeTab === "goals" ? "tab-active" : ""}`}
            onClick={() => this.setState({ activeTab: "goals" })}
          >
            GOALS
          </button>
          <button
            className={`tab ${activeTab === "config" ? "tab-active" : ""}`}
            onClick={() => this.setState({ activeTab: "config" })}
          >
            CONCEPTOS
          </button>
          <button
            className={`tab ${activeTab === "account" ? "tab-active" : ""}`}
            onClick={() => this.setState({ activeTab: "account" })}
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

  renderLoginForm() {
    const {
      isSignUp,
      username,
      email,
      password,
      confirmPassword,
      message,
      loading,
    } = this.state;

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

          <div className="form-section">
            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Nombre de Usuario</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => this.setState({ username: e.target.value })}
                  className="form-input"
                  placeholder="nombre de usuario"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => this.setState({ email: e.target.value })}
                className="form-input"
                placeholder="tu@email.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => this.setState({ password: e.target.value })}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    this.setState({ confirmPassword: e.target.value })
                  }
                  className="form-input"
                  placeholder="••••••••"
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

            <button
              onClick={this.handleAuth}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading
                ? "Procesando..."
                : isSignUp
                ? "Crear Cuenta"
                : "Iniciar Sesión"}
            </button>
          </div>

          {!isSignUp && (
            <div className="forgot-password-section">
              <button
                onClick={this.handleGoToForgotPassword}
                className="btn-link"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <div className="toggle-section">
            <button onClick={this.handleToggleMode} className="btn-link">
              {isSignUp
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const {
      showAccountConfirmed,
      showEmailConfirmation,
      showForgotPassword,
      showOtpVerification,
      showResetPassword,
      showPasswordResetSuccess,
      user,
    } = this.state;

    if (showAccountConfirmed) return this.renderAccountConfirmed();
    if (showEmailConfirmation) return this.renderEmailConfirmation();
    if (showPasswordResetSuccess) return this.renderPasswordResetSuccess();
    if (showResetPassword) return this.renderResetPassword();
    if (showOtpVerification) return this.renderOtpVerification();
    if (showForgotPassword) return this.renderForgotPassword();
    if (user) return this.renderDashboard();
    return this.renderLoginForm();
  }
}
