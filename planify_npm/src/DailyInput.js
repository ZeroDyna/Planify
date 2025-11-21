import React, { useEffect, useState } from "react";

/**
 * DailyInput (MK-009) - Vista para registrar ingresos y gastos diarios.
 * Usa movimiento_concepto cuando se selecciona un concepto
 * Usa movimiento_espontaneo cuando se ingresa un motivo libre
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user (se usa su email para filtrar)
 *
 */

export default function DailyInput({
  SUPABASE_URL,
  SUPABASE_KEY,
  accessToken,
  user,
}) {
  // Estado de la UI
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [cuenta, setCuenta] = useState(null);
  const [conceptosIncome, setConceptosIncome] = useState([]);
  const [conceptosExpense, setConceptosExpense] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [invalidModal, setInvalidModal] = useState(false); // MK-009-E
  const [form, setForm] = useState({
    useConcepto: false,
    conceptoId: "",
    motivo: "",
    monto: "",
    tipo: false, // false=expense, true=income
  });
  const [totales, setTotales] = useState({ income: 0, expense: 0 });

  // Cabeceras
  const headersBase = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
  };
  const headersAuth = accessToken
    ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
    : headersBase;

  /* --------------------------------------------------------------------------
   * fetchCuenta
   * Auxiliar: obtiene la cuenta asociada al user.email y la guarda en state.
   * ----------------------------------------------------------------------- */
  const fetchCuenta = async () => {
    setMessage("");
    try {
      const email = user?.email || user?.correo || null;
      if (!email) {
        setMessage("Inicia sesión para usar Daily Input.");
        setCuenta(null);
        return;
      }
      const url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&correo_usuario=eq.${encodeURIComponent(
        email
      )}&limit=1`;
      const res = await fetch(url, { headers: headersAuth });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error fetchCuenta:", res.status, errorText);
        setMessage(`Error al obtener cuenta: ${res.status}`);
        setCuenta(null);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        setCuenta({
          correo_cuenta: data[0].correo_cuenta,
          nombre_cuenta: data[0].nombre_cuenta || data[0].correo_cuenta,
        });
      } else {
        setCuenta(null);
        setMessage("No hay cuenta asociada a este usuario.");
      }
    } catch (err) {
      console.error("fetchCuenta error", err);
      setMessage("Error de conexión al obtener la cuenta.");
      setCuenta(null);
    }
  };

  /* --------------------------------------------------------------------------
   * FP-42: fetchConceptosByType
   * Obtiene conceptos activos de la cuenta y los separa en Income / Expense.
   * ----------------------------------------------------------------------- */
  const fetchConceptosByType = async () => {
    if (!cuenta) {
      console.log("No hay cuenta, no se pueden cargar conceptos");
      setConceptosIncome([]);
      setConceptosExpense([]);
      return;
    }
    try {
      const url = `${SUPABASE_URL}/rest/v1/concepto?select=*&correo_cuenta=eq.${encodeURIComponent(
        cuenta.correo_cuenta
      )}&activo=eq.true&order=id_concepto.asc`;
      console.log("Fetching conceptos from:", url);
      const res = await fetch(url, { headers: headersAuth });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error fetchConceptos:", res.status, errorText);
        setMessage("Error al cargar conceptos.");
        setConceptosIncome([]);
        setConceptosExpense([]);
        return;
      }

      const data = await res.json();
      console.log("Conceptos cargados desde DB:", data);
      const incomes = (data || []).filter((c) => c.tipo === true);
      const expenses = (data || []).filter((c) => c.tipo === false);
      console.log("Conceptos Income filtrados:", incomes);
      console.log("Conceptos Expense filtrados:", expenses);
      setConceptosIncome(incomes);
      setConceptosExpense(expenses);
    } catch (err) {
      console.error("fetchConceptosByType error", err);
      setMessage("Error de conexión al cargar conceptos.");
      setConceptosIncome([]);
      setConceptosExpense([]);
    }
  };

  /* --------------------------------------------------------------------------
   * FP-43: fetchMovementsForDate
   * Carga movimientos activos para la fecha y calcula totales.
   * Obtiene tanto movimiento_concepto como movimiento_espontaneo.
   * ----------------------------------------------------------------------- */
  const fetchMovementsForDate = async (dateStr) => {
    if (!cuenta) {
      setMovimientos([]);
      setTotales({ income: 0, expense: 0 });
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      // Obtener movimientos con concepto
      const urlConcepto = `${SUPABASE_URL}/rest/v1/movimiento_concepto?select=*,concepto:id_concepto(nombre_concepto,tipo)&fecha_operacion=eq.${encodeURIComponent(
        dateStr
      )}&correo_cuenta=eq.${encodeURIComponent(
        cuenta.correo_cuenta
      )}&order=id_movimiento_concepto.asc`;

      const resConcepto = await fetch(urlConcepto, { headers: headersAuth });

      // Obtener movimientos espontáneos
      const urlEspontaneo = `${SUPABASE_URL}/rest/v1/movimiento_espontaneo?select=*&fecha_operacion=eq.${encodeURIComponent(
        dateStr
      )}&correo_cuenta=eq.${encodeURIComponent(
        cuenta.correo_cuenta
      )}&order=id_movimiento_espontaneo.asc`;

      const resEspontaneo = await fetch(urlEspontaneo, {
        headers: headersAuth,
      });

      let allMovements = [];

      if (resConcepto.ok) {
        const dataConcepto = await resConcepto.json();
        const movConcepto = (dataConcepto || []).map((m) => ({
          ...m,
          sourceTable: "concepto",
          nombre: m.concepto?.nombre_concepto || "Concepto",
          tipo: m.concepto?.tipo || false,
          id: m.id_movimiento_concepto,
        }));
        allMovements = [...allMovements, ...movConcepto];
      }

      if (resEspontaneo.ok) {
        const dataEspontaneo = await resEspontaneo.json();
        const movEspontaneo = (dataEspontaneo || []).map((m) => ({
          ...m,
          sourceTable: "espontaneo",
          nombre: m.motivo || "Sin motivo",
          id: m.id_movimiento_espontaneo,
        }));
        allMovements = [...allMovements, ...movEspontaneo];
      }

      console.log("All movements loaded:", allMovements);
      setMovimientos(allMovements);
      calculateTotals(allMovements);
    } catch (err) {
      console.error("fetchMovementsForDate error", err);
      setMessage("Error de conexión al cargar movimientos.");
      setMovimientos([]);
      setTotales({ income: 0, expense: 0 });
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------------------
   * FP-44: handleDateChange
   * Maneja cambio de fecha (no permite fecha futura) y recarga movimientos.
   * ----------------------------------------------------------------------- */
  const handleDateChange = async (newDate) => {
    const today = new Date().toISOString().slice(0, 10);
    if (newDate > today) {
      setMessage("La fecha no puede ser futura.");
      return;
    }
    setFecha(newDate);
    await fetchMovementsForDate(newDate);
  };

  /* --------------------------------------------------------------------------
   * FP-45: openAddMovementModal
   * Abre el modal para añadir movimiento y resetea formulario.
   * ----------------------------------------------------------------------- */
  const openAddMovementModal = (tipo = false) => {
    console.log("Opening modal with tipo:", tipo);
    console.log("Available incomes:", conceptosIncome);
    console.log("Available expenses:", conceptosExpense);
    setForm({
      useConcepto: false,
      conceptoId: "",
      motivo: "",
      monto: "",
      tipo,
    });
    setShowAddModal(true);
    setMessage("");
  };

  /* --------------------------------------------------------------------------
   * FP-46: validateMovement
   * Valida nombre/motivo (obligatorio ≤30 o ≤100), monto (>0, 2 decimales) y fecha ≤ hoy.
   * Retorna { ok: boolean, reason?: string }.
   * ----------------------------------------------------------------------- */
  const validateMovement = (movement) => {
    const { useConcepto, conceptoId, motivo, monto } = movement;
    const today = new Date().toISOString().slice(0, 10);

    if (!fecha || fecha > today) return { ok: false, reason: "Fecha inválida" };

    if (useConcepto) {
      if (!conceptoId) return { ok: false, reason: "Selecciona un concepto" };
    } else {
      if (!motivo || motivo.trim().length === 0)
        return { ok: false, reason: "Motivo obligatorio" };
      if (motivo.trim().length > 100)
        return { ok: false, reason: "Motivo demasiado largo (máx 100)" };
    }

    const m = Number(monto);
    if (isNaN(m) || m <= 0) return { ok: false, reason: "Monto inválido" };
    if (!/^\d+(\.\d{1,2})?$/.test(String(monto)))
      return { ok: false, reason: "Formato: hasta 2 decimales" };
    return { ok: true };
  };

  /* --------------------------------------------------------------------------
   * FP-47: addMovement
   * Inserta movimiento (concepto o espontáneo); luego refresca movimientos y totales.
   * ----------------------------------------------------------------------- */
  const addMovement = async (movement) => {
    setSaving(true);
    setMessage("");
    try {
      const valid = validateMovement(movement);
      if (!valid.ok) {
        setInvalidModal(true);
        setMessage(valid.reason);
        setSaving(false);
        return;
      }
      if (!cuenta) {
        setMessage("No hay cuenta asociada.");
        setSaving(false);
        return;
      }

      let res;

      if (movement.useConcepto) {
        // Usar movimiento_concepto
        const body = {
          correo_cuenta: cuenta.correo_cuenta,
          contador: 1,
          fecha_operacion: fecha,
          monto: Number(movement.monto),
          id_concepto: Number(movement.conceptoId),
        };

        console.log("Creating movimiento_concepto:", body);

        res = await fetch(`${SUPABASE_URL}/rest/v1/movimiento_concepto`, {
          method: "POST",
          headers: {
            ...headersAuth,
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
      } else {
        // Usar movimiento_espontaneo
        const body = {
          correo_cuenta: cuenta.correo_cuenta,
          contador: 1,
          fecha_operacion: fecha,
          motivo: movement.motivo.trim(),
          tipo: movement.tipo,
          monto: Number(movement.monto),
        };

        console.log("Creating movimiento_espontaneo:", body);

        res = await fetch(`${SUPABASE_URL}/rest/v1/movimiento_espontaneo`, {
          method: "POST",
          headers: {
            ...headersAuth,
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error("addMovement error:", res.status, errorText);
        setMessage(`Error al guardar: ${errorText || res.status}`);
        setSaving(false);
        return;
      }

      const data = await res.json();
      console.log("Movement created:", data);

      await fetchMovementsForDate(fecha);
      setShowAddModal(false);
      setMessage("Movimiento guardado correctamente");
    } catch (err) {
      console.error("addMovement exception", err);
      setMessage("Error de conexión al crear movimiento.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
   * FP-48: deleteMovement
   * Borrado físico: DELETE según sourceTable (concepto o espontáneo), luego refresca.
   * ----------------------------------------------------------------------- */
  const deleteMovement = async (movement) => {
    if (!window.confirm("¿Eliminar movimiento?")) return;
    try {
      let url;
      if (movement.sourceTable === "concepto") {
        url = `${SUPABASE_URL}/rest/v1/movimiento_concepto?id_movimiento_concepto=eq.${movement.id}`;
      } else {
        url = `${SUPABASE_URL}/rest/v1/movimiento_espontaneo?id_movimiento_espontaneo=eq.${movement.id}`;
      }

      const res = await fetch(url, {
        method: "DELETE",
        headers: headersAuth,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("deleteMovement error:", res.status, errorText);
        setMessage(`Error al eliminar: ${errorText || res.status}`);
        return;
      }

      await fetchMovementsForDate(fecha);
      setMessage("Movimiento eliminado correctamente");
    } catch (err) {
      console.error("deleteMovement error", err);
      setMessage("Error al eliminar movimiento.");
    }
  };

  /* --------------------------------------------------------------------------
   * FP-49: calculateTotals
   * Calcula totales de incomes y expenses a partir de la lista de movimientos.
   * ----------------------------------------------------------------------- */
  const calculateTotals = (movs) => {
    const inc = (movs || [])
      .filter((m) => m.tipo === true)
      .reduce((s, m) => s + Number(m.monto || 0), 0);
    const exp = (movs || [])
      .filter((m) => m.tipo === false)
      .reduce((s, m) => s + Number(m.monto || 0), 0);
    setTotales({ income: inc, expense: exp });
  };

  /* --------------------------------------------------------------------------
   * FP-41: initDailyInput
   * Inicializa la vista: obtiene cuenta, conceptos y movimientos para la fecha.
   * ----------------------------------------------------------------------- */
  const initDailyInput = async () => {
    console.log("=== Iniciando DailyInput ===");
    setLoading(true);
    setMessage("");
    await fetchCuenta();
    // fetchConceptosByType se llama desde useEffect cuando cuenta está lista
    await fetchMovementsForDate(fecha);
    setLoading(false);
    console.log("=== DailyInput inicializado ===");
  };

  // Inicializar al montar o cuando cambian user/accessToken
  useEffect(() => {
    initDailyInput();
  }, [user, accessToken]);

  // Cargar conceptos cuando la cuenta esté lista
  useEffect(() => {
    if (cuenta) {
      console.log("Cuenta cargada, obteniendo conceptos para:", cuenta);
      fetchConceptosByType();
    }
  }, [cuenta]);

  // Helper de formato
  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  /* --------------------------
   * Estilos inline (más agradables)
   * ------------------------- */
  const styles = {
    container: {
      padding: 18,
      maxWidth: 1100,
      margin: "0 auto",
      fontFamily: "Inter, Roboto, sans-serif",
      color: "#111827",
    },
    card: {
      background: "#fff",
      borderRadius: 8,
      boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
      padding: 14,
    },
    columnHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalBadge: {
      padding: "8px 12px",
      borderRadius: 8,
      background: "#f1f5f9",
      fontWeight: 700,
    },
    btnPrimary: {
      background: "linear-gradient(135deg,#06b6d4,#6366f1)",
      color: "#fff",
      border: "none",
      padding: "8px 12px",
      borderRadius: 8,
      cursor: "pointer",
    },
    btnGhost: {
      background: "white",
      border: "1px solid #e5e7eb",
      padding: "8px 12px",
      borderRadius: 8,
      cursor: "pointer",
    },
    table: { width: "100%", borderCollapse: "collapse", marginTop: 8 },
    th: {
      textAlign: "left",
      padding: "8px 6px",
      color: "#6b7280",
      fontSize: 13,
    },
    td: { padding: "8px 6px", borderTop: "1px solid #f3f4f6" },
    modalOverlay: {
      position: "fixed",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      background: "rgba(2,6,23,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    },
    modal: {
      background: "white",
      padding: 20,
      borderRadius: 10,
      width: 420,
      boxShadow: "0 12px 40px rgba(2,6,23,0.12)",
    },
    smallMuted: { fontSize: 13, color: "#6b7280" },
  };

  // Seleccionar conceptos según el tipo del movimiento
  const conceptosDisponibles = form.tipo ? conceptosIncome : conceptosExpense;

  console.log("Form tipo:", form.tipo);
  console.log("Conceptos Income:", conceptosIncome);
  console.log("Conceptos Expense:", conceptosExpense);
  console.log("Conceptos disponibles:", conceptosDisponibles);

  // Render
  return (
    <div style={styles.container}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Daily Input (MK-009)</h3>
          <div style={styles.smallMuted}>
            Registrar ingresos y gastos por fecha
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => handleDateChange(e.target.value)}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            />
          </div>
          <button
            onClick={() => initDailyInput()}
            style={styles.btnGhost}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            color: message.includes("correctamente") ? "#059669" : "#b91c1c",
            marginBottom: 12,
            padding: 10,
            background: message.includes("correctamente")
              ? "#d1fae5"
              : "#fee2e2",
            borderRadius: 6,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "stretch",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1, ...styles.card }}>
          <div style={styles.columnHeader}>
            <div>
              <strong>Incomes</strong>
              <div style={styles.smallMuted}>Conceptos activos</div>
            </div>
            <div style={styles.totalBadge}>
              {formatCurrency(totales.income)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {conceptosIncome.length === 0 ? (
              <div style={styles.smallMuted}>No hay conceptos de ingreso</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {conceptosIncome.map((c) => (
                  <div
                    key={c.id_concepto}
                    style={{
                      padding: "4px 8px",
                      background: "#f1f5f9",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#374151",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {c.nombre_concepto}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => openAddMovementModal(true)}
                style={styles.btnPrimary}
              >
                Add Income
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, ...styles.card }}>
          <div style={styles.columnHeader}>
            <div>
              <strong>Expenses</strong>
              <div style={styles.smallMuted}>Conceptos activos</div>
            </div>
            <div style={{ ...styles.totalBadge, background: "#fff1f2" }}>
              {formatCurrency(totales.expense)}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {conceptosExpense.length === 0 ? (
              <div style={styles.smallMuted}>No hay conceptos de gasto</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {conceptosExpense.map((c) => (
                  <div
                    key={c.id_concepto}
                    style={{
                      padding: "4px 8px",
                      background: "#fef2f2",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "#374151",
                      border: "1px solid #fecaca",
                    }}
                  >
                    {c.nombre_concepto}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => openAddMovementModal(false)}
                style={styles.btnPrimary}
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Movimientos — {fecha}</strong>
            <div style={styles.smallMuted}>
              Lista de movimientos registrados
            </div>
          </div>
          <button onClick={() => initDailyInput()} style={styles.btnGhost}>
            Actualizar
          </button>
        </div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Descripción</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Origen</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Valor</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...styles.td, color: "#6b7280" }}>
                  No hay movimientos para esta fecha.
                </td>
              </tr>
            ) : (
              movimientos.map((m, idx) => (
                <tr key={`${m.sourceTable}-${m.id}-${idx}`}>
                  <td style={styles.td}>{m.nombre}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        background: m.tipo ? "#d1fae5" : "#fee2e2",
                        color: m.tipo ? "#065f46" : "#991b1b",
                      }}
                    >
                      {m.tipo ? "Income" : "Expense"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        background:
                          m.sourceTable === "concepto" ? "#e0e7ff" : "#fef3c7",
                        color:
                          m.sourceTable === "concepto" ? "#3730a3" : "#92400e",
                      }}
                    >
                      {m.sourceTable === "concepto" ? "Concepto" : "Libre"}
                    </span>
                  </td>
                  <td
                    style={{
                      ...styles.td,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {formatCurrency(m.monto)}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button
                      onClick={() => deleteMovement(m)}
                      style={{
                        ...styles.btnGhost,
                        fontSize: 12,
                        padding: "4px 8px",
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Añadir movimiento */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginTop: 0 }}>
              Añadir movimiento — {form.tipo ? "Income" : "Expense"}
            </h4>

            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 6,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.useConcepto}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      useConcepto: e.target.checked,
                      conceptoId: "",
                      motivo: "",
                    }))
                  }
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 500 }}>Usar concepto existente</span>
              </label>
            </div>

            {form.useConcepto ? (
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
                >
                  Concepto {form.tipo ? "(Ingresos)" : "(Gastos)"}
                </label>
                {conceptosDisponibles.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      background: "#fef3c7",
                      borderRadius: 6,
                      color: "#92400e",
                      fontSize: 14,
                    }}
                  >
                    No hay conceptos de {form.tipo ? "ingreso" : "gasto"}{" "}
                    disponibles.
                    <br />
                    Crea conceptos primero en la sección de Configuración.
                  </div>
                ) : (
                  <select
                    value={form.conceptoId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, conceptoId: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <option value="">Selecciona un concepto</option>
                    {conceptosDisponibles.map((c) => (
                      <option key={c.id_concepto} value={c.id_concepto}>
                        {c.nombre_concepto}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <label
                  style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
                >
                  Motivo
                </label>
                <input
                  type="text"
                  value={form.motivo}
                  maxLength={100}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, motivo: e.target.value }))
                  }
                  placeholder="Ej: Transporte, Salario"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
              >
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monto: e.target.value }))
                }
                placeholder="0.00"
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                onClick={() => setShowAddModal(false)}
                style={styles.btnGhost}
              >
                Cancelar
              </button>
              <button
                onClick={() => addMovement(form)}
                disabled={saving}
                style={styles.btnPrimary}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Valor inválido (MK-009-E) */}
      {invalidModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, width: 360 }}>
            <h4 style={{ marginTop: 0 }}>Incorrect Value (MK-009-E)</h4>
            <div style={{ marginBottom: 12 }}>{message}</div>
            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => {
                  setInvalidModal(false);
                  setMessage("");
                }}
                style={styles.btnPrimary}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
