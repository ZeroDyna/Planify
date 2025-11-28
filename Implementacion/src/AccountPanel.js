import React from "react";

/**
 * AccountPanel - interfaz de gestión de cuenta de usuario
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user guardado en App.js (se usa user.email para filtrar)
 * - onOpenChangePassword (opcional) - callback para abrir la interfaz de cambio de contraseña
 */
export default class AccountPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      saving: false,
      message: "",
      success: "",
      usuario: null,
      cuenta: null,
    };
  }

  // FP-37: Obtiene los datos usando la función SQL consolidada
  fetchAccountData = async () => {
    this.setState({
      loading: true,
      message: "",
      usuario: null,
      cuenta: null,
    });

    try {
      const email = this.props.user?.email || this.props.user?.correo || null;
      if (!email) {
        this.setState({
          message: "Inicia sesión para ver y editar tu cuenta.",
          loading: false,
        });
        return;
      }

      const url = `${this.props.SUPABASE_URL}/rest/v1/rpc/get_user_account_data`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.props.SUPABASE_KEY,
          ...(this.props.accessToken && {
            Authorization: `Bearer ${this.props.accessToken}`,
          }),
        },
        body: JSON.stringify({ p_email: email }),
      });

      if (res.ok) {
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const row = data[0];

          this.setState({
            usuario: {
              correo: row.correo,
              nombre_usuario: row.nombre_usuario,
              ubicacion: row.ubicacion,
              lugar_trabajo: row.lugar_trabajo,
            },
            cuenta: row.correo_cuenta
              ? {
                  correo_cuenta: row.correo_cuenta,
                  nombre_cuenta: row.nombre_cuenta,
                  correo_usuario: row.correo_usuario,
                  fecha_creacion: row.fecha_creacion,
                  activo: row.activo,
                }
              : null,
            loading: false,
          });
        } else {
          this.setState({
            message: "No se encontraron datos para este usuario.",
            loading: false,
          });
        }
      } else {
        const txt = await res.text().catch(() => null);
        this.setState({
          message: "Error al cargar datos de cuenta.",
          loading: false,
        });
      }
    } catch (err) {
      this.setState({
        message: "Error de conexión al cargar datos de cuenta.",
        loading: false,
      });
    }
  };

  // FP-38: Guarda usando la función SQL consolidada
  handleSave = async (e) => {
    e?.preventDefault();
    this.setState({ message: "", success: "" });
    const { usuario, cuenta } = this.state;

    if (!usuario && !cuenta) {
      this.setState({ message: "No hay datos para guardar." });
      return;
    }

    this.setState({ saving: true });

    try {
      const email =
        usuario?.correo || cuenta?.correo_cuenta || this.props.user?.email;
      if (!email) {
        this.setState({
          message: "No se detectó correo para asociar cambios.",
          saving: false,
        });
        return;
      }

      const url = `${this.props.SUPABASE_URL}/rest/v1/rpc/update_user_account_data`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.props.SUPABASE_KEY,
          ...(this.props.accessToken && {
            Authorization: `Bearer ${this.props.accessToken}`,
          }),
        },
        body: JSON.stringify({
          p_email: email,
          p_nombre_usuario: usuario?.nombre_usuario || null,
          p_ubicacion: usuario?.ubicacion || null,
          p_lugar_trabajo: usuario?.lugar_trabajo || null,
          p_nombre_cuenta: cuenta?.nombre_cuenta || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const row = data[0];

          this.setState({
            success: "Cambios guardados correctamente.",
            usuario: {
              correo: row.correo,
              nombre_usuario: row.nombre_usuario,
              ubicacion: row.ubicacion,
              lugar_trabajo: row.lugar_trabajo,
            },
            cuenta: row.correo_cuenta
              ? {
                  correo_cuenta: row.correo_cuenta,
                  nombre_cuenta: row.nombre_cuenta,
                  correo_usuario: row.correo_usuario,
                  fecha_creacion: row.fecha_creacion,
                  activo: row.activo,
                }
              : null,
          });
        } else {
          this.setState({
            message: "No se realizaron cambios.",
          });
        }
      } else {
        const txt = await res.text().catch(() => null);
        this.setState({
          message: `Error al actualizar: ${txt || res.status}`,
        });
      }
    } catch (err) {
      this.setState({ message: err.message || "Error al guardar cambios" });
    } finally {
      this.setState({ saving: false });
      setTimeout(() => this.setState({ success: "" }), 3000);
    }
  };

  // FP-39: Abre la interfaz de cambio de contraseña.
  // Si hay callback, lo llama, si no, muestra alerta de fallback.
  handleOpenChangePassword = () => {
    if (typeof this.props.onOpenChangePassword === "function") {
      this.props.onOpenChangePassword();
      return;
    }
    window.alert(
      "Abrir interfaz de cambio de contraseña (fallback): usa la funcionalidad integrada."
    );
  };

  // FP-40: Llama automáticamente a la carga de datos de cuenta cuando el usuario o token cambian.
  componentDidMount() {
    this.fetchAccountData();
  }
  componentDidUpdate(prevProps) {
    if (
      this.props.user !== prevProps.user ||
      this.props.accessToken !== prevProps.accessToken
    ) {
      this.fetchAccountData();
    }
  }

  // Helpers y estilos (sin FP): para inputs, botones, etc.
  headersBase = () => ({
    "Content-Type": "application/json",
    apikey: this.props.SUPABASE_KEY,
  });

  styles = {
    card: {
      padding: 16,
      borderRadius: 8,
      background: "white",
      boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
    },
    avatarBox: {
      width: 120,
      height: 120,
      borderRadius: 8,
      background: "#f3f4f6",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      display: "block",
      fontSize: 13,
      color: "#374151",
      marginBottom: 6,
    },
    input: {
      width: "100%",
      padding: 8,
      borderRadius: 6,
      border: "1px solid #e5e7eb",
    },
    btnPrimary: {
      background: "linear-gradient(135deg,#6366f1,#7c3aed)",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: 6,
      border: "none",
      cursor: "pointer",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "160px 1fr",
      gap: 16,
      alignItems: "start",
    },
  };

  render() {
    const { loading, saving, message, success, usuario, cuenta } = this.state;
    const styles = this.styles;

    return (
      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Cuenta</h3>

        {message && (
          <div style={{ color: "#b91c1c", marginBottom: 8 }}>{message}</div>
        )}
        {success && (
          <div style={{ color: "#065f46", marginBottom: 8 }}>{success}</div>
        )}

        {!usuario && !cuenta && !loading && (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            No se encontraron datos de cuenta. Asegúrate de haber iniciado
            sesión.
          </div>
        )}

        {(usuario || cuenta) && (
          <div style={{ marginTop: 12 }}>
            <div style={styles.grid}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div style={styles.avatarBox}>
                  <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z"
                      stroke="#9CA3AF"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M3 21c0-3 4-5 9-5s9 2 9 5"
                      stroke="#9CA3AF"
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>
                <div>
                  <button
                    type="button"
                    style={styles.btnPrimary}
                    onClick={this.handleOpenChangePassword}
                    disabled={saving}
                  >
                    {saving ? "Procesando..." : "Change Password"}
                  </button>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.label}>Mail</label>
                  <input
                    style={styles.input}
                    value={usuario?.correo || cuenta?.correo_cuenta || ""}
                    readOnly
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    style={styles.input}
                    value={usuario?.nombre_usuario || ""}
                    onChange={(e) =>
                      this.setState(({ usuario }) => ({
                        usuario: {
                          ...(usuario || {}),
                          nombre_usuario: e.target.value,
                        },
                      }))
                    }
                    placeholder="Full name"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.label}>Account name</label>
                  <input
                    style={styles.input}
                    value={cuenta?.nombre_cuenta || ""}
                    onChange={(e) =>
                      this.setState(({ cuenta }) => ({
                        cuenta: {
                          ...(cuenta || {}),
                          nombre_cuenta: e.target.value,
                        },
                      }))
                    }
                    placeholder="Account / workplace name"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.label}>Location</label>
                  <input
                    style={styles.input}
                    value={usuario?.ubicacion || ""}
                    onChange={(e) =>
                      this.setState(({ usuario }) => ({
                        usuario: {
                          ...(usuario || {}),
                          ubicacion: e.target.value,
                        },
                      }))
                    }
                    placeholder="Location"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={styles.label}>Workplace</label>
                  <input
                    style={styles.input}
                    value={usuario?.lugar_trabajo || ""}
                    onChange={(e) =>
                      this.setState(({ usuario }) => ({
                        usuario: {
                          ...(usuario || {}),
                          lugar_trabajo: e.target.value,
                        },
                      }))
                    }
                    placeholder="Workplace"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={this.handleSave}
                    style={styles.btnPrimary}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={this.fetchAccountData}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Recargar
                  </button>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
                  <div>
                    Account email:{" "}
                    <strong>{usuario?.correo || cuenta?.correo_cuenta}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ marginTop: 12 }}>Cargando datos de cuenta...</div>
        )}
      </div>
    );
  }
}
