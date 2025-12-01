import React, { Component } from "react";
import DailyInput from "./DailyInput"; // MK-009 Daily Input - componente para registrar ingresos/gastos diarios (FP-42..FP-50)
import Balance from "./Balance"; // MK-005 Balance - vista para consultar balances y generar reportes (FP-51..FP-56)
import ObjetivoPanel from "./ObjetivoPanel"; // (FP-28..FP-35)
import AccountPanel from "./AccountPanel"; // (FP-37..FP-40)
import ConceptsPanel from "./ConceptsPanel"; // MK-013 Concepts - (FP-01..FP-06)

export default class LoginApp extends Component {
  constructor(props) {
    super(props);

    this.state = {
      // MK-001 Login y MK-002 Registro - Campos del formulario
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
      isSignUp: false,
      message: "",
      loading: false,
      user: null,

      // MK-004 Account Created
      showAccountConfirmed: false,

      // MK-005 Home/Dashboard - Navegación por pestañas
      activeTab: "balance",

      // MK-012 Change Password - Cambio directo de contraseña (sin OTP)
      showChangePassword: false,
      showPasswordChangeSuccess: false,
      changePasswordEmail: "",
      newPassword: "",
      confirmNewPassword: "",
    };

    // Configuración de Supabase para todas las pantallas
    this.SUPABASE_URL = "https://sopeknspwpauugvarnvw.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcGVrbnNwd3BhdXVndmFybnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjE2ODksImV4cCI6MjA3NTMzNzY4OX0.Pay7ePl_elXtwHVHBvL-loqf0WC-47l_uDurKkGKwR8";
  }

  // FP-07: MK-004 Account Created - Verificación de cuenta confirmada
  componentDidMount() {
    const params = new URLSearchParams(window.location.search);
    const confirmed = params.get("confirmed");

    if (confirmed === "true") {
      this.setState({ showAccountConfirmed: true });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // FUNCIÓN HELPER: Llamar a función RPC de Supabase
  async callSupabaseFunction(functionName, params) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.SUPABASE_KEY,
    };

    const response = await fetch(
      `${this.SUPABASE_URL}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => null);
      throw new Error(`Error en ${functionName}: ${response.status} ${text}`);
    }

    return await response.json();
  }

  // FP-08: MK-002 Registro de Usuario - Crear usuario y cuenta usando función signup_user_and_account
  async signupToTables({ correo, nombre_usuario, password }) {
    try {
      const success = await this.callSupabaseFunction("signup_user_and_account", {
        p_correo: correo,
        p_nombre_usuario: nombre_usuario,
        p_password: password,
      });

      if (!success) {
        throw new Error("El correo ya está registrado");
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // FP-09: MK-001 Login - Validar credenciales usando función login_user_validate
  async loginFromTables({ correo, password }) {
    try {
      // Primero validar credenciales
      const isValid = await this.callSupabaseFunction("login_user_validate", {
        p_correo: correo,
        p_password: password,
      });

      if (!isValid) {
        return null;
      }

      // Si es válido, obtener datos del usuario
      const userData = await this.callSupabaseFunction("get_user_data", {
        p_correo: correo,
      });

      if (!userData || userData.length === 0) {
        return null;
      }

      const user = userData[0];

      // Retornar usuario en formato esperado
      return {
        email: user.correo,
        user_metadata: {
          nombre_usuario: user.nombre_usuario,
          ubicacion: user.ubicacion,
          lugar_trabajo: user.lugar_trabajo
        },
        _raw: user,
      };
    } catch (error) {
      throw error;
    }
  }

  // FP-10: MK-001 Login y MK-002 Registro - Manejar autenticación
  handleAuth = async () => {
    this.setState({ loading: true, message: "" });
    const { isSignUp, password, confirmPassword, username, email } = this.state;

    // MK-002 Registro - Validaciones
    if (isSignUp) {
      if (password !== confirmPassword) {
        this.setState({
          message: "Las contraseñas no coinciden",
          loading: false,
        });
        return;
      }
      // Longitud minima de usuario
      if (username.trim().length < 4) {
        this.setState({
          message: "El nombre de usuario debe tener al menos 4 caracteres",
          loading: false,
        });
        return;
      }
      // Longitud minima contraseña
      if (password.length < 6) {
        this.setState({
          message: "La contraseña debe tener al menos 6 caracteres",
          loading: false,
        });
        return;
      }
    }

    // Gestor de registro/login usando funciones de Supabase
    try {
      if (isSignUp) {
        // MK-002 Registro - crear usuario y cuenta
        try {
          await this.signupToTables({
            // FP-08
            correo: email,
            nombre_usuario: username,
            password,
          });
        } catch (err) {
          console.error("signupToTables error", err);
          this.setState({
            message: err.message || "Error al crear usuario",
            loading: false,
          });
          return;
        }

        // MK-001 Login - iniciar sesión automático después del registro
        let user;
        try {
          user = await this.loginFromTables({ correo: email, password }); // FP-09
        } catch (err) {
          console.error("loginFromTables after signup error", err);
          this.setState({
            message:
              err.message || "Registro creado pero fallo al iniciar sesión",
            loading: false,
          });
          return;
        }

        if (!user) {
          this.setState({
            message: "Error al iniciar sesión",
            loading: false,
          });
          return;
        }

        // MK-005 Home/Dashboard - Navegación exitosa después del login
        this.setState({
          user,
          message: "Registro y sesión correctos",
          loading: false,
          isSignUp: false,
          email: "",
          password: "",
          confirmPassword: "",
          username: "",
        });
      } else {
        // MK-001 Login - Validar campos obligatorios
        if (!email || !password) {
          this.setState({
            message: "Introduce correo y contraseña",
            loading: false,
          });
          return;
        }

        // MK-001 Login - Validar credenciales
        let user;
        try {
          user = await this.loginFromTables({ correo: email, password }); // FP-09
        } catch (err) {
          console.error("loginFromTables error", err);
          this.setState({
            message: err.message || "Error al iniciar sesión",
            loading: false,
          });
          return;
        }
        if (!user) {
          this.setState({ message: "Credenciales inválidas", loading: false });
          return;
        }

        // MK-005 Home/Dashboard - Navegación exitosa
        this.setState({
          user,
          message: "Inicio de sesión correcto",
          loading: false,
          email: "",
          password: "",
        });
      }
    } catch (error) {
      console.error("handleAuth unexpected error", error);
      this.setState({
        message: "Error de conexión. Verifica tu configuración de Supabase.",
        loading: false,
      });
    }
  };

  // FP-11: MK-012 Change Password - Cambiar contraseña directamente (sin OTP)
  handleChangePassword = async () => {
    this.setState({ loading: true, message: "" });
    const { changePasswordEmail, newPassword, confirmNewPassword } = this.state;

    if (!changePasswordEmail || !changePasswordEmail.includes("@")) {
      this.setState({
        message: "Por favor, ingresa un correo electrónico válido.",
        loading: false,
      });
      return;
    }

    // MK-012-E Passwords Don't Match - Validación
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
      // Verificar si el email existe usando función check_email_registered
      const exists = await this.callSupabaseFunction(
        "check_email_registered",
        {
          p_email: changePasswordEmail,
        }
      );

      if (!exists) {
        this.setState({
          message: "El correo no está registrado",
          loading: false,
        });
        return;
      }

      // Actualizar contraseña usando función update_user_password
      const success = await this.callSupabaseFunction("update_user_password", {
        p_correo: changePasswordEmail,
        p_nueva_contrasena: newPassword,
      });

      if (success) {
        // MK-013 Password Changed Successfully - Navegación exitosa
        this.setState({
          showChangePassword: false,
          showPasswordChangeSuccess: true,
          changePasswordEmail: "",
          newPassword: "",
          confirmNewPassword: "",
          loading: false,
        });
      } else {
        this.setState({
          message: "Error al cambiar la contraseña",
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      this.setState({
        message: "Error de conexión. Inténtalo de nuevo.",
        loading: false,
      });
    }
  };

  // FP-15: MK-001 Login - Cerrar sesión
  handleLogout = () => {
    this.setState({
      user: null,
      message: "Sesión cerrada",
      activeTab: "balance",
    });
  };

  // FP-16: MK-001 Login / MK-002 Registro - Alternar entre modos
  handleToggleMode = () => {
    this.setState((prevState) => ({
      isSignUp: !prevState.isSignUp,
      message: "",
      password: "",
      confirmPassword: "",
      username: "",
    }));
  };

  // FP-17: Navegación - Regresar al login desde cualquier pantalla
  handleBackToLogin = () => {
    this.setState({
      showAccountConfirmed: false,
      showChangePassword: false,
      showPasswordChangeSuccess: false,
      isSignUp: false,
      message: "",
      changePasswordEmail: "",
      newPassword: "",
      confirmNewPassword: "",
    });
  };

  // FP-18: MK-012 Change Password - Navegar a cambio de contraseña
  handleGoToChangePassword = () => {
    this.setState({ showChangePassword: true, message: "" });
  };

  // Componente auxiliar para íconos
  renderIcon(emoji) {
    return (
      <div className="success-icon-container">
        <span style={{ fontSize: "3rem" }}>{emoji}</span>
      </div>
    );
  }

  // FP-19: MK-004 Account Created - Renderizar pantalla de cuenta confirmada
  renderAccountConfirmed() {
    return (
      <div className="app-container">
        <div className="login-card">
          <div className="text-center">
            {this.renderIcon("✅")}
            <h2 className="welcome-title">¡Cuenta creada exitosamente!</h2>
            <p className="user-email" style={{ marginBottom: "1.5rem" }}>
              Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión.
            </p>
            <button
              onClick={this.handleBackToLogin} // FP-17
              className="btn btn-primary"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FP-21: MK-012 Change Password - Renderizar cambio de contraseña
  renderChangePassword() {
    const { changePasswordEmail, newPassword, confirmNewPassword, message, loading } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("🔒")}
            <h1 className="title">Cambiar Contraseña</h1>
            <p className="subtitle">
              Ingresa tu correo y tu nueva contraseña
            </p>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                value={changePasswordEmail}
                onChange={(e) =>
                  this.setState({ changePasswordEmail: e.target.value })
                }
                className="form-input"
                placeholder="tu@email.com"
              />
            </div>

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
              onClick={this.handleChangePassword} // FP-11
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </div>

          <div className="toggle-section">
            <button onClick={this.handleBackToLogin} className="btn-link">
              {" "}
              {/* FP-17 */}
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FP-24: MK-013 Password Changed Successfully - Renderizar éxito
  renderPasswordChangeSuccess() {
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
              onClick={this.handleBackToLogin} // FP-17
              className="btn btn-primary"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FP-25: MK-005 Home/Dashboard - Renderizar dashboard principal
  renderDashboard() {
    const { user, activeTab } = this.state;

    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="logo">📋 Planify</div>
          <button onClick={this.handleLogout} className="btn-logout">
            {" "}
            {/* FP-15 */}
            Cerrar Sesión
          </button>
        </div>

        {/* MK-005 Home/Dashboard - Navegación por pestañas */}
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
            <div style={{ padding: "2rem" }}>
              {/* MK-005 Balance - incrustado aquí: FP-51 .. FP-56 */}
              <Balance
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "dailyinput" && (
            <div style={{ padding: "2rem" }}>
              {/* MK-009 Daily Input - incrustado aquí: FP-41 .. FP-50 */}
              <DailyInput
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "goals" && (
            <div style={{ padding: "2rem" }}>
              <ObjetivoPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "config" && (
            <div style={{ padding: "2rem" }}>
              <ConceptsPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "account" && (
            <div style={{ padding: "2rem" }}>
              <AccountPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                user={this.state.user}
                onOpenChangePassword={this.handleGoToChangePassword} // FP-18
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // FP-26: MK-001 Login y MK-002 Registro - Renderizar formulario de autenticación
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
                  message.includes("exitoso") || message.includes("creada") || message.includes("correctos")
                    ? "message-success"
                    : "message-error"
                }`}
              >
                {message}
              </div>
            )}

            <button
              onClick={this.handleAuth} // FP-10
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
                onClick={this.handleGoToChangePassword} // FP-18
                className="btn-link"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <div className="toggle-section">
            <button onClick={this.handleToggleMode} className="btn-link">
              {" "}
              {/* FP-16 */}
              {isSignUp
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FP-27: Render principal - Controlador de navegación entre pantallas
  render() {
    const {
      showAccountConfirmed,
      showChangePassword,
      showPasswordChangeSuccess,
      user,
    } = this.state;

    if (showAccountConfirmed) return this.renderAccountConfirmed(); // FP-19
    if (showPasswordChangeSuccess) return this.renderPasswordChangeSuccess(); // FP-24
    if (showChangePassword) return this.renderChangePassword(); // FP-21
    if (user) return this.renderDashboard(); // FP-25
    return this.renderLoginForm(); // FP-26
  }
}