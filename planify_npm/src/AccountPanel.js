import React, { useEffect, useState } from "react";

/**
 * AccountPanel - interfaz simple de cuenta
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user guardado en App.js (se usa user.email para filtrar)
 * - onOpenChangePassword (opcional) - callback en App.js que muestra la interfaz de cambio/recuperación de contraseña
 */
export default function AccountPanel({
  SUPABASE_URL,
  SUPABASE_KEY,
  accessToken,
  user,
  onOpenChangePassword,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);

  const headersBase = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
  };

  useEffect(() => {
    fetchAccountData();
    // eslint-disable-next-line
  }, [user, accessToken]);

  const fetchAccountData = async () => {
    setLoading(true);
    setMessage("");
    setUsuario(null);
    setCuenta(null);

    try {
      const email = user?.email || user?.correo || null;
      if (!email) {
        setMessage("Inicia sesión para ver y editar tu cuenta.");
        setLoading(false);
        return;
      }

      // obtener usuario
      const uUrl = `${SUPABASE_URL}/rest/v1/usuario?correo=eq.${encodeURIComponent(
        email
      )}&select=correo,nombre_usuario,ubicacion,lugar_trabajo`;
      const uRes = await fetch(uUrl, {
        headers: accessToken
          ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
          : headersBase,
      });
      if (uRes.ok) {
        const uJson = await uRes.json().catch(() => null);
        if (Array.isArray(uJson) && uJson.length) setUsuario(uJson[0]);
      } else {
        const txt = await uRes.text().catch(() => null);
        console.warn("fetch usuario failed", uRes.status, txt, { uUrl });
      }

      // obtener cuenta
      const cUrl = `${SUPABASE_URL}/rest/v1/cuenta?correo_usuario=eq.${encodeURIComponent(
        email
      )}&select=correo_cuenta,nombre_cuenta`;
      const cRes = await fetch(cUrl, {
        headers: accessToken
          ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
          : headersBase,
      });
      if (cRes.ok) {
        const cJson = await cRes.json().catch(() => null);
        if (Array.isArray(cJson) && cJson.length) setCuenta(cJson[0]);
      } else {
        const txt = await cRes.text().catch(() => null);
        console.warn("fetch cuenta failed", cRes.status, txt, { cUrl });
      }

      setLoading(false);
    } catch (err) {
      console.error("fetchAccountData exception", err);
      setMessage("Error de conexión al cargar datos de cuenta.");
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setMessage("");
    setSuccess("");
    if (!usuario && !cuenta) {
      setMessage("No hay datos para guardar.");
      return;
    }
    setSaving(true);

    try {
      const email = usuario?.correo || cuenta?.correo_cuenta || user?.email;
      if (!email) {
        setMessage("No se detectó correo para asociar cambios.");
        setSaving(false);
        return;
      }

      // PATCH usuario -> nombre_usuario, ubicacion, lugar_trabajo
      if (usuario) {
        const payload = {
          nombre_usuario: usuario.nombre_usuario ?? "",
          ubicacion: usuario.ubicacion ?? "",
          lugar_trabajo: usuario.lugar_trabajo ?? "",
        };
        const uUrl = `${SUPABASE_URL}/rest/v1/usuario?correo=eq.${encodeURIComponent(
          email
        )}`;
        const uRes = await fetch(uUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
          },
          body: JSON.stringify(payload),
        });
        if (!uRes.ok) {
          const txt = await uRes.text().catch(() => null);
          console.error("update usuario failed", uRes.status, txt, {
            uUrl,
            payload,
          });
          setMessage(`Error al actualizar usuario: ${txt || uRes.status}`);
          setSaving(false);
          return;
        }
        console.log("Usuario actualizado correctamente");
      }

      // PATCH cuenta -> nombre_cuenta solamente
      if (cuenta) {
        const payload = {
          nombre_cuenta: cuenta.nombre_cuenta ?? "",
        };
        const cUrl = `${SUPABASE_URL}/rest/v1/cuenta?correo_usuario=eq.${encodeURIComponent(
          email
        )}`;
        const cRes = await fetch(cUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
          },
          body: JSON.stringify(payload),
        });
        if (!cRes.ok) {
          const txt = await cRes.text().catch(() => null);
          console.error("update cuenta failed", cRes.status, txt, {
            cUrl,
            payload,
          });
          setMessage(`Error al actualizar cuenta: ${txt || cRes.status}`);
          setSaving(false);
          return;
        }
        console.log("Cuenta actualizada correctamente");
      }

      setSuccess("Cambios guardados correctamente.");
      await fetchAccountData();
    } catch (err) {
      console.error("handleSave error", err);
      setMessage(err.message || "Error al guardar cambios");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  // Button: open change-password interface (delegate to parent)
  const handleOpenChangePassword = () => {
    if (typeof onOpenChangePassword === "function") {
      onOpenChangePassword();
      return;
    }
    window.alert(
      "Abrir interfaz de cambio de contraseña (fallback): usa la funcionalidad integrada."
    );
  };

  // styles
  const styles = {
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
          No se encontraron datos de cuenta. Asegúrate de haber iniciado sesión.
        </div>
      )}

      {(usuario || cuenta) && (
        <div style={{ marginTop: 12 }}>
          <div style={styles.grid}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                  onClick={handleOpenChangePassword}
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
                    setUsuario((u) => ({
                      ...(u || {}),
                      nombre_usuario: e.target.value,
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
                    setCuenta((c) => ({
                      ...(c || {}),
                      nombre_cuenta: e.target.value,
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
                    setUsuario((u) => ({
                      ...(u || {}),
                      ubicacion: e.target.value,
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
                    setUsuario((u) => ({
                      ...(u || {}),
                      lugar_trabajo: e.target.value,
                    }))
                  }
                  placeholder="Workplace"
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  style={styles.btnPrimary}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={fetchAccountData}
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
