import React, { useEffect, useState } from "react";

/**
 * Balance (MK-005) - Vista para consultar balances y generar reportes por periodo.
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 * - accessToken (opcional)
 * - user (opcional) - objeto user (se usa su email para filtrar)
 *
 * Funciones importantes documentadas con FP-51 .. FP-56 (comentarios en español).
 *
 * Restricciones UX implementadas:
 * - Fecha inicio: obligatoria, no puede ser futura.
 * - Fecha fin: obligatoria, no puede ser futura, debe ser >= fecha inicio.
 * - El botón "Download report" valida rango antes de generar CSV.
 *
 * Nota: usa la tabla movimiento con filtro activo=eq.true.
 */

export default function Balance({
    SUPABASE_URL,
    SUPABASE_KEY,
    accessToken,
    user,
}) {
    // Estado UI
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .slice(0, 10),
    ); // primer día del mes actual
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10)); // hoy
    const [cuenta, setCuenta] = useState(null);
    const [movementsRange, setMovementsRange] = useState([]); // movimientos en el rango seleccionado
    const [movementsAllActive, setMovementsAllActive] = useState([]); // movimientos activos para cuenta (todo el histórico)
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [downloading, setDownloading] = useState(false);

    const headersBase = {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
    };
    const headersAuth = accessToken
        ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
        : headersBase;

    /* FP-51: fetchCuentaBalance
     * Obtiene la cuenta asociada al usuario (por email) y la guarda en estado.
     */
    const fetchCuentaBalance = async () => {
        setMessage("");
        try {
            const email = user?.email || user?.correo || null;
            if (!email) {
                setCuenta(null);
                setMessage("Inicia sesión para ver el balance.");
                return;
            }
            const url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&correo_usuario=eq.${encodeURIComponent(
                email,
            )}&limit=1`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                setCuenta(null);
                setMessage("No se pudo obtener la cuenta.");
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
            console.error("fetchCuentaBalance error", err);
            setCuenta(null);
            setMessage("Error de conexión al obtener la cuenta.");
        }
    };

    /* FP-52: fetchMovementsRange
     * Carga los movimientos activos para la cuenta en el rango startDate..endDate.
     * Actualiza movementsRange y deja listo para mostrar y descargar.
     */
    const fetchMovementsRange = async (start, end) => {
        if (!cuenta) {
            setMovementsRange([]);
            return;
        }
        setLoading(true);
        setMessage("");
        try {
            const url = `${SUPABASE_URL}/rest/v1/movimiento?select=*&fecha=gte.${encodeURIComponent(
                start,
            )}&fecha=lte.${encodeURIComponent(end)}&correo_cuenta=eq.${encodeURIComponent(
                cuenta.correo_cuenta,
            )}&activo=eq.true&order=fecha.asc,id_movimiento.asc`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                setMessage("Error al cargar movimientos del periodo.");
                setMovementsRange([]);
                return;
            }
            const data = await res.json();
            setMovementsRange(data || []);
        } catch (err) {
            console.error("fetchMovementsRange error", err);
            setMessage("Error de conexión al cargar movimientos.");
            setMovementsRange([]);
        } finally {
            setLoading(false);
        }
    };

    /* FP-53: fetchAllActiveMovements
     * Carga todos los movimientos activos para la cuenta (histórico) para cálculos agregados.
     */
    const fetchAllActiveMovements = async () => {
        if (!cuenta) {
            setMovementsAllActive([]);
            return;
        }
        try {
            const url = `${SUPABASE_URL}/rest/v1/movimiento?select=*&correo_cuenta=eq.${encodeURIComponent(
                cuenta.correo_cuenta,
            )}&activo=eq.true&order=fecha.asc`;
            const res = await fetch(url, { headers: headersAuth });
            if (!res.ok) {
                console.warn("fetchAllActiveMovements failed", res.status);
                setMovementsAllActive([]);
                return;
            }
            const data = await res.json();
            setMovementsAllActive(data || []);
        } catch (err) {
            console.error("fetchAllActiveMovements error", err);
            setMovementsAllActive([]);
        }
    };

    /* FP-54: calculateTotals
     * Calcula totales (income, expense, net) a partir de un array de movimientos.
     * Retorna { income, expense, net }.
     */
    const calculateTotals = (movs) => {
        const inc = (movs || [])
            .filter((m) => m.tipo === "income")
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        const exp = (movs || [])
            .filter((m) => m.tipo === "expense")
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        return { income: inc, expense: exp, net: inc - exp };
    };

    /* FP-55: validateDateRange
     * Valida las fechas: obligatorias, no futuras, end >= start.
     * Retorna { ok: boolean, reason?: string }.
     */
    const validateDateRange = (start, end) => {
        if (!start) return { ok: false, reason: "Fecha inicio obligatoria" };
        if (!end) return { ok: false, reason: "Fecha fin obligatoria" };
        const today = new Date().toISOString().slice(0, 10);
        if (start > today)
            return { ok: false, reason: "Fecha inicio no puede ser futura" };
        if (end > today)
            return { ok: false, reason: "Fecha fin no puede ser futura" };
        if (end < start)
            return {
                ok: false,
                reason: "Fecha fin debe ser mayor o igual a fecha inicio",
            };
        return { ok: true };
    };

    /* FP-56: downloadReport
     * Valida rango, genera CSV de movementsRange y dispara descarga del archivo.
     * Muestra mensajes de error/estado en UI.
     */
    const downloadReport = async () => {
        setMessage("");
        const v = validateDateRange(startDate, endDate);
        if (!v.ok) {
            setMessage(v.reason);
            return;
        }
        // Asegurar que tenemos la lista actualizada
        await fetchMovementsRange(startDate, endDate);
        setDownloading(true);
        try {
            // Construir CSV: encabezado + filas
            const header = [
                "fecha",
                "nombre_movimiento",
                "tipo",
                "monto",
                "correo_cuenta",
            ];
            const rows = (movementsRange || []).map((m) => [
                m.fecha,
                m.nombre_movimiento?.replace(/"/g, '""') || "",
                m.tipo || "",
                m.monto ?? "",
                m.correo_cuenta || "",
            ]);
            const csv = [header, ...rows]
                .map((r) => r.map((c) => `"${c}"`).join(","))
                .join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const fileName = `planify_report_${startDate}_to_${endDate}.csv`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMessage("Download successful");
        } catch (err) {
            console.error("downloadReport error", err);
            setMessage("Error generando el reporte.");
        } finally {
            setDownloading(false);
        }
    };

    /* FP-57: initBalance
     * Inicializa la vista: carga cuenta, movimientos del rango y totales históricos.
     * Llamado al montar o cuando cambia user/accessToken.
     */
    const initBalance = async () => {
        setLoading(true);
        setMessage("");
        await fetchCuentaBalance();
        setLoading(false);
    };

    // Efectos: al montar y cuando cambia la cuenta o las fechas
    useEffect(() => {
        // cuando cambia user/accessToken se obtiene la cuenta
        initBalance();
        // eslint-disable-next-line
    }, [user, accessToken]);

    useEffect(() => {
        // cuando cambia la cuenta o el rango, cargar movimientos
        if (cuenta) {
            fetchMovementsRange(startDate, endDate);
            fetchAllActiveMovements();
        }
        // eslint-disable-next-line
    }, [cuenta, startDate, endDate]);

    // Formato moneda
    const formatCurrency = (v) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2,
        }).format(Number(v || 0));

    // Totales calculados
    const totalsRange = calculateTotals(movementsRange);
    const totalsAll = calculateTotals(movementsAllActive);

    // Render
    return (
        <div
            style={{
                padding: 16,
                maxWidth: 1000,
                margin: "0 auto",
                fontFamily: "Inter, Roboto, sans-serif",
            }}
        >
            <h3 style={{ marginTop: 0 }}>Balance </h3>
            <div style={{ color: "#6b7280", marginBottom: 12 }}>
                Selecciona un periodo para generar reporte
            </div>

            {message && (
                <div
                    style={{
                        color: message.includes("Error") ? "#b91c1c" : "#065f46",
                        marginBottom: 12,
                    }}
                >
                    {message}
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-end",
                    marginBottom: 16,
                }}
            >
                <div>
                    <label
                        style={{
                            display: "block",
                            fontSize: 13,
                            color: "#374151",
                            marginBottom: 6,
                        }}
                    >
                        Fecha inicio
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label
                        style={{
                            display: "block",
                            fontSize: 13,
                            color: "#374151",
                            marginBottom: 6,
                        }}
                    >
                        Fecha fin
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div>
                    <button
                        onClick={downloadReport}
                        disabled={downloading}
                        style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            background: "#06b6d4",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        {downloading ? "Generando..." : "Download report"}
                    </button>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>Cuenta</div>
                    <div style={{ fontWeight: 700 }}>
                        {cuenta ? cuenta.nombre_cuenta || cuenta.correo_cuenta : "—"}
                    </div>
                </div>
            </div>

            <div
                style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}
            >
                <div
                    style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 8,
                        boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                    }}
                >
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                        ALL TIME
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {formatCurrency(totalsAll.net)}
                    </div>
                    <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                        Income: {formatCurrency(totalsAll.income)} · Expense:{" "}
                        {formatCurrency(totalsAll.expense)}
                    </div>

                    <hr
                        style={{
                            margin: "12px 0",
                            border: "none",
                            borderTop: "1px solid #f3f4f6",
                        }}
                    />

                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                        PERIODO SELECCIONADO
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {formatCurrency(totalsRange.net)}
                    </div>
                    <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                        Income: {formatCurrency(totalsRange.income)} · Expense:{" "}
                        {formatCurrency(totalsRange.expense)}
                    </div>
                </div>

                <div
                    style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 8,
                        boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                        }}
                    >
                        <div>
                            <strong>Movements</strong>
                            <div style={{ color: "#6b7280", fontSize: 13 }}>
                                Movimientos en el periodo
                            </div>
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 13 }}>
                            {movementsRange.length} items
                        </div>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ textAlign: "left" }}>
                                <th
                                    style={{ fontSize: 13, color: "#6b7280", padding: "8px 6px" }}
                                >
                                    Movement
                                </th>
                                <th
                                    style={{ fontSize: 13, color: "#6b7280", padding: "8px 6px" }}
                                >
                                    Date
                                </th>
                                <th
                                    style={{
                                        fontSize: 13,
                                        color: "#6b7280",
                                        padding: "8px 6px",
                                        textAlign: "right",
                                    }}
                                >
                                    Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {movementsRange.length === 0 ? (
                                <tr>
                                    <td colSpan={3} style={{ padding: 12, color: "#6b7280" }}>
                                        No hay movimientos en este periodo.
                                    </td>
                                </tr>
                            ) : (
                                movementsRange.map((m) => (
                                    <tr
                                        key={`${m.id_movimiento}-${m.fecha}`}
                                        style={{ borderTop: "1px solid #f3f4f6" }}
                                    >
                                        <td style={{ padding: "8px 6px" }}>
                                            {m.nombre_movimiento}
                                        </td>
                                        <td style={{ padding: "8px 6px" }}>{m.fecha}</td>
                                        <td style={{ padding: "8px 6px", textAlign: "right" }}>
                                            {formatCurrency(m.monto)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
