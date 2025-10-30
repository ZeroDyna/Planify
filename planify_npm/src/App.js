import React, { Component } from "react";
import ObjetivoPanel from "./ObjetivoPanel";
import AccountPanel from "./AccountPanel";
import ConceptsPanel from "./ConceptsPanel";
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
      // goal form fields
      goal_correo_cuenta: "",
      goal_fecha_objetivo: "",
      goal_monto: "",
      goal_tipo: true,
      goal_estado: "",
      creatingGoal: false,
    };

    // Reemplaza SUPABASE_URL y SUPABASE_KEY con los valores de tu proyecto.
    // SUPABASE_KEY debe ser la ANON (public) key cuando usas desde el frontend.
    this.SUPABASE_URL = "https://sopeknspwpauugvarnvw.supabase.co";
    this.SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcGVrbnNwd3BhdXVndmFybnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjE2ODksImV4cCI6MjA3NTMzNzY4OX0.Pay7ePl_elXtwHVHBvL-loqf0WC-47l_uDurKkGKwR8";
  }

  // Pantalla de confirmación de cuenta
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

  // Helper: insertar usuario y cuenta directamente en las tablas (signup)
  // Nota: esto guarda la contraseña en la tabla tal cual (si tu tabla usa 'contrasena').
  // Es inseguro para producción; lo dejamos así por exigencia tuya de tocar solo App.js.
  async signupToTables({ correo, nombre_usuario, password }) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.SUPABASE_KEY,
      // NO usamos Authorization aquí; si tienes RLS activo necesitarás usar un token válido
    };

    // Insertar en usuario (si tu tabla tiene campo 'contrasena', ajusta el nombre)
    const usuarioBody = {
      correo,
      nombre_usuario,
      // Nota: esto será guardado tal cual en la BD (INSEGURO). Mejor usar hash en backend.
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

    // Si falla por conflicto ya existente (409), no es crítico; PostgREST devolverá 409
    if (!resCuenta.ok && resCuenta.status !== 409) {
      const text = await resCuenta.text().catch(() => null);
      throw new Error(`Error al crear cuenta: ${resCuenta.status} ${text}`);
    }

    return true;
  }

  // Helper: login consultando la tabla usuario (compara correo + contrasena)
  // Devuelve el objeto usuario si coincide, o null si no existe.
  // Retornamos un objeto compatible con el shape que espera la UI (user.user_metadata.username y user.email).
  async loginFromTables({ correo, password }) {
    const headers = {
      "Content-Type": "application/json",
      apikey: this.SUPABASE_KEY,
    };

    // Hacer GET filtrando por correo y contrasena (PostgREST)
    // Ajuste: no pedimos 'id' porque en tu esquema puede que no exista; pedimos correo y nombre.
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
    // Normalizamos la forma del usuario para que el resto de la app no necesite cambios:
    // ponemos user.user_metadata.username y user.email
    return {
      email: row.correo || row.email || row.correo_usuario || row.user_email,
      user_metadata: { username: row.nombre_usuario || row.nombre || "" },
      // añadimos raw row por si necesitas inspectar:
      _raw: row,
    };
  }

  // Maneja registro de usuario o inicio de sesión con validaciones
  handleAuth = async () => {
    this.setState({ loading: true, message: "" });
    const { isSignUp, password, confirmPassword, username, email } = this.state;

    // Validación contraseña
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
        // crear usuario y cuenta en tablas
        try {
          await this.signupToTables({
            correo: email,
            nombre_usuario: username,
            password,
          });
        } catch (err) {
          console.error("signupToTables error", err);
          // Si el error contiene "already exists" o 409, dejamos que el flujo siga para intentar login.
          this.setState({
            message: err.message || "Error al crear usuario",
            loading: false,
          });
          return;
        }

        // iniciar sesión automático consultando la tabla
        let user;
        try {
          user = await this.loginFromTables({ correo: email, password });
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

        this.setState({
          user,
          accessToken: "", // sin token JWT en esta integración mínima
          message: "Registro y sesión correctos",
          loading: false,
          isSignUp: false,
          email: "",
          password: "",
          confirmPassword: "",
          username: "",
        });
      } else {
        // login
        if (!email || !password) {
          this.setState({
            message: "Introduce correo y contraseña",
            loading: false,
          });
          return;
        }
        let user;
        try {
          user = await this.loginFromTables({ correo: email, password });
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

        this.setState({
          user,
          accessToken: "", // no usamos token Supabase aquí
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

  // Envía código de recuperación de contraseña al email (MK-010)
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

  // Verifica el código ingresado y obtiene el access token para cambiar contraseña (MK-011)
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

  // Actualiza la contraseña del usuario luego de ingresar el token  (MK-012)
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

  // Crear objetivo (usa token guardado en state.accessToken)
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
          apikey: this.SUPABASE_KEY, // usa la anon key
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

  // Cierra sesión del usuario
  handleLogout = () => {
    this.setState({
      user: null,
      message: "Sesión cerrada",
      activeTab: "balance",
      accessToken: null,
    });
  };

  // Alterna entre registro e inicio de sesión
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

  // Regresa a la pantalla de login y limpia todos los estados de recuperación
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

  // Muestra la pantalla de recuperación de contraseña
  handleGoToForgotPassword = () => {
    this.setState({ showForgotPassword: true, message: "" });
  };

  // Icono Check
  renderIcon(emoji) {
    return (
      <div className="success-icon-container">
        <span style={{ fontSize: "3rem" }}>{emoji}</span>
      </div>
    );
  }

  // Muestra la pantalla de confirmación de cuenta creada exitosamente
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

  // Muestra la pantalla indicando que se envió un email de verificación (MK-004)
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

  // Muestra formulario para solicitar la recuperación de contraseña
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

  // Muestra el formulario para ingresar el token de 6 dígitos
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

  // Muestra el formulario para establecer una nueva contraseña
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

  // Muestra una pantalla de éxito después de cambiar la contraseña
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

  // Muestra dailyInput después de iniciar sesión
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
    // adaptamos displayName para ambos shapes (auth o usuario propio)
    const displayName =
      (user && (user.user_metadata?.username || user.nombre_usuario)) ||
      (user && user.email) ||
      "";

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
                onOpenChangePassword={this.handleGoToForgotPassword}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Muestra el formulario de login o registro con la opción de olvidé la contraseña (Mk-001 y MK-002)
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

  // Renderiza la pantalla correspondiente según el estado actual de la aplicación
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
