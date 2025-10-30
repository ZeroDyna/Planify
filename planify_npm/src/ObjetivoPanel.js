import React, { useEffect, useState } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * ObjetivoPanel (versión 1-cuenta por usuario, formulario oculto por defecto)
 *
 * Props:
 * - SUPABASE_URL
 * - SUPABASE_KEY (ANON/public key)
 * - accessToken (Bearer token del usuario) - opcional
 * - user (opcional) - si el padre pasa el objeto user, se usa su email para filtrar la cuenta
 */
export default function ObjetivoPanel({
    SUPABASE_URL,
    SUPABASE_KEY,
    accessToken,
    user,
}) {
    const [cuenta, setCuenta] = useState(null); // la única cuenta del usuario
    const [objetivos, setObjetivos] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingList, setLoadingList] = useState(false);
    const [message, setMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [showForm, setShowForm] = useState(false); // formulario oculto por defecto

    const [form, setForm] = useState({
        fecha_objetivo: "",
        monto_objetivo: "",
        tipo: true,
        estado: "activo",
    });
    const [creating, setCreating] = useState(false);

    const headersBase = {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
    };
    const headersAuth = accessToken
        ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
        : headersBase;

    // Format helpers
    const currency = (v) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2,
        }).format(Number(v || 0));
    const percent = (v) => `${Number(v || 0).toFixed(2)}%`;

    // Spinner (usar inline element para evitar nested <div> dentro de <p>)
    const Spinner = ({ size = 18 }) => (
        <span
            role="status"
            aria-live="polite"
            style={{
                width: size,
                height: size,
                border: "3px solid rgba(0,0,0,0.08)",
                borderTop: "3px solid #6366f1",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                display: "inline-block",
                verticalAlign: "middle",
            }}
        />
    );

    // utilidad: normalizar fecha a YYYY-MM-DD (acepta ya YYYY-MM-DD o Date)
    const asDateString = (input) => {
        if (!input) return new Date().toISOString().slice(0, 10);
        // si ya parece YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
        const d = new Date(input);
        if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
        return d.toISOString().slice(0, 10);
    };

    // obtener la única cuenta asociada al usuario autenticado
    const fetchCuenta = async () => {
        setMessage("");
        try {
            // Si el padre pasa `user` (desde App.js) intentamos filtrar por su email
            const emailFromUser =
                user?.email || user?.correo || user?.user?.email || user?._raw?.correo;
            let url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&limit=1`;
            if (emailFromUser) {
                url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&correo_usuario=eq.${encodeURIComponent(
                    emailFromUser,
                )}&limit=1`;
            }
            const res = await fetch(url, {
                headers: accessToken ? headersAuth : headersBase,
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => null);
                console.error("fetchCuenta error", res.status, txt, { url });
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
            const c = data[0];
            // Asegurarnos de tener la propiedad correo_cuenta correctamente
            setCuenta({
                correo_cuenta: c.correo_cuenta,
                nombre_cuenta: c.nombre_cuenta || c.correo_cuenta,
            });
            // limpiar cualquier selección previa si la cuenta cambió
            setSelectedId(null);
            setDetalle(null);
        } catch (err) {
            console.error("fetchCuenta exception", err);
            setMessage("Error de conexión al obtener la cuenta.");
            setCuenta(null);
        }
    };

    // cargar objetivos de la cuenta (si hay)
    const fetchObjetivos = async () => {
        if (!cuenta) {
            setObjetivos([]);
            setSelectedId(null);
            return;
        }
        setLoadingList(true);
        setMessage("");
        try {
            const encodedCorreo = encodeURIComponent(cuenta.correo_cuenta);
            const url = `${SUPABASE_URL}/rest/v1/objetivo?select=*&correo_cuenta=eq.${encodedCorreo}&order=fecha_objetivo.desc`;
            const res = await fetch(url, {
                headers: accessToken ? headersAuth : headersBase,
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => null);
                console.error("fetchObjetivos error", res.status, txt, { url });
                setMessage("Error al cargar objetivos.");
                setObjetivos([]);
                setSelectedId(null);
                setLoadingList(false);
                return;
            }
            const data = await res.json();
            setObjetivos(data || []);
            // sólo seleccionar si hay objetivos válidos
            if (Array.isArray(data) && data.length > 0) {
                setSelectedId(data[0].id_objetivo ?? null);
            } else {
                setSelectedId(null);
            }
        } catch (err) {
            console.error("fetchObjetivos exception", err);
            setMessage("Error de conexión al cargar objetivos.");
            setObjetivos([]);
            setSelectedId(null);
        } finally {
            setLoadingList(false);
        }
    };

    // parse sum helper
    const parseSum = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const obj = arr[0];
        const v = obj.sum ?? obj.sum_monto ?? Object.values(obj)[0];
        return v === null || v === undefined ? 0 : Number(v);
    };

    // helper: safe fetch sum (no lanza si falla, devuelve 0 y loggea)
    const fetchSumSafe = async (url, headers, label) => {
        try {
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const body = await res.text().catch(() => null);
                console.warn(`[sum] ${label} failed`, {
                    status: res.status,
                    body,
                    url,
                });
                return 0;
            }
            const json = await res.json().catch(() => null);
            return parseSum(json);
        } catch (err) {
            console.error(`[sum] ${label} exception`, err, { url });
            return 0;
        }
    };

    // fallback: calcular progreso a partir de movimientos (ingresos - egresos)
    const calculateProgressClientSide = async (objetivo) => {
        try {
            const correo_cuenta = objetivo.correo_cuenta;
            const fechaFiltro = asDateString(objetivo.fecha_objetivo);
            const headers = accessToken ? headersAuth : headersBase;

            const meIngresosUrl = `${SUPABASE_URL}/rest/v1/movimiento_espontaneo?correo_cuenta=eq.${encodeURIComponent(
                correo_cuenta,
            )}&tipo=eq.true&fecha_operacion=lte.${encodeURIComponent(fechaFiltro)}&select=sum(monto)`;
            const meEgresosUrl = `${SUPABASE_URL}/rest/v1/movimiento_espontaneo?correo_cuenta=eq.${encodeURIComponent(
                correo_cuenta,
            )}&tipo=eq.false&fecha_operacion=lte.${encodeURIComponent(fechaFiltro)}&select=sum(monto)`;

            // usamos fetchSumSafe para evitar lanzar errores 400/401 y así la UI no rompe
            const [totalMeIngresos, totalMeEgresos] = await Promise.all([
                fetchSumSafe(meIngresosUrl, headers, "movimiento_espontaneo ingresos"),
                fetchSumSafe(meEgresosUrl, headers, "movimiento_espontaneo egresos"),
            ]);

            // conceptos
            const conceptosUrl = `${SUPABASE_URL}/rest/v1/concepto?correo_cuenta=eq.${encodeURIComponent(
                correo_cuenta,
            )}&select=id_concepto,tipo`;
            const conceptosRes = await fetch(conceptosUrl, { headers });
            if (!conceptosRes.ok) {
                const txt = await conceptosRes.text().catch(() => null);
                console.warn(
                    "Error leyendo conceptos (se asumirá 0 movimiento_concepto)",
                    {
                        status: conceptosRes.status,
                        body: txt,
                        url: conceptosUrl,
                    },
                );
                // asumimos 0 movimientos por concepto
                const totalIngresos = Number(totalMeIngresos);
                const totalEgresos = Number(totalMeEgresos);
                const netAhorro = totalIngresos - totalEgresos;
                const progreso = Math.max(netAhorro, 0);
                const porcentaje = objetivo.monto_objetivo
                    ? (progreso / Number(objetivo.monto_objetivo)) * 100
                    : 0;
                return {
                    ...objetivo,
                    progreso,
                    porcentaje: Math.max(0, Math.min(100, porcentaje)),
                    totalIngresos,
                    totalEgresos,
                    totalMeIngresos,
                    totalMeEgresos,
                    totalMcIngresos: 0,
                    totalMcEgresos: 0,
                };
            }
            const conceptos = await conceptosRes.json();
            const ingresoConceptIds = conceptos
                .filter((c) => c.tipo === true)
                .map((c) => c.id_concepto)
                .filter(Boolean);
            const egresoConceptIds = conceptos
                .filter((c) => c.tipo === false)
                .map((c) => c.id_concepto)
                .filter(Boolean);

            let totalMcIngresos = 0;
            let totalMcEgresos = 0;

            if (ingresoConceptIds.length) {
                const ids = ingresoConceptIds.join(",");
                const mcInUrl = `${SUPABASE_URL}/rest/v1/movimiento_concepto?correo_cuenta=eq.${encodeURIComponent(
                    correo_cuenta,
                )}&id_concepto=in.(${encodeURIComponent(ids)})&fecha_operacion=lte.${encodeURIComponent(
                    fechaFiltro,
                )}&select=sum(monto)`;
                totalMcIngresos = await fetchSumSafe(
                    mcInUrl,
                    headers,
                    "movimiento_concepto ingresos",
                );
            }

            if (egresoConceptIds.length) {
                const ids = egresoConceptIds.join(",");
                const mcEgUrl = `${SUPABASE_URL}/rest/v1/movimiento_concepto?correo_cuenta=eq.${encodeURIComponent(
                    correo_cuenta,
                )}&id_concepto=in.(${encodeURIComponent(ids)})&fecha_operacion=lte.${encodeURIComponent(
                    fechaFiltro,
                )}&select=sum(monto)`;
                totalMcEgresos = await fetchSumSafe(
                    mcEgUrl,
                    headers,
                    "movimiento_concepto egresos",
                );
            }

            const totalIngresos = Number(totalMeIngresos) + Number(totalMcIngresos);
            const totalEgresos = Number(totalMeEgresos) + Number(totalMcEgresos);
            const netAhorro = totalIngresos - totalEgresos;
            const progreso = Math.max(netAhorro, 0);
            const porcentaje = objetivo.monto_objetivo
                ? (progreso / Number(objetivo.monto_objetivo)) * 100
                : 0;

            return {
                ...objetivo,
                progreso,
                porcentaje: Math.max(0, Math.min(100, porcentaje)),
                totalIngresos,
                totalEgresos,
                totalMeIngresos,
                totalMeEgresos,
                totalMcIngresos,
                totalMcEgresos,
            };
        } catch (err) {
            console.error("calculateProgressClientSide error", err);
            return {
                ...objetivo,
                progreso: 0,
                porcentaje: 0,
                totalIngresos: 0,
                totalEgresos: 0,
            };
        }
    };

    // fetch detalle: intenta view objetivo_progress, si 404 hace fallback
    const fetchDetalle = async (id) => {
        if (!id) {
            setDetalle(null);
            return;
        }
        setLoading(true);
        setMessage("");
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/objetivo_progress?id_objetivo=eq.${id}`,
                { headers: accessToken ? headersAuth : headersBase },
            );
            if (res.status === 404) {
                const objetivoRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${id}`,
                    { headers: accessToken ? headersAuth : headersBase },
                );
                if (!objetivoRes.ok)
                    throw new Error("No se pudo obtener objetivo para fallback");
                const objetivoArr = await objetivoRes.json();
                if (!Array.isArray(objetivoArr) || objetivoArr.length === 0) {
                    setDetalle(null);
                    setMessage("Objetivo no encontrado");
                    setLoading(false);
                    return;
                }
                const objetivo = objetivoArr[0];
                // seguridad UX: asegurar que el objetivo pertenece a la cuenta del usuario (si sabemos cuál es)
                if (cuenta && objetivo.correo_cuenta !== cuenta.correo_cuenta) {
                    setMessage("No tienes permisos para ver ese objetivo");
                    setDetalle(null);
                    setLoading(false);
                    return;
                }
                const det = await calculateProgressClientSide(objetivo);
                setDetalle(det);
                setLoading(false);
                return;
            }
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                console.error("Error fetching detalle", res.status, err);
                setMessage("Error al cargar detalle del objetivo");
                setDetalle(null);
                setLoading(false);
                return;
            }
            const data = await res.json();
            if (data && data.length) {
                const obj = data[0];
                if (cuenta && obj.correo_cuenta !== cuenta.correo_cuenta) {
                    setMessage("No tienes permisos para ver ese objetivo");
                    setDetalle(null);
                    setLoading(false);
                    return;
                }
                setDetalle(obj);
            } else setDetalle(null);
        } catch (err) {
            console.error("fetchDetalle exception", err);
            setMessage("Error de conexión al cargar detalle");
            setDetalle(null);
        } finally {
            setLoading(false);
        }
    };

    // crear objetivo: el correo_cuenta se toma siempre de `cuenta`
    const createObjetivo = async (e) => {
        e?.preventDefault();
        setMessage("");
        setSuccessMessage("");
        if (!cuenta) {
            setMessage("No hay cuenta asociada a tu usuario.");
            return;
        }
        if (!form.fecha_objetivo || !form.monto_objetivo) {
            setMessage("Completa fecha y monto.");
            return;
        }
        setCreating(true);
        try {
            const body = {
                correo_cuenta: cuenta.correo_cuenta,
                fecha_objetivo: form.fecha_objetivo,
                monto_objetivo: Number(form.monto_objetivo),
                tipo: form.tipo,
                estado: form.estado,
            };
            const res = await fetch(`${SUPABASE_URL}/rest/v1/objetivo`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_KEY,
                    Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    Prefer: "return=representation",
                },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                console.error("Create objetivo error", res.status, data);
                setMessage(
                    data?.message || JSON.stringify(data) || "Error al crear objetivo",
                );
                setCreating(false);
                return;
            }
            // recargar lista filtrada
            await fetchObjetivos();
            if (Array.isArray(data) && data.length)
                setSelectedId(data[0].id_objetivo);
            setSuccessMessage("Objetivo creado correctamente");
            setForm({
                fecha_objetivo: "",
                monto_objetivo: "",
                tipo: true,
                estado: "activo",
            });
            // una vez creado, ocultar form si prefieres
            setShowForm(false);
        } catch (err) {
            console.error("createObjetivo exception", err);
            setMessage("Error de conexión al crear objetivo");
        } finally {
            setCreating(false);
            setTimeout(() => setSuccessMessage(""), 3000);
        }
    };

    // chart data
    const chartData = (monto_objetivo = 0, progreso = 0) => {
        const prog = Number(progreso) || 0;
        const objetivo = Number(monto_objetivo) || 0;
        const restante = Math.max(objetivo - prog, 0);
        return {
            labels: ["Progreso", "Restante"],
            datasets: [
                {
                    data: [prog, restante],
                    backgroundColor: ["#4f46e5", "#e5e7eb"],
                    hoverBackgroundColor: ["#3730a3", "#d1d5db"],
                    borderWidth: 0,
                },
            ],
        };
    };

    // mount
    useEffect(() => {
        // primero obtener la cuenta
        (async () => {
            await fetchCuenta();
        })();
        // eslint-disable-next-line
    }, [accessToken, user]);

    useEffect(() => {
        if (cuenta) fetchObjetivos();
        // eslint-disable-next-line
    }, [cuenta]);

    useEffect(() => {
        if (selectedId) fetchDetalle(selectedId);
        else setDetalle(null);
        // eslint-disable-next-line
    }, [selectedId, cuenta]);

    // styles ligeros
    const styles = {
        container: { display: "flex", gap: 20, flexWrap: "wrap", padding: 12 },
        left: { flex: "1 1 360px", minWidth: 320 },
        right: { flex: "1 1 420px", minWidth: 320 },
        card: {
            padding: 12,
            borderRadius: 10,
            background: "white",
            boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
        },
        smallCard: {
            padding: 10,
            borderRadius: 8,
            background: "#fff",
            boxShadow: "0 4px 12px rgba(2,6,23,0.04)",
            display: "flex",
            alignItems: "center",
            gap: 12,
        },
        progressOuter: {
            width: "100%",
            height: 14,
            background: "#f3f4f6",
            borderRadius: 8,
            overflow: "hidden",
        },
        progressInner: (p) => ({
            width: `${Math.max(0, Math.min(100, p))}%`,
            height: "100%",
            background: "#6366f1",
        }),
    };

    return (
        <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={styles.container}>
                <div style={styles.left}>
                    <div style={styles.card}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0 }}>Tus objetivos</h3>
                                <p style={{ margin: 0, color: "#6b7280" }}>
                                    Crear y ver tus metas (solo tu cuenta)
                                </p>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    className="btn"
                                    onClick={() => {
                                        fetchCuenta();
                                        fetchObjetivos();
                                    }}
                                >
                                    {loadingList ? <Spinner /> : "Refrescar"}
                                </button>
                            </div>
                        </div>

                        {message && (
                            <div style={{ color: "#b91c1c", marginTop: 8 }}>{message}</div>
                        )}
                        {successMessage && (
                            <div style={{ color: "#065f46", marginTop: 8 }}>
                                {successMessage}
                            </div>
                        )}

                        {/* Visualización de la cuenta (no editable) y botón para mostrar formulario */}
                        <div style={{ marginTop: 12 }}>
                            <label
                                style={{ fontWeight: 700, display: "block", marginBottom: 6 }}
                            >
                                Cuenta
                            </label>
                            <div
                                style={{
                                    padding: 10,
                                    borderRadius: 8,
                                    background: "#f8fafc",
                                    color: "#111827",
                                }}
                            >
                                {cuenta
                                    ? cuenta.nombre_cuenta || cuenta.correo_cuenta
                                    : "No hay cuenta disponible"}
                            </div>

                            <div style={{ marginTop: 10 }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowForm((s) => !s)}
                                    style={{
                                        background: "linear-gradient(135deg,#6366f1,#7c3aed)",
                                        color: "#fff",
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "none",
                                    }}
                                >
                                    {showForm ? "Ocultar formulario" : "Crear objetivo"}
                                </button>
                            </div>
                        </div>

                        {/* Formulario aparece solo al pulsar el botón */}
                        {showForm && (
                            <details open style={{ marginTop: 12 }}>
                                <summary style={{ fontWeight: 700 }}>Nuevo objetivo</summary>
                                <form
                                    onSubmit={createObjetivo}
                                    style={{ marginTop: 10, display: "grid", gap: 8 }}
                                >
                                    <label>
                                        Fecha objetivo
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={form.fecha_objetivo}
                                            onChange={(e) =>
                                                setForm({ ...form, fecha_objetivo: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Monto objetivo
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={form.monto_objetivo}
                                            onChange={(e) =>
                                                setForm({ ...form, monto_objetivo: e.target.value })
                                            }
                                            placeholder="1000.00"
                                        />
                                    </label>

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <select
                                            className="form-input"
                                            value={form.tipo ? "true" : "false"}
                                            onChange={(e) =>
                                                setForm({ ...form, tipo: e.target.value === "true" })
                                            }
                                        >
                                            <option value="true">Ingreso</option>
                                            <option value="false">Egreso</option>
                                        </select>

                                        <input
                                            className="form-input"
                                            value={form.estado}
                                            onChange={(e) =>
                                                setForm({ ...form, estado: e.target.value })
                                            }
                                        />
                                    </div>

                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                            className="btn btn-primary"
                                            type="submit"
                                            disabled={creating || !cuenta}
                                        >
                                            {creating ? (
                                                <>
                                                    <Spinner /> Creando...
                                                </>
                                            ) : (
                                                "Crear objetivo"
                                            )}
                                        </button>
                                        <button
                                            className="btn"
                                            type="button"
                                            onClick={() =>
                                                setForm({
                                                    fecha_objetivo: "",
                                                    monto_objetivo: "",
                                                    tipo: true,
                                                    estado: "activo",
                                                })
                                            }
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </form>
                            </details>
                        )}

                        <div style={{ marginTop: 12 }}>
                            {loadingList ? (
                                <p>
                                    <Spinner /> Cargando...
                                </p>
                            ) : objetivos.length === 0 ? (
                                <p style={{ marginTop: 8 }}>No tienes metas creadas todavía.</p>
                            ) : (
                                objetivos.map((o) => (
                                    <div key={o.id_objetivo} style={styles.smallCard}>
                                        <div style={{ width: 60 }}>
                                            <Doughnut
                                                data={chartData(o.monto_objetivo, o.progreso || 0)}
                                                options={{
                                                    cutout: "70%",
                                                    plugins: { legend: { display: false } },
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                }}
                                            >
                                                <div style={{ fontWeight: 700 }}>
                                                    #{o.id_objetivo} · {currency(o.monto_objetivo)}
                                                </div>
                                                <div style={{ color: "#6b7280" }}>
                                                    {o.fecha_objetivo}
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 6 }}>
                                                <div style={styles.progressOuter}>
                                                    <div
                                                        style={styles.progressInner(o.porcentaje || 0)}
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#6b7280",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {o.progreso
                                                        ? `${currency(o.progreso)} · ${percent(o.porcentaje)}`
                                                        : "Sin progreso"}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <button
                                                className="btn"
                                                onClick={() => setSelectedId(o.id_objetivo)}
                                            >
                                                Ver
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div style={styles.right}>
                    <div style={styles.card}>
                        <h3 style={{ margin: 0 }}>Detalle & progreso</h3>
                        {loading ? (
                            <p>
                                <Spinner /> Cargando detalle...
                            </p>
                        ) : !detalle ? (
                            <p>Selecciona una meta para ver su progreso.</p>
                        ) : (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                                    <div style={{ width: 160 }}>
                                        <Doughnut
                                            data={chartData(detalle.monto_objetivo, detalle.progreso)}
                                            options={{
                                                cutout: "70%",
                                                plugins: { legend: { position: "bottom" } },
                                            }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0 }}>Meta #{detalle.id_objetivo}</h4>
                                        <p style={{ margin: "6px 0" }}>
                                            Cuenta: <strong>{detalle.correo_cuenta}</strong>
                                        </p>
                                        <p style={{ margin: "6px 0" }}>
                                            Fecha objetivo: <strong>{detalle.fecha_objetivo}</strong>
                                        </p>
                                        <div style={{ marginTop: 8 }}>
                                            <div>
                                                Objetivo:{" "}
                                                <strong>{currency(detalle.monto_objetivo)}</strong>
                                            </div>
                                            <div>
                                                Progreso:{" "}
                                                <strong>
                                                    {currency(detalle.progreso)} ·{" "}
                                                    {percent(detalle.porcentaje)}
                                                </strong>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 12 }}>
                                            <div style={styles.progressOuter}>
                                                <div style={styles.progressInner(detalle.porcentaje)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
