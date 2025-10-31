import React from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default class ObjetivoPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            cuenta: null,
            objetivos: [],
            selectedId: null,
            detalle: null,
            loading: false,
            loadingList: false,
            message: "",
            successMessage: "",
            showForm: false,
            form: {
                fecha_objetivo: "",
                monto_objetivo: "",
                estado: "en_progreso",
            },
            creating: false,
        };
        this.estados = [
            { value: "en_progreso", label: "En progreso" },
            { value: "en_pausa", label: "En pausa" },
            { value: "terminada", label: "Terminada" },
        ];
    }

    // FP-28: Obtiene la cuenta asociada al usuario autenticado usando el correo.
    // Si falla muestra error; si tiene éxito actualiza cuenta en el estado.
    fetchCuenta = async () => {
        this.setState({ message: "" });
        const { SUPABASE_URL, accessToken, user } = this.props;
        try {
            const emailFromUser =
                user?.email || user?.correo || user?.user?.email || user?._raw?.correo;
            let url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&limit=1`;
            if (emailFromUser) {
                url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&correo_usuario=eq.${encodeURIComponent(
                    emailFromUser,
                )}&limit=1`;
            }
            const headersBase = {
                "Content-Type": "application/json",
                apikey: this.props.SUPABASE_KEY,
            };
            const headersAuth = accessToken
                ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
                : headersBase;
            const res = await fetch(url, {
                headers: headersAuth,
            });
            if (!res.ok) {
                this.setState({
                    message: "No se pudo obtener la cuenta del usuario.",
                    cuenta: null,
                });
                return;
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                this.setState({
                    message: "No hay cuenta asociada a este usuario.",
                    cuenta: null,
                });
                return;
            }
            const c = data[0];
            this.setState({
                cuenta: {
                    correo_cuenta: c.correo_cuenta,
                    nombre_cuenta: c.nombre_cuenta || c.correo_cuenta,
                },
                selectedId: null,
                detalle: null,
            });
        } catch (err) {
            this.setState({
                message: "Error de conexión al obtener la cuenta.",
                cuenta: null,
            });
        }
    };

    // FP-29: Obtiene todas las metas/objetivos de la cuenta seleccionada.
    // Ordena por numero_objetivo y las guarda en el estado.
    fetchObjetivos = async () => {
        const { SUPABASE_URL, accessToken } = this.props;
        const { cuenta } = this.state;
        if (!cuenta) {
            this.setState({ objetivos: [], selectedId: null });
            return;
        }
        this.setState({ loadingList: true, message: "" });
        try {
            const encodedCorreo = encodeURIComponent(cuenta.correo_cuenta);
            const url = `${SUPABASE_URL}/rest/v1/objetivo?select=*&correo_cuenta=eq.${encodedCorreo}&order=numero_objetivo.asc`;
            const headersBase = {
                "Content-Type": "application/json",
                apikey: this.props.SUPABASE_KEY,
            };
            const headersAuth = accessToken
                ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
                : headersBase;
            const res = await fetch(url, {
                headers: headersAuth,
            });
            if (!res.ok) {
                this.setState({
                    message: "Error al cargar metas.",
                    objetivos: [],
                    selectedId: null,
                    loadingList: false,
                });
                return;
            }
            const data = await res.json();
            this.setState({
                objetivos: data || [],
                selectedId:
                    Array.isArray(data) && data.length > 0 ? data[0].id_objetivo : null,
            });
        } catch (err) {
            this.setState({
                message: "Error de conexión al cargar metas.",
                objetivos: [],
                selectedId: null,
            });
        } finally {
            this.setState({ loadingList: false });
        }
    };

    // FP-30: Consulta el siguiente número de objetivo para una cuenta.
    // Devuelve el siguiente número consecutivo según metas existentes.
    fetchNextNumeroObjetivo = async (correo_cuenta) => {
        const { SUPABASE_URL, accessToken } = this.props;
        const url = `${SUPABASE_URL}/rest/v1/objetivo?correo_cuenta=eq.${encodeURIComponent(
            correo_cuenta,
        )}&select=numero_objetivo&order=numero_objetivo.desc&limit=1`;
        const headersBase = {
            "Content-Type": "application/json",
            apikey: this.props.SUPABASE_KEY,
        };
        const headersAuth = accessToken
            ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
            : headersBase;
        const res = await fetch(url, {
            headers: headersAuth,
        });
        if (!res.ok) return 1;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return 1;
        return (data[0].numero_objetivo || 0) + 1;
    };

    // FP-31: Crea una nueva meta para la cuenta, validando los campos.
    // Actualiza la lista de metas y muestra mensaje de éxito o error.
    createObjetivo = async (e) => {
        e?.preventDefault();
        this.setState({ message: "", successMessage: "" });
        const { SUPABASE_URL, accessToken } = this.props;
        const { cuenta, form } = this.state;
        if (!cuenta) {
            this.setState({ message: "No hay cuenta asociada a tu usuario." });
            return;
        }
        if (!form.fecha_objetivo || !form.monto_objetivo) {
            this.setState({ message: "Completa fecha y monto." });
            return;
        }
        this.setState({ creating: true });
        try {
            const numero_objetivo = await this.fetchNextNumeroObjetivo(
                cuenta.correo_cuenta,
            );
            const body = {
                correo_cuenta: cuenta.correo_cuenta,
                fecha_objetivo: form.fecha_objetivo,
                monto_objetivo: Number(form.monto_objetivo),
                estado: form.estado,
                numero_objetivo,
            };
            const res = await fetch(`${SUPABASE_URL}/rest/v1/objetivo`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: this.props.SUPABASE_KEY,
                    Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    Prefer: "return=representation",
                },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                this.setState({
                    message:
                        (data && data.message) ||
                        JSON.stringify(data) ||
                        "Error al crear meta",
                    creating: false,
                });
                return;
            }
            await this.fetchObjetivos();
            this.setState({
                selectedId:
                    Array.isArray(data) && data.length ? data[0].id_objetivo : null,
                successMessage: "Meta creada correctamente",
                form: {
                    fecha_objetivo: "",
                    monto_objetivo: "",
                    estado: "en_progreso",
                },
                showForm: false,
            });
        } catch (err) {
            this.setState({ message: "Error de conexión al crear meta" });
        } finally {
            this.setState({ creating: false });
            setTimeout(() => this.setState({ successMessage: "" }), 2500);
        }
    };

    // FP-32: Calcula un progreso simulado de la meta (40%).
    // Debes cambiar esto por la lógica real de progreso.
    calculateFakeProgress = (objetivo) => {
        const monto_objetivo = Number(objetivo.monto_objetivo) || 0;
        const progreso = monto_objetivo * 0.4;
        const porcentaje = monto_objetivo ? (progreso / monto_objetivo) * 100 : 0;
        return {
            ...objetivo,
            progreso,
            porcentaje: Math.min(100, Math.max(0, porcentaje)),
        };
    };

    // FP-33: Obtiene el detalle de la meta seleccionada, usando su id.
    // Aplica cálculo de progreso y actualiza el estado.
    fetchDetalle = async (id) => {
        if (!id) {
            this.setState({ detalle: null });
            return;
        }
        this.setState({ loading: true, message: "" });
        const { SUPABASE_URL, accessToken } = this.props;
        try {
            const headersBase = {
                "Content-Type": "application/json",
                apikey: this.props.SUPABASE_KEY,
            };
            const headersAuth = accessToken
                ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
                : headersBase;
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${id}`,
                { headers: headersAuth },
            );
            if (!res.ok) {
                this.setState({
                    detalle: null,
                    loading: false,
                    message: "Error al cargar detalle de la meta.",
                });
                return;
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                this.setState({
                    detalle: null,
                    loading: false,
                    message: "Meta no encontrada.",
                });
                return;
            }
            this.setState({ detalle: this.calculateFakeProgress(data[0]) });
        } catch (err) {
            this.setState({
                detalle: null,
                message: "Error de conexión al cargar detalle",
            });
        } finally {
            this.setState({ loading: false });
        }
    };

    // FP-34: Actualiza el estado (en_progreso, en_pausa, terminada) de una meta seleccionada.
    // Refresca lista y detalle tras el cambio.
    updateEstadoMeta = async (id, nuevoEstado) => {
        this.setState({ loading: true, message: "" });
        const { SUPABASE_URL, accessToken } = this.props;
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: this.props.SUPABASE_KEY,
                        Authorization: accessToken ? `Bearer ${accessToken}` : "",
                    },
                    body: JSON.stringify({ estado: nuevoEstado }),
                },
            );
            if (!res.ok) {
                this.setState({
                    message: "No se pudo actualizar el estado.",
                    loading: false,
                });
                return;
            }
            await this.fetchObjetivos();
            await this.fetchDetalle(id);
            this.setState({ successMessage: "Estado actualizado" });
            setTimeout(() => this.setState({ successMessage: "" }), 2000);
        } catch {
            this.setState({ message: "Error al actualizar estado." });
        } finally {
            this.setState({ loading: false });
        }
    };

    // Helpers: formateo, spinner, chart, fecha, estilos...
    currency = (v) =>
        new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 2,
        }).format(Number(v || 0));

    percent = (v) => `${Number(v || 0).toFixed(2)}%`;

    Spinner = ({ size = 18 }) => (
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

    asDateString = (input) => {
        if (!input) return new Date().toISOString().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
        const d = new Date(input);
        if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
        return d.toISOString().slice(0, 10);
    };

    chartData = (monto_objetivo = 0, progreso = 0) => {
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

    // FP-35: Al montar el componente, obtiene la cuenta.
    componentDidMount() {
        this.fetchCuenta();
    }

    // FP-36: Actualiza datos si cambian accessToken, user, cuenta o selectedId.
    componentDidUpdate(prevProps, prevState) {
        if (
            this.props.accessToken !== prevProps.accessToken ||
            this.props.user !== prevProps.user
        ) {
            this.fetchCuenta();
        }
        if (
            this.state.cuenta &&
            (!prevState.cuenta ||
                this.state.cuenta.correo_cuenta !== prevState.cuenta.correo_cuenta)
        ) {
            this.fetchObjetivos();
        }
        if (
            this.state.selectedId &&
            (this.state.selectedId !== prevState.selectedId ||
                (this.state.cuenta &&
                    prevState.cuenta &&
                    this.state.cuenta.correo_cuenta !== prevState.cuenta.correo_cuenta))
        ) {
            this.fetchDetalle(this.state.selectedId);
        }
        if (!this.state.selectedId && prevState.selectedId) {
            this.setState({ detalle: null });
        }
    }

    styles = {
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
    render() {
        const {
            cuenta,
            objetivos,
            selectedId,
            detalle,
            loading,
            loadingList,
            message,
            successMessage,
            showForm,
            form,
            creating,
        } = this.state;
        const { Spinner, styles, estados } = this;
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
                                    <h3 style={{ margin: 0 }}>Tus metas</h3>
                                    <p style={{ margin: 0, color: "#6b7280" }}>
                                        Crea y gestiona tus objetivos de ahorro.
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        className="btn"
                                        onClick={() => {
                                            this.fetchCuenta();
                                            this.fetchObjetivos();
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
                                        onClick={() =>
                                            this.setState((s) => ({ showForm: !s.showForm }))
                                        }
                                        style={{
                                            background: "linear-gradient(135deg,#6366f1,#7c3aed)",
                                            color: "#fff",
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            border: "none",
                                        }}
                                    >
                                        {showForm ? "Ocultar formulario" : "Crear meta"}
                                    </button>
                                </div>
                            </div>
                            {showForm && (
                                <details open style={{ marginTop: 12 }}>
                                    <summary style={{ fontWeight: 700 }}>Nueva meta</summary>
                                    <form
                                        onSubmit={this.createObjetivo}
                                        style={{ marginTop: 10, display: "grid", gap: 8 }}
                                    >
                                        <label>
                                            Fecha objetivo
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={form.fecha_objetivo}
                                                onChange={(e) =>
                                                    this.setState({
                                                        form: { ...form, fecha_objetivo: e.target.value },
                                                    })
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
                                                    this.setState({
                                                        form: { ...form, monto_objetivo: e.target.value },
                                                    })
                                                }
                                                placeholder="1000.00"
                                            />
                                        </label>
                                        <label>
                                            Estado
                                            <select
                                                className="form-input"
                                                value={form.estado}
                                                onChange={(e) =>
                                                    this.setState({
                                                        form: { ...form, estado: e.target.value },
                                                    })
                                                }
                                            >
                                                {estados.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
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
                                                    "Crear meta"
                                                )}
                                            </button>
                                            <button
                                                className="btn"
                                                type="button"
                                                onClick={() =>
                                                    this.setState({
                                                        form: {
                                                            fecha_objetivo: "",
                                                            monto_objetivo: "",
                                                            estado: "en_progreso",
                                                        },
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
                                    <p style={{ marginTop: 8 }}>
                                        No tienes metas creadas todavía.
                                    </p>
                                ) : (
                                    objetivos.map((o) => (
                                        <div key={o.id_objetivo} style={styles.smallCard}>
                                            <div style={{ width: 60 }}>
                                                <Doughnut
                                                    data={this.chartData(
                                                        o.monto_objetivo,
                                                        o.progreso || 0,
                                                    )}
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
                                                        Meta #{o.numero_objetivo} ·{" "}
                                                        {this.currency(o.monto_objetivo)}
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
                                                            ? `${this.currency(o.progreso)} · ${this.percent(o.porcentaje)}`
                                                            : "Sin progreso"}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 12, marginTop: 4 }}>
                                                    Estado:{" "}
                                                    <strong>
                                                        {estados.find((e) => e.value === o.estado)?.label ||
                                                            o.estado}
                                                    </strong>
                                                </div>
                                            </div>
                                            <div>
                                                <button
                                                    className="btn"
                                                    onClick={() =>
                                                        this.setState({ selectedId: o.id_objetivo })
                                                    }
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
                                    <div
                                        style={{ display: "flex", gap: 16, alignItems: "center" }}
                                    >
                                        <div style={{ width: 160 }}>
                                            <Doughnut
                                                data={this.chartData(
                                                    detalle.monto_objetivo,
                                                    detalle.progreso,
                                                )}
                                                options={{
                                                    cutout: "70%",
                                                    plugins: { legend: { position: "bottom" } },
                                                }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: 0 }}>
                                                Meta #{detalle.numero_objetivo}
                                            </h4>
                                            <p style={{ margin: "6px 0" }}>
                                                Cuenta: <strong>{detalle.correo_cuenta}</strong>
                                            </p>
                                            <p style={{ margin: "6px 0" }}>
                                                Fecha objetivo:{" "}
                                                <strong>{detalle.fecha_objetivo}</strong>
                                            </p>
                                            <div style={{ marginTop: 8 }}>
                                                <div>
                                                    Objetivo:{" "}
                                                    <strong>
                                                        {this.currency(detalle.monto_objetivo)}
                                                    </strong>
                                                </div>
                                                <div>
                                                    Progreso:{" "}
                                                    <strong>
                                                        {this.currency(detalle.progreso)} ·{" "}
                                                        {this.percent(detalle.porcentaje)}
                                                    </strong>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 8 }}>
                                                Estado:{" "}
                                                <select
                                                    value={detalle.estado}
                                                    onChange={async (e) => {
                                                        // Validación: no permite marcar terminada si no se cumplió
                                                        if (
                                                            e.target.value === "terminada" &&
                                                            detalle.progreso < detalle.monto_objetivo
                                                        ) {
                                                            alert(
                                                                "No puedes marcar como terminada una meta que aún no has cumplido.",
                                                            );
                                                            return;
                                                        }
                                                        await this.updateEstadoMeta(
                                                            detalle.id_objetivo,
                                                            e.target.value,
                                                        );
                                                        if (e.target.value === "terminada") {
                                                            alert("¡Felicidades! Has terminado tu meta.");
                                                        } else if (e.target.value === "en_pausa") {
                                                            alert(
                                                                "Meta en pausa. No podrás avanzar hasta reanudarla.",
                                                            );
                                                        }
                                                    }}
                                                    disabled={loading || detalle.estado === "terminada"}
                                                >
                                                    {estados.map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ marginTop: 12 }}>
                                                <div style={styles.progressOuter}>
                                                    <div
                                                        style={styles.progressInner(detalle.porcentaje)}
                                                    />
                                                </div>
                                            </div>
                                            {detalle.estado === "terminada" && (
                                                <div style={{ color: "#15803d", marginTop: 8 }}>
                                                    ¡Meta completada!
                                                </div>
                                            )}
                                            {detalle.estado === "en_pausa" && (
                                                <div style={{ color: "#a16207", marginTop: 8 }}>
                                                    Meta en pausa. No puedes avanzar en esta meta hasta
                                                    reanudarla.
                                                </div>
                                            )}
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
}
