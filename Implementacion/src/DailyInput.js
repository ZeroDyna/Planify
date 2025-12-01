import React, { useEffect, useState } from "react";

/**
 * DailyInput (MK-009) - Vista para registrar ingresos y gastos diarios.
 * Usa movimiento_concepto cuando se selecciona un concepto
 * Usa movimiento_espontaneo cuando se ingresa un motivo libre
 *
 * ACTUALIZACIÓN: llamadas a BD reemplazadas por RPC en Supabase.
 * Se reutilizan funciones RPC creadas para Balance (get_cuenta_by_email, get_movements_range, get_all_active_movements)
 * y se agregan RPC para conceptos e inserciones/borrados:
 * - get_conceptos_by_cuenta(correo)
 * - insert_movimiento_concepto(...)
 * - insert_movimiento_espontaneo(...)
 * - delete_movimiento_concepto_by_id(id)
 * - delete_movimiento_espontaneo_by_id(id)
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
   * Ahora usa RPC: get_cuenta_by_email
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

      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_cuenta_by_email`, {
        method: "POST",
        headers: headersAuth,
        body: JSON.stringify({ correo: email }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => null);
        console.error("Error fetchCuenta (RPC):", res.status, errorText);
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
   * Ahora usa RPC: get_conceptos_by_cuenta
   * ----------------------------------------------------------------------- */
  const fetchConceptosByType = async () => {
    if (!cuenta) {
      console.log("No hay cuenta, no se pueden cargar conceptos");
      setConceptosIncome([]);
      setConceptosExpense([]);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_conceptos_by_cuenta`, {
        method: "POST",
        headers: headersAuth,
        body: JSON.stringify({ correo: cuenta.correo_cuenta }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => null);
        console.error("Error fetchConceptos (RPC):", res.status, errorText);
        setMessage("Error al cargar conceptos.");
        setConceptosIncome([]);
        setConceptosExpense([]);
        return;
      }

      const data = await res.json();
      const incomes = (data || []).filter((c) => c.tipo === true);
      const expenses = (data || []).filter((c) => c.tipo === false);
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
   * Usa RPC get_movements_range (start_date == end_date == dateStr)
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
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_movements_range`, {
        method: "POST",
        headers: headersAuth,
        body: JSON.stringify({
          correo: cuenta.correo_cuenta,
          start_date: dateStr,
          end_date: dateStr,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => null);
        console.error("Error fetchMovementsForDate (RPC):", res.status, errorText);
        setMessage("Error al cargar movimientos.");
        setMovimientos([]);
        setTotales({ income: 0, expense: 0 });
        return;
      }

      const data = await res.json().catch(() => []);
      // Data items from RPC may use snake_case (nombre_movimiento, source_table, id)
      // Normalize to the shape used by the component: { nombre, tipo, monto, correo_cuenta, sourceTable, id }
      const allMovements = (data || []).map((m) => ({
        ...m,
        nombre: m.nombre_movimiento ?? m.nombre ?? "",
        tipo: m.tipo === undefined ? false : m.tipo,
        monto: m.monto ?? 0,
        correo_cuenta: m.correo_cuenta ?? m.correoCuenta ?? "",
        sourceTable: m.source_table ?? m.sourceTable ?? "espontaneo",
        id: m.id ?? m.id_movimiento_concepto ?? m.id_movimiento_espontaneo ?? null,
      }));

      console.log("All movements loaded (RPC):", allMovements);
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
   * Inserta movimiento (concepto o espontáneo) vía RPC; luego refresca movimientos y totales.
   * RPCs esperadas:
   * - insert_movimiento_concepto(correo_cuenta, contador, fecha_operacion, monto, id_concepto)
   * - insert_movimiento_espontaneo(correo_cuenta, contador, fecha_operacion, motivo, tipo, monto)
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
        // Usar RPC para insertar movimiento_concepto
        const body = {
          p_correo_cuenta: cuenta.correo_cuenta,
          p_contador: 1,
          p_fecha_operacion: fecha,
          p_monto: Number(movement.monto),
          p_id_concepto: Number(movement.conceptoId),
        };

        console.log("RPC insert_movimiento_concepto:", body);

        res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_movimiento_concepto`, {
          method: "POST",
          headers: {
            ...headersAuth,
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
      } else {
        // Usar RPC para insertar movimiento_espontaneo
        const body = {
          p_correo_cuenta: cuenta.correo_cuenta,
          p_contador: 1,
          p_fecha_operacion: fecha,
          p_motivo: movement.motivo.trim(),
          p_tipo: movement.tipo,
          p_monto: Number(movement.monto),
        };

        console.log("RPC insert_movimiento_espontaneo:", body);

        res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_movimiento_espontaneo`, {
          method: "POST",
          headers: {
            ...headersAuth,
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => null);
        console.error("addMovement error (RPC):", res.status, errorText);
        setMessage(`Error al guardar: ${errorText || res.status}`);
        setSaving(false);
        return;
      }

      const data = await res.json().catch(() => null);
      console.log("Movement created (RPC):", data);

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
   * Borrado físico vía RPC por id según sourceTable, luego refresca.
   * RPCs esperadas:
   * - delete_movimiento_concepto_by_id(id)
   * - delete_movimiento_espontaneo_by_id(id)
   * ----------------------------------------------------------------------- */
  const deleteMovement = async (movement) => {
    if (!window.confirm("¿Eliminar movimiento?")) return;
    try {
      let res;
      if (movement.sourceTable === "concepto") {
        res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_movimiento_concepto_by_id`, {
          method: "POST",
          headers: headersAuth,
          body: JSON.stringify({ id: movement.id }),
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_movimiento_espontaneo_by_id`, {
          method: "POST",
          headers: headersAuth,
          body: JSON.stringify({ id: movement.id }),
        });
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => null);
        console.error("deleteMovement error (RPC):", res.status, errorText);
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
    // fetchConceptosByType se llama desde useEffect cuando cuenta esté lista
    await fetchMovementsForDate(fecha);
    setLoading(false);
    console.log("=== DailyInput inicializado ===");
  };

  // Inicializar al montar o cuando cambian user/accessToken
  useEffect(() => {
    initDailyInput();
    // eslint-disable-next-line
  }, [user, accessToken]);

  // Cargar conceptos cuando la cuenta esté lista
  useEffect(() => {
    if (cuenta) {
      console.log("Cuenta cargada, obteniendo conceptos para:", cuenta);
      fetchConceptosByType();
    }
    // eslint-disable-next-line
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
          <h3 style={{ margin: 0 }}>Daily Input</h3>
          <div style={styles.smallMuted}>Registrar ingresos y gastos por fecha</div>
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
          <button onClick={() => initDailyInput()} style={styles.btnGhost} disabled={loading}>
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
            background: message.includes("correctamente") ? "#d1fae5" : "#fee2e2",
            borderRadius: 6,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
        <div style={{ flex: 1, ...styles.card }}>
          <div style={styles.columnHeader}>
            <div>
              <strong>Incomes</strong>
              <div style={styles.smallMuted}>Conceptos activos</div>
            </div>
            <div style={styles.totalBadge}>{formatCurrency(totales.income)}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            {conceptosIncome.length === 0 ? (
              <div style={styles.smallMuted}>No hay conceptos de ingreso</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
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
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => openAddMovementModal(true)} style={styles.btnPrimary}>
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
            <div style={{ ...styles.totalBadge, background: "#fff1f2" }}>{formatCurrency(totales.expense)}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            {conceptosExpense.length === 0 ? (
              <div style={styles.smallMuted}>No hay conceptos de gasto</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
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
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => openAddMovementModal(false)} style={styles.btnPrimary}>
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Movimientos — {fecha}</strong>
            <div style={styles.smallMuted}>Lista de movimientos registrados</div>
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
                <tr key={`${m.sourceTable}-${m.id || idx}`}>
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
                        background: m.sourceTable === "concepto" ? "#e0e7ff" : "#fef3c7",
                        color: m.sourceTable === "concepto" ? "#3730a3" : "#92400e",
                      }}
                    >
                      {m.sourceTable === "concepto" ? "Concepto" : "Libre"}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(m.monto)}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button onClick={() => deleteMovement(m)} style={{ ...styles.btnGhost, fontSize: 12, padding: "4px 8px" }}>
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
            <h4 style={{ marginTop: 0 }}>Añadir movimiento — {form.tipo ? "Income" : "Expense"}</h4>

            <div style={{ marginBottom: 16, padding: 12, background: "#f9fafb", borderRadius: 6 }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
                  Concepto {form.tipo ? "(Ingresos)" : "(Gastos)"}
                </label>
                {conceptosDisponibles.length === 0 ? (
                  <div style={{ padding: 12, background: "#fef3c7", borderRadius: 6, color: "#92400e", fontSize: 14 }}>
                    No hay conceptos de {form.tipo ? "ingreso" : "gasto"} disponibles.
                    <br />
                    Crea conceptos primero en la sección de Configuración.
                  </div>
                ) : (
                  <select
                    value={form.conceptoId}
                    onChange={(e) => setForm((f) => ({ ...f, conceptoId: e.target.value }))}
                    style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
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
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Motivo</label>
                <input
                  type="text"
                  value={form.motivo}
                  maxLength={100}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  placeholder="Ej: Transporte, Salario"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Monto</label>
              <input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                placeholder="0.00"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowAddModal(false)} style={styles.btnGhost}>
                Cancelar
              </button>
              <button onClick={() => addMovement(form)} disabled={saving} style={styles.btnPrimary}>
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