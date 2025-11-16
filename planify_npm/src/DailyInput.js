import React, { useEffect, useState } from "react";

/**
 * DailyInput (MK-009) - Vista para registrar ingresos y gastos diarios.
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user (se usa su email para filtrar)
 *
 * Implementa borrado lógico (activo = false).
 * Funciones importantes documentadas con FP-41 .. FP-50.
 *
 * Comentarios: todos en español.
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
    const [form, setForm] = useState({ nombre: "", monto: "", tipo: "expense" }); // tipo = 'income'|'expense'
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
     * FP-41: initDailyInput
     * Inicializa la vista: obtiene cuenta, conceptos y movimientos para la fecha.
     * ----------------------------------------------------------------------- */
    const initDailyInput = async () => {
        setLoading(true);
        setMessage("");
        await fetchCuenta();
        await fetchConceptosByType();
        await fetchMovementsForDate(fecha);
        setLoading(false);
    };

    /* --------------------------------------------------------------------------
     * FP-42: fetchConceptosByType
     * Obtiene conceptos activos de la cuenta y los separa en Income / Expense.
     * ----------------------------------------------------------------------- */
    const fetchConceptosByType = async () => {
        if (!cuenta) {
            setConceptosIncome([]);
            setConceptosExpense([]);
            return;
        }
        try {
            const url = `${SUPABASE_URL}/rest/v1/concepto?select=*&correo_cuenta=eq.${encodeURIComponent(
                cuenta.correo_cuenta,
            )}&activo=eq.true&order=id_concepto.asc`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                setMessage("Error al cargar conceptos.");
                setConceptosIncome([]);
                setConceptosExpense([]);
                return;
            }
            const data = await res.json();
            setConceptosIncome((data || []).filter((c) => c.tipo === true));
            setConceptosExpense((data || []).filter((c) => c.tipo === false));
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
            const url = `${SUPABASE_URL}/rest/v1/movimiento?select=*&fecha=eq.${encodeURIComponent(
                dateStr,
            )}&correo_cuenta=eq.${encodeURIComponent(cuenta.correo_cuenta)}&activo=eq.true&order=id_movimiento.asc`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                setMessage("Error al cargar movimientos.");
                setMovimientos([]);
                setTotales({ income: 0, expense: 0 });
                setLoading(false);
                return;
            }
            const data = await res.json();
            setMovimientos(data || []);
            calculateTotals(data || []);
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
    const openAddMovementModal = (tipo = "expense") => {
        setForm({ nombre: "", monto: "", tipo });
        setShowAddModal(true);
        setMessage("");
    };

    /* --------------------------------------------------------------------------
     * FP-46: validateMovement
     * Valida nombre (obligatorio ≤30), monto (>0, 2 decimales) y fecha ≤ hoy.
     * Retorna { ok: boolean, reason?: string }.
     * ----------------------------------------------------------------------- */
    const validateMovement = (movement) => {
        const { nombre, monto } = movement;
        const today = new Date().toISOString().slice(0, 10);
        if (!fecha || fecha > today) return { ok: false, reason: "Fecha inválida" };
        if (!nombre || nombre.trim().length === 0)
            return { ok: false, reason: "Nombre obligatorio" };
        if (nombre.trim().length > 30)
            return { ok: false, reason: "Nombre demasiado largo (máx 30)" };
        const m = Number(monto);
        if (isNaN(m) || m <= 0) return { ok: false, reason: "Monto inválido" };
        if (!/^\d+(\.\d{1,2})?$/.test(String(monto)))
            return { ok: false, reason: "Formato: hasta 2 decimales" };
        return { ok: true };
    };

    /* --------------------------------------------------------------------------
     * FP-47: addMovement
     * Inserta movimiento con activo=true; luego refresca movimientos y totales.
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
            const body = {
                correo_cuenta: cuenta.correo_cuenta,
                nombre_movimiento: movement.nombre.trim(),
                monto: Number(movement.monto),
                tipo: movement.tipo, // 'income'|'expense'
                fecha,
                activo: true,
            };
            const res = await fetch(`${SUPABASE_URL}/rest/v1/movimiento`, {
                method: "POST",
                headers: {
                    ...headersBase,
                    apikey: SUPABASE_KEY,
                    Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    Prefer: "return=representation",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                console.error("addMovement error", res.status, data);
                setMessage(data?.message || "Error al guardar movimiento");
                setSaving(false);
                return;
            }
            await fetchMovementsForDate(fecha);
            setShowAddModal(false);
        } catch (err) {
            console.error("addMovement exception", err);
            setMessage("Error de conexión al crear movimiento.");
        } finally {
            setSaving(false);
        }
    };

    /* --------------------------------------------------------------------------
     * FP-48: deleteMovement
     * Borrado lógico: PATCH activo=false para id_movimiento, luego refresca.
     * ----------------------------------------------------------------------- */
    const deleteMovement = async (id) => {
        if (!window.confirm("¿Eliminar movimiento?")) return;
        try {
            const url = `${SUPABASE_URL}/rest/v1/movimiento?id_movimiento=eq.${id}`;
            const res = await fetch(url, {
                method: "PATCH",
                headers: {
                    ...headersBase,
                    apikey: SUPABASE_KEY,
                    Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ activo: false }),
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => null);
                setMessage(`Error al eliminar movimiento: ${txt || res.status}`);
                return;
            }
            await fetchMovementsForDate(fecha);
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
            .filter((m) => m.tipo === "income")
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        const exp = (movs || [])
            .filter((m) => m.tipo === "expense")
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        setTotales({ income: inc, expense: exp });
    };

    /* --------------------------------------------------------------------------
     * FP-50: showInvalidValueModal (MK-009-E)
     * Muestra modal con "Enter a valid value" y botón OK para cerrar.
     * ----------------------------------------------------------------------- */
    const showInvalidValueModal = () => {
        setInvalidModal(true);
    };

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
                email,
            )}&limit=1`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                setMessage("No se pudo obtener la cuenta.");
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

    // Inicializar al montar o cuando cambian user/accessToken
    useEffect(() => {
        initDailyInput();
        // eslint-disable-next-line
    }, [user, accessToken]);

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
        headerRow: {
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginBottom: 12,
        },
        card: {
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
            padding: 14,
        },
        columns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
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
                <div style={{ color: "#b91c1c", marginBottom: 12 }}>{message}</div>
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
                            conceptosIncome.map((c) => (
                                <div
                                    key={c.id_concepto}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "8px 0",
                                        borderBottom: "1px dashed #f1f5f9",
                                    }}
                                >
                                    <div>{c.nombre_concepto}</div>
                                    <div style={{ color: "#6b7280" }}> </div>
                                </div>
                            ))
                        )}
                        <div
                            style={{
                                marginTop: 12,
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                onClick={() => openAddMovementModal("income")}
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
                            conceptosExpense.map((c) => (
                                <div
                                    key={c.id_concepto}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "8px 0",
                                        borderBottom: "1px dashed #f1f5f9",
                                    }}
                                >
                                    <div>{c.nombre_concepto}</div>
                                    <div style={{ color: "#6b7280" }}> </div>
                                </div>
                            ))
                        )}
                        <div
                            style={{
                                marginTop: 12,
                                display: "flex",
                                justifyContent: "flex-end",
                            }}
                        >
                            <button
                                onClick={() => openAddMovementModal("expense")}
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
                            Lista de movimientos registrados (activo = true)
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => initDailyInput()} style={styles.btnGhost}>
                            Actualizar
                        </button>
                    </div>
                </div>

                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Movimiento</th>
                            <th style={styles.th}>Tipo</th>
                            <th style={{ ...styles.th, textAlign: "right" }}>Valor</th>
                            <th style={styles.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {movimientos.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ ...styles.td, color: "#6b7280" }}>
                                    No hay movimientos para esta fecha.
                                </td>
                            </tr>
                        ) : (
                            movimientos.map((m) => (
                                <tr key={m.id_movimiento}>
                                    <td style={styles.td}>{m.nombre_movimiento}</td>
                                    <td style={styles.td}>{m.tipo}</td>
                                    <td style={{ ...styles.td, textAlign: "right" }}>
                                        {formatCurrency(m.monto)}
                                    </td>
                                    <td style={{ ...styles.td, textAlign: "right" }}>
                                        <button
                                            onClick={() => deleteMovement(m.id_movimiento)}
                                            style={{ ...styles.btnGhost }}
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
                        <h4 style={{ marginTop: 0 }}>Añadir movimiento — {form.tipo}</h4>

                        <div style={{ marginBottom: 10 }}>
                            <label
                                style={{ display: "block", fontWeight: 600, marginBottom: 6 }}
                            >
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={form.nombre}
                                maxLength={30}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, nombre: e.target.value }))
                                }
                                placeholder="Ej: Transporte"
                                style={{
                                    width: "100%",
                                    padding: 8,
                                    borderRadius: 6,
                                    border: "1px solid #e5e7eb",
                                }}
                            />
                        </div>

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
                                onClick={() =>
                                    addMovement({
                                        nombre: form.nombre,
                                        monto: form.monto,
                                        tipo: form.tipo,
                                    })
                                }
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
                        <div style={{ marginBottom: 12 }}>Enter a valid value</div>
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
