import React, { useEffect, useState } from "react";

/**
 * ConceptsPanel - Gestión de conceptos de ingreso/egreso
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user para filtrar por cuenta
 */

export default function ConceptsPanel({
  SUPABASE_URL,
  SUPABASE_KEY,
  accessToken,
  user,
}) {
  const [cuenta, setCuenta] = useState(null);
  const [conceptos, setConceptos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // MK-013 Concepts - campos del formulario
  const [form, setForm] = useState({
    nombre_concepto: "",
    tipo: false,
    periodo: "Biweekly",
    activo: true,
  });
  const [saving, setSaving] = useState(false);

  const headersBase = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
  };
  const headersAuth = accessToken
    ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
    : headersBase;

  const Spinner = ({ size = 18 }) => (
    <span
      role="status"
      aria-live="polite"
      style={{
        width: size,
        height: size,
        border: "3px solid rgba(0,0,0,0.08)",
        borderTop: "3px solid #0ea5e9",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
        verticalAlign: "middle",
      }}
    />
  );

  // FP-01: Obtener cuenta del usuario
  const fetchCuenta = async () => {
    setMessage("");
    try {
      const emailFromUser =
        user?.email || user?.correo || user?.user?.email || user?._raw?.correo;

      if (!emailFromUser) {
        setMessage("No se pudo obtener la cuenta del usuario.");
        setCuenta(null);
        return;
      }

      const url = `${SUPABASE_URL}/rest/v1/rpc/get_cuenta_by_user`;
      const res = await fetch(url, {
        method: "POST",
        headers: accessToken ? headersAuth : headersBase,
        body: JSON.stringify({ p_correo_usuario: emailFromUser }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        setMessage("No se pudo obtener la cuenta del usuario.");
        setCuenta(null);
        return;
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setMessage("No hay cuenta asociada a este usuario.");
        setCuenta(null);
        return;
      }

      setCuenta({
        correo_cuenta: data[0].correo_cuenta,
        nombre_cuenta: data[0].nombre_cuenta || data[0].correo_cuenta,
      });
      setSelectedId(null);
    } catch (err) {
      setMessage("Error de conexión al obtener la cuenta.");
      setCuenta(null);
    }
  };

  // FP-02: Cargar conceptos de la cuenta
  const fetchConceptos = async () => {
    if (!cuenta) {
      setConceptos([]);
      setSelectedId(null);
      return;
    }
    setLoadingList(true);
    setMessage("");
    try {
      const url = `${SUPABASE_URL}/rest/v1/rpc/get_conceptos_by_cuenta`;
      const res = await fetch(url, {
        method: "POST",
        headers: accessToken ? headersAuth : headersBase,
        body: JSON.stringify({ correo: cuenta.correo_cuenta }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        setMessage("Error al cargar conceptos.");
        setConceptos([]);
        setSelectedId(null);
        setLoadingList(false);
        return;
      }

      const data = JSON.parse(responseText);

      setConceptos(data || []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedId(data[0].id_concepto ?? null);
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setMessage("Error de conexión al cargar conceptos.");
      setConceptos([]);
      setSelectedId(null);
    } finally {
      setLoadingList(false);
    }
  };

  // FP-03: Crear nuevo concepto
  const createConcepto = async () => {
    setMessage("");
    setSuccessMessage("");
    if (!cuenta) {
      setMessage("No hay cuenta asociada a tu usuario.");
      return;
    }
    if (!form.nombre_concepto.trim()) {
      setMessage("El nombre del concepto es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const url = `${SUPABASE_URL}/rest/v1/rpc/create_concepto`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        body: JSON.stringify({
          p_correo_cuenta: cuenta.correo_cuenta,
          p_nombre_concepto: form.nombre_concepto,
          p_tipo: form.tipo,
          p_periodo: form.periodo,
          p_activo: form.activo,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(
          data?.message || JSON.stringify(data) || "Error al crear concepto"
        );
        setSaving(false);
        return;
      }

      await fetchConceptos();
      if (Array.isArray(data) && data.length)
        setSelectedId(data[0].id_concepto);

      setSuccessMessage("Concepto creado correctamente");
      setForm({
        nombre_concepto: "",
        tipo: false,
        periodo: "Biweekly",
        activo: true,
      });
      setShowForm(false);
    } catch (err) {
      setMessage("Error de conexión al crear concepto");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  // FP-04: Actualizar concepto existente
  const updateConcepto = async () => {
    setMessage("");
    setSuccessMessage("");
    if (!cuenta || !selectedId) {
      setMessage("Selecciona un concepto para editar.");
      return;
    }
    if (!form.nombre_concepto.trim()) {
      setMessage("El nombre del concepto es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const url = `${SUPABASE_URL}/rest/v1/rpc/update_concepto`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        body: JSON.stringify({
          p_id_concepto: selectedId,
          p_nombre_concepto: form.nombre_concepto,
          p_tipo: form.tipo,
          p_periodo: form.periodo,
          p_activo: form.activo,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMessage(data?.message || "Error al actualizar concepto");
        setSaving(false);
        return;
      }

      await fetchConceptos();
      setSuccessMessage("Concepto actualizado correctamente");
      setShowForm(false);
      setIsEditing(false);
    } catch (err) {
      setMessage("Error de conexión al actualizar concepto");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  // FP-05: Preparar formulario para edición
  const handleEdit = () => {
    const selected = conceptos.find((c) => c.id_concepto === selectedId);
    if (selected) {
      setForm({
        nombre_concepto: selected.nombre_concepto || "",
        tipo: selected.tipo || false,
        periodo: selected.periodo || "Biweekly",
        activo: selected.activo !== false,
      });
      setIsEditing(true);
      setShowForm(true);
    }
  };

  // FP-06: Formulario para nuevo concepto
  const handleNew = () => {
    setForm({
      nombre_concepto: "",
      tipo: false,
      periodo: "Biweekly",
      activo: true,
    });
    setIsEditing(false);
    setShowForm(true);
    setSelectedId(null);
  };

  useEffect(() => {
    (async () => {
      await fetchCuenta();
    })();
    // eslint-disable-next-line
  }, [accessToken, user]);

  useEffect(() => {
    if (cuenta) fetchConceptos();
    // eslint-disable-next-line
  }, [cuenta]);

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
      padding: 12,
    },
    topRow: { display: "flex", gap: 20, flexWrap: "wrap" },
    left: { flex: "1 1 360px", minWidth: 320 },
    right: { flex: "1 1 420px", minWidth: 320 },
    bottomRow: { width: "100%" },
    card: {
      padding: 16,
      borderRadius: 10,
      background: "white",
      boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
    },
    conceptCard: {
      padding: 12,
      borderRadius: 8,
      background: "#fff",
      boxShadow: "0 4px 12px rgba(2,6,23,0.04)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      cursor: "pointer",
      border: "2px solid transparent",
      transition: "all 0.2s",
    },
    conceptCardSelected: {
      borderColor: "#0ea5e9",
      background: "#f0f9ff",
    },
    badge: {
      padding: "4px 10px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
    },
    badgeIncome: {
      background: "#d1fae5",
      color: "#065f46",
    },
    badgeExpense: {
      background: "#fee2e2",
      color: "#991b1b",
    },
    periodBadge: {
      padding: "3px 8px",
      borderRadius: 4,
      fontSize: 11,
      background: "#e0e7ff",
      color: "#3730a3",
    },
    btn: {
      padding: "8px 16px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 500,
      transition: "all 0.2s",
    },
    btnPrimary: {
      background: "#0ea5e9",
      color: "#fff",
    },
    btnSecondary: {
      background: "#e0e7ff",
      color: "#3730a3",
    },
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={styles.container}>
        <div style={styles.topRow}>
          <div style={styles.left}>
            <div style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>Conceptos</h3>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
                    Gestiona tus conceptos de ingreso y egreso
                  </p>
                </div>
                <button
                  style={{
                    ...styles.btn,
                    background: "#f3f4f6",
                    color: "#374151",
                  }}
                  onClick={() => {
                    fetchCuenta();
                    fetchConceptos();
                  }}
                >
                  {loadingList ? <Spinner /> : "Refrescar"}
                </button>
              </div>
              {message && (
                <div
                  style={{ color: "#b91c1c", marginBottom: 12, fontSize: 14 }}
                >
                  {message}
                </div>
              )}
              {successMessage && (
                <div
                  style={{ color: "#065f46", marginBottom: 12, fontSize: 14 }}
                >
                  {successMessage}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{ fontWeight: 600, display: "block", marginBottom: 8 }}
                >
                  Cuenta
                </label>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#111827",
                    fontSize: 14,
                  }}
                >
                  {cuenta
                    ? cuenta.nombre_cuenta || cuenta.correo_cuenta
                    : "No hay cuenta disponible"}
                </div>
              </div>

              {!showForm && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...styles.btn, ...styles.btnPrimary }}
                    onClick={handleNew}
                    disabled={!cuenta}
                  >
                    New
                  </button>
                  <button
                    style={{ ...styles.btn, ...styles.btnSecondary }}
                    onClick={handleEdit}
                    disabled={!selectedId}
                  >
                    Edit
                  </button>
                </div>
              )}

              {showForm && (
                <div
                  style={{
                    padding: 16,
                    background: "#f8fafc",
                    borderRadius: 8,
                  }}
                >
                  <h4 style={{ margin: "0 0 12px 0" }}>
                    {isEditing ? "Editar concepto" : "Nuevo concepto"}
                  </h4>
                  <div style={{ display: "grid", gap: 12 }}>
                    <label>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Concept:
                      </div>
                      <input
                        type="text"
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                        value={form.nombre_concepto}
                        onChange={(e) =>
                          setForm({ ...form, nombre_concepto: e.target.value })
                        }
                        placeholder="Nombre del concepto"
                      />
                    </label>

                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Type:
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            checked={form.tipo === true}
                            onChange={() => setForm({ ...form, tipo: true })}
                          />
                          Income
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            checked={form.tipo === false}
                            onChange={() => setForm({ ...form, tipo: false })}
                          />
                          Expense
                        </label>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Period:
                      </div>
                      <select
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                        }}
                        value={form.periodo}
                        onChange={(e) =>
                          setForm({ ...form, periodo: e.target.value })
                        }
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Biweekly">Biweekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        style={{ ...styles.btn, ...styles.btnPrimary }}
                        disabled={saving || !cuenta}
                        onClick={isEditing ? updateConcepto : createConcepto}
                      >
                        {saving ? (
                          <>
                            <Spinner /> Guardando...
                          </>
                        ) : isEditing ? (
                          "Actualizar"
                        ) : (
                          "Crear"
                        )}
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.btn,
                          background: "#f3f4f6",
                          color: "#374151",
                        }}
                        onClick={() => {
                          setShowForm(false);
                          setIsEditing(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={styles.right}>
            <div style={styles.card}>
              <h3 style={{ margin: 0, marginBottom: 16 }}>
                Detalle del concepto
              </h3>
              {!selectedId ? (
                <p style={{ color: "#6b7280" }}>
                  Selecciona un concepto para ver sus detalles.
                </p>
              ) : (
                (() => {
                  const selected = conceptos.find(
                    (c) => c.id_concepto === selectedId
                  );
                  if (!selected)
                    return (
                      <p style={{ color: "#6b7280" }}>
                        Concepto no encontrado.
                      </p>
                    );
                  return (
                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={{ display: "none" }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          ID Concepto
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                          #{selected.id_concepto}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          Nombre
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>
                          {selected.nombre_concepto}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          Tipo
                        </div>
                        <span
                          style={{
                            ...styles.badge,
                            ...(selected.tipo
                              ? styles.badgeIncome
                              : styles.badgeExpense),
                          }}
                        >
                          {selected.tipo ? "Income" : "Expense"}
                        </span>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          Periodo
                        </div>
                        <span style={styles.periodBadge}>
                          {selected.periodo}
                        </span>
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 4,
                          }}
                        >
                          Cuenta asociada
                        </div>
                        <div style={{ fontSize: 14 }}>
                          {selected.correo_cuenta}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        <div style={styles.bottomRow}>
          <div style={styles.card}>
            <h3 style={{ margin: 0, marginBottom: 16 }}>Lista de Conceptos</h3>
            {loadingList ? (
              <p>
                <Spinner /> Cargando...
              </p>
            ) : conceptos.length === 0 ? (
              <p
                style={{
                  color: "#6b7280",
                  textAlign: "center",
                  padding: "20px 0",
                }}
              >
                No tienes conceptos creados todavía.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                {conceptos.map((c) => (
                  <div
                    key={c.id_concepto}
                    style={{
                      ...styles.conceptCard,
                      ...(selectedId === c.id_concepto
                        ? styles.conceptCardSelected
                        : {}),
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                    onClick={() => setSelectedId(c.id_concepto)}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 8,
                        fontSize: 15,
                      }}
                    >
                      {c.nombre_concepto}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          ...styles.badge,
                          ...(c.tipo
                            ? styles.badgeIncome
                            : styles.badgeExpense),
                        }}
                      >
                        {c.tipo ? "Income" : "Expense"}
                      </span>
                      <span style={styles.periodBadge}>{c.periodo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
