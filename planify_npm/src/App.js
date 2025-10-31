import React, { Component } from "react";
import ObjetivoPanel from "./ObjetivoPanel";
import AccountPanel from "./AccountPanel";
import ConceptsPanel from "./ConceptsPanel";

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

      // MK-003 Confirmación de Email y MK-004 Account Created
      showEmailConfirmation: false,
      showAccountConfirmed: false,

      // MK-005 Home/Dashboard - Navegación por pestañas
      activeTab: "balance",

      // MK-010 Change Password - Send Code
      showForgotPassword: false,
      showOtpVerification: false,
      showResetPassword: false,
      showPasswordResetSuccess: false,
      otpCode: "",
      recoveryEmail: "",

      // MK-012 Change Password
      newPassword: "",
      confirmNewPassword: "",
      accessToken: null,

      // MK-008 Goals - Campos del formulario de objetivos
      goal_correo_cuenta: "",
      goal_fecha_objetivo: "",
      goal_monto: "",
      goal_tipo: true,
      goal_estado: "",
      creatingGoal: false,
    };

    // Configuración de Supabase para todas las pantallas
    this.SUPABASE_URL = "https://sopeknspwpauugvarnvw.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcGVrbnNwd3BhdXVndmFybnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjE2ODksImV4cCI6MjA3NTMzNzY4OX0.Pay7ePl_elXtwHVHBvL-loqf0WC-47l_uDurKkGKwR8";
  }

  // FP-07: MK-004 Account Created - Verificación de cuenta confirmada
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

  // FP-08: MK-002 Registro de Usuario - Crear usuario y cuenta en tablas
  async signupToTables({ correo, nombre_usuario, password }) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.SUPABASE_KEY,
    };

    // Insertar en usuario
    const usuarioBody = {
      correo,
      nombre_usuario,
      contrasena: password,
    };

    const resUser = await fetch(`${this.SUPABASE_URL}/rest/v1/usuario`, {
      method: "POST",
      headers,
      body: JSON.stringify(usuarioBody),
    });

    // Si el usuario ya existe (409), lo tratamos como OK y seguimos para intentar login.
    if (!resUser.ok && resUser.status !== 409) {
      const text = await resUser.text().catch(() => null);
      throw new Error(`Error al crear usuario: ${resUser.status} ${text}`);
    }

    // Crear/asegurar cuenta asociada
    const cuentaBody = {
      correo_cuenta: correo,
      nombre_cuenta: nombre_usuario || correo,
      correo_usuario: correo,
      fecha_creacion: new Date().toISOString().slice(0, 10),
      activo: true,
    };

    const resCuenta = await fetch(`${this.SUPABASE_URL}/rest/v1/cuenta`, {
      method: "POST",
      headers,
      body: JSON.stringify(cuentaBody),
    });

    // Si falla por conflicto ya existente (409), no es crítico
    if (!resCuenta.ok && resCuenta.status !== 409) {
      const text = await resCuenta.text().catch(() => null);
      throw new Error(`Error al crear cuenta: ${resCuenta.status} ${text}`);
    }

    return true;
  }

  // FP-09: MK-001 Login - Validar credenciales del usuario
  async loginFromTables({ correo, password }) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.SUPABASE_KEY,
    };

    // Hacer GET filtrando por correo y contrasena
    const url = `${
      this.SUPABASE_URL
    }/rest/v1/usuario?correo=eq.${encodeURIComponent(
      correo
    )}&contrasena=eq.${encodeURIComponent(
      password
    )}&select=correo,nombre_usuario`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text().catch(() => null);
      throw new Error(`Error al consultar usuario: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const row = data[0];
    // Normalizamos la forma del usuario
    return {
      email: row.correo || row.email || row.correo_usuario || row.user_email,
      user_metadata: { username: row.nombre_usuario || row.nombre || "" },
      _raw: row,
    };
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

    // Gestor de registro/login usando tablas usuario/cuenta
    try {
      if (isSignUp) {
        // MK-002 Registro - crear usuario y cuenta en tablas
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
            message:
              "Registro creado pero no se pudo iniciar sesión (credenciales)",
            loading: false,
          });
          return;
        }

        // MK-005 Home/Dashboard - Navegación exitosa después del login
        this.setState({
          user,
          accessToken: "",
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
          accessToken: "",
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

  // FP-11: MK-010 Change Password - Send Code - Enviar código de recuperación
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
      // MK-010-E Email Not Registered - Verificar si el email existe
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

      // MK-010 Change Password - Send Code - Enviar código de recuperación
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
        // MK-011 Enter Verification Code - Navegación a verificación
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

  // FP-12: MK-011 Enter Verification Code - Verificar código OTP
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
        // MK-012 Change Password - Navegación exitosa con token
        this.setState({
          showOtpVerification: false,
          showResetPassword: true,
          message: "",
          accessToken: data.access_token,
        });
      } else {
        // MK-011-E Incorrect Code - Mensaje de error
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

  // FP-13: MK-012 Change Password - Actualizar contraseña
  handleResetPassword = async () => {
    this.setState({ loading: true, message: "" });
    const { newPassword, confirmNewPassword, accessToken } = this.state;

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
        // MK-013 Password Changed Successfully - Navegación exitosa
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

  // FP-14: MK-008 Goals - Crear objetivo
  createObjetivo = async () => {
    this.setState({ creatingGoal: true, message: "" });
    const {
      goal_correo_cuenta,
      goal_fecha_objetivo,
      goal_monto,
      goal_tipo,
      goal_estado,
      accessToken,
    } = this.state;

    if (!accessToken) {
      this.setState({
        message: "Sesión inválida. Inicia sesión nuevamente.",
        creatingGoal: false,
      });
      return;
    }

    const url = `${this.SUPABASE_URL}/rest/v1/objetivo`;
    const body = {
      correo_cuenta: goal_correo_cuenta,
      fecha_objetivo: goal_fecha_objetivo,
      monto_objetivo: goal_monto,
      tipo: goal_tipo,
      estado: goal_estado,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Error creando objetivo", res.status, data);
        this.setState({
          message: data?.message || JSON.stringify(data),
          creatingGoal: false,
        });
        return;
      }

      this.setState({
        message: "Objetivo creado",
        creatingGoal: false,
        goal_correo_cuenta: "",
        goal_fecha_objetivo: "",
        goal_monto: "",
        goal_estado: "",
      });
    } catch (error) {
      console.error("Error creando objetivo", error);
      this.setState({
        message: "Error de conexión al crear objetivo",
        creatingGoal: false,
      });
    }
  };

  // FP-15: MK-001 Login - Cerrar sesión
  handleLogout = () => {
    this.setState({
      user: null,
      message: "Sesión cerrada",
      activeTab: "balance",
      accessToken: null,
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
      showEmailConfirmation: false,
    }));
  };

  // FP-17: Navegación - Regresar al login desde cualquier pantalla
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

  // FP-18: MK-010 Change Password - Navegar a recuperación de contraseña
  handleGoToForgotPassword = () => {
    this.setState({ showForgotPassword: true, message: "" });
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
              Tu correo ha sido verificado correctamente. Ya puedes iniciar
              sesión con tu cuenta.
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

  // FP-20: MK-003 Confirmación de Email - Renderizar pantalla de verificación
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

  // FP-21: MK-010 Change Password - Send Code - Renderizar recuperación
  renderForgotPassword() {
    const { recoveryEmail, message, loading } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("🔓")}
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
              onClick={this.handleForgotPassword} // FP-11
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Enviando..." : "Enviar código"}
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

  // FP-22: MK-011 Enter Verification Code - Renderizar verificación OTP
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
              onClick={this.handleVerifyOtp} // FP-12
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Verificando..." : "Verificar código"}
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

  // FP-23: MK-012 Change Password - Renderizar formulario de nueva contraseña
  renderResetPassword() {
    const { newPassword, confirmNewPassword, message, loading } = this.state;

    return (
      <div className="app-container">
        <div className="login-card">
          <div className="header-section text-center">
            {this.renderIcon("🔓")}
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
              onClick={this.handleResetPassword} // FP-13
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
    const {
      user,
      activeTab,
      goal_correo_cuenta,
      goal_fecha_objetivo,
      goal_monto,
      goal_tipo,
      goal_estado,
      creatingGoal,
    } = this.state;

    const displayName =
      (user && (user.user_metadata?.username || user.nombre_usuario)) ||
      (user && user.email) ||
      "";

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
            <div style={{ padding: "2rem" }}>
              <ObjetivoPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                accessToken={this.state.accessToken}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "config" && (
            <div style={{ padding: "2rem" }}>
              <ConceptsPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                accessToken={this.state.accessToken}
                user={this.state.user}
              />
            </div>
          )}
          {activeTab === "account" && (
            <div style={{ padding: "2rem" }}>
              <AccountPanel
                SUPABASE_URL={this.SUPABASE_URL}
                SUPABASE_KEY={this.SUPABASE_KEY}
                accessToken={this.state.accessToken}
                user={this.state.user}
                onOpenChangePassword={this.handleGoToForgotPassword} // FP-18
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
                  message.includes("exitoso") || message.includes("creada")
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
                onClick={this.handleGoToForgotPassword} // FP-18
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
      showEmailConfirmation,
      showForgotPassword,
      showOtpVerification,
      showResetPassword,
      showPasswordResetSuccess,
      user,
    } = this.state;

    if (showAccountConfirmed) return this.renderAccountConfirmed(); // FP-19
    if (showEmailConfirmation) return this.renderEmailConfirmation(); // FP-20
    if (showPasswordResetSuccess) return this.renderPasswordResetSuccess(); // FP-24
    if (showResetPassword) return this.renderResetPassword(); // FP-23
    if (showOtpVerification) return this.renderOtpVerification(); // FP-22
    if (showForgotPassword) return this.renderForgotPassword(); // FP-21
    if (user) return this.renderDashboard(); // FP-25
    return this.renderLoginForm(); // FP-26
  }
}
