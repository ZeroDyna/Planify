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
        nombre: "",
        fecha_objetivo: "",
        monto_objetivo: "",
      },
      creating: false,
      balanceTotal: 0,
      balanceAsignado: 0,
      editing: false,
      editForm: {
        nombre: "",
        monto_objetivo: "",
      },
    };
  }

  fetchCuenta = async () => {
    this.setState({ message: "" });
    const { SUPABASE_URL, accessToken, user } = this.props;
    try {
      const emailFromUser =
        user?.email || user?.correo || user?.user?.email || user?._raw?.correo;
      let url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&limit=1`;
      if (emailFromUser) {
        url = `${SUPABASE_URL}/rest/v1/cuenta?select=correo_cuenta,nombre_cuenta&correo_usuario=eq.${encodeURIComponent(
          emailFromUser
        )}&limit=1`;
      }
      const headersBase = {
        "Content-Type": "application/json",
        apikey: this.props.SUPABASE_KEY,
      };
      const headersAuth = accessToken
        ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
        : headersBase;
      const res = await fetch(url, { headers: headersAuth });
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
      console.error("fetchCuenta error:", err);
      this.setState({
        message: "Error de conexión al obtener la cuenta.",
        cuenta: null,
      });
    }
  };

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
      const res = await fetch(url, { headers: headersAuth });
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

      const objetivosConProgreso = this.calculateProgressForAll(data || []);

      this.setState({
        objetivos: objetivosConProgreso,
        selectedId:
          Array.isArray(data) && data.length > 0 ? data[0].id_objetivo : null,
      });
    } catch (err) {
      console.error("fetchObjetivos error:", err);
      this.setState({
        message: "Error de conexión al cargar metas.",
        objetivos: [],
        selectedId: null,
      });
    } finally {
      this.setState({ loadingList: false });
    }
  };

  createObjetivo = async (e) => {
    e?.preventDefault();
    this.setState({ message: "", successMessage: "" });
    const { SUPABASE_URL, accessToken } = this.props;
    const { cuenta, objetivos } = this.state;

    if (!cuenta) {
      this.setState({ message: "No hay cuenta asociada a tu usuario." });
      return;
    }

    const { nombre, fecha_objetivo, monto_objetivo } = this.state.form;

    if (!nombre || !fecha_objetivo || !monto_objetivo) {
      this.setState({ message: "Completa todos los campos." });
      return;
    }

    const montoNum = Number(monto_objetivo);
    if (montoNum <= 0) {
      this.setState({ message: "El monto debe ser mayor a 0." });
      return;
    }

    this.setState({ creating: true });
    try {
      const hayMetasActivas = objetivos.some((o) => o.estado === "en_progreso");
      const estadoInicial = hayMetasActivas ? "en_pausa" : "en_progreso";

      const body = {
        correo_cuenta: cuenta.correo_cuenta,
        nombre: nombre.trim(),
        fecha_objetivo,
        monto_objetivo: montoNum,
        estado: estadoInicial,
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
          message: (data && data.message) || "Error al crear meta",
          creating: false,
        });
        return;
      }

      await this.fetchObjetivos();
      this.setState({
        selectedId:
          Array.isArray(data) && data.length ? data[0].id_objetivo : null,
        successMessage: `Meta "${nombre}" creada ${
          estadoInicial === "en_progreso"
            ? "y activada"
            : "(en pausa - activa otra meta primero)"
        }`,
        form: { nombre: "", fecha_objetivo: "", monto_objetivo: "" },
        showForm: false,
      });
    } catch (err) {
      console.error("createObjetivo error:", err);
      this.setState({ message: "Error de conexión al crear meta" });
    } finally {
      this.setState({ creating: false });
      setTimeout(() => this.setState({ successMessage: "" }), 3000);
    }
  };

  updateObjetivo = async (e) => {
    e?.preventDefault();
    this.setState({ message: "", successMessage: "" });
    const { SUPABASE_URL, accessToken } = this.props;
    const { detalle, editForm } = this.state;

    if (!detalle) {
      this.setState({ message: "No hay meta seleccionada." });
      return;
    }

    const { nombre, monto_objetivo } = editForm;

    if (!nombre || !monto_objetivo) {
      this.setState({ message: "Completa todos los campos." });
      return;
    }

    const montoNum = Number(monto_objetivo);
    if (montoNum <= 0) {
      this.setState({ message: "El monto debe ser mayor a 0." });
      return;
    }

    this.setState({ loading: true });
    try {
      const body = {
        nombre: nombre.trim(),
        monto_objetivo: montoNum,
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${detalle.id_objetivo}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: this.props.SUPABASE_KEY,
            Authorization: accessToken ? `Bearer ${accessToken}` : "",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        this.setState({
          message: "Error al actualizar la meta",
          loading: false,
        });
        return;
      }

      await this.fetchObjetivos();
      await this.fetchDetalle(detalle.id_objetivo);
      this.setState({
        successMessage: "Meta actualizada correctamente",
        editing: false,
      });
      setTimeout(() => this.setState({ successMessage: "" }), 3000);
    } catch (err) {
      console.error("updateObjetivo error:", err);
      this.setState({ message: "Error de conexión al actualizar meta" });
    } finally {
      this.setState({ loading: false });
    }
  };

  calculateProgressForAll = (objetivos) => {
    const { balanceTotal } = this.state;
    let balanceAsignadoTotal = 0;

    return objetivos.map((obj) => {
      const monto_objetivo = Number(obj.monto_objetivo) || 0;

      if (obj.estado === "terminada") {
        balanceAsignadoTotal += monto_objetivo;
        return {
          ...obj,
          progreso: monto_objetivo,
          porcentaje: 100,
        };
      }

      if (obj.estado === "en_progreso") {
        const balanceDisponible = balanceTotal - balanceAsignadoTotal;
        const progreso = Math.min(balanceDisponible, monto_objetivo);
        const porcentaje =
          monto_objetivo > 0 ? (progreso / monto_objetivo) * 100 : 0;

        return {
          ...obj,
          progreso: Math.max(0, progreso),
          porcentaje: Math.min(100, Math.max(0, porcentaje)),
        };
      }

      return {
        ...obj,
        progreso: 0,
        porcentaje: 0,
      };
    });
  };

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
        { headers: headersAuth }
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

      const objetivosActualizados = this.calculateProgressForAll(
        this.state.objetivos
      );
      const detalleActualizado =
        objetivosActualizados.find((o) => o.id_objetivo === id) || data[0];

      this.setState({
        detalle: detalleActualizado,
        editForm: {
          nombre: detalleActualizado.nombre || "",
          monto_objetivo: detalleActualizado.monto_objetivo || "",
        },
        editing: false,
      });
    } catch (err) {
      console.error("fetchDetalle error:", err);
      this.setState({
        detalle: null,
        message: "Error de conexión al cargar detalle",
      });
    } finally {
      this.setState({ loading: false });
    }
  };

  updateEstadoMeta = async (id, nuevoEstado) => {
    const { objetivos } = this.state;
    const metaActual = objetivos.find((o) => o.id_objetivo === id);

    if (!metaActual) return;

    if (
      nuevoEstado === "terminada" &&
      metaActual.progreso < metaActual.monto_objetivo
    ) {
      this.setState({
        message:
          "No puedes marcar como terminada una meta que aún no has cumplido.",
      });
      setTimeout(() => this.setState({ message: "" }), 3000);
      return;
    }

    this.setState({ loading: true, message: "" });
    const { SUPABASE_URL, accessToken } = this.props;

    try {
      if (nuevoEstado === "en_progreso") {
        const metasActivas = objetivos.filter(
          (o) => o.estado === "en_progreso" && o.id_objetivo !== id
        );

        for (const meta of metasActivas) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${meta.id_objetivo}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: this.props.SUPABASE_KEY,
                Authorization: accessToken ? `Bearer ${accessToken}` : "",
              },
              body: JSON.stringify({ estado: "en_pausa" }),
            }
          );
        }
      }

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
        }
      );

      if (!res.ok) {
        this.setState({
          message: "No se pudo actualizar el estado.",
          loading: false,
        });
        return;
      }

      if (nuevoEstado === "terminada") {
        const siguienteMeta = objetivos
          .filter((o) => o.estado === "en_pausa")
          .sort((a, b) => a.id_objetivo - b.id_objetivo)[0];

        if (siguienteMeta) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/objetivo?id_objetivo=eq.${siguienteMeta.id_objetivo}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: this.props.SUPABASE_KEY,
                Authorization: accessToken ? `Bearer ${accessToken}` : "",
              },
              body: JSON.stringify({ estado: "en_progreso" }),
            }
          );
          this.setState({
            successMessage: `¡Meta completada! "${siguienteMeta.nombre}" ahora está activa.`,
          });
        } else {
          this.setState({ successMessage: "¡Felicidades! Meta completada." });
        }
      } else if (nuevoEstado === "en_progreso") {
        this.setState({ successMessage: "Meta activada correctamente" });
      } else {
        this.setState({ successMessage: "Meta pausada" });
      }

      await this.fetchObjetivos();
      await this.fetchDetalle(id);

      setTimeout(() => this.setState({ successMessage: "" }), 3000);
    } catch (err) {
      console.error("updateEstadoMeta error:", err);
      this.setState({ message: "Error al actualizar estado." });
    } finally {
      this.setState({ loading: false });
    }
  };

  fetchBalanceTotal = async () => {
    const { SUPABASE_URL, accessToken } = this.props;
    const { cuenta } = this.state;

    if (!cuenta) {
      this.setState({ balanceTotal: 0 });
      return;
    }

    try {
      const headersBase = {
        "Content-Type": "application/json",
        apikey: this.props.SUPABASE_KEY,
      };
      const headersAuth = accessToken
        ? { ...headersBase, Authorization: `Bearer ${accessToken}` }
        : headersBase;

      const urlConcepto = `${SUPABASE_URL}/rest/v1/movimiento_concepto?select=*,concepto:id_concepto(tipo)&correo_cuenta=eq.${encodeURIComponent(
        cuenta.correo_cuenta
      )}`;

      const resConcepto = await fetch(urlConcepto, { headers: headersAuth });

      const urlEspontaneo = `${SUPABASE_URL}/rest/v1/movimiento_espontaneo?select=*&correo_cuenta=eq.${encodeURIComponent(
        cuenta.correo_cuenta
      )}`;

      const resEspontaneo = await fetch(urlEspontaneo, {
        headers: headersAuth,
      });

      let totalIncome = 0;
      let totalExpense = 0;

      if (resConcepto.ok) {
        const dataConcepto = await resConcepto.json();
        (dataConcepto || []).forEach((m) => {
          const tipo = m.concepto?.tipo;
          const monto = Number(m.monto || 0);
          if (tipo === true) {
            totalIncome += monto;
          } else if (tipo === false) {
            totalExpense += monto;
          }
        });
      }

      if (resEspontaneo.ok) {
        const dataEspontaneo = await resEspontaneo.json();
        (dataEspontaneo || []).forEach((m) => {
          const monto = Number(m.monto || 0);
          if (m.tipo === true) {
            totalIncome += monto;
          } else if (m.tipo === false) {
            totalExpense += monto;
          }
        });
      }

      const balance = totalIncome - totalExpense;
      this.setState({ balanceTotal: Math.max(0, balance) });
    } catch (err) {
      console.error("fetchBalanceTotal error:", err);
      this.setState({ balanceTotal: 0 });
    }
  };

  currency = (v) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(Number(v || 0));

  percent = (v) => `${Number(v || 0).toFixed(1)}%`;

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

  componentDidMount() {
    this.fetchCuenta();
  }

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
      this.fetchBalanceTotal();
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
    if (
      this.state.balanceTotal !== prevState.balanceTotal &&
      this.state.objetivos.length > 0
    ) {
      const objetivosActualizados = this.calculateProgressForAll(
        this.state.objetivos
      );
      this.setState({ objetivos: objetivosActualizados });

      if (this.state.detalle) {
        const detalleActualizado = objetivosActualizados.find(
          (o) => o.id_objetivo === this.state.detalle.id_objetivo
        );
        if (detalleActualizado) {
          this.setState({ detalle: detalleActualizado });
        }
      }
    }
  }

  styles = {
    container: { display: "flex", gap: 20, flexWrap: "wrap", padding: 12 },
    left: { flex: "1 1 360px", minWidth: 320 },
    right: { flex: "1 1 420px", minWidth: 320 },
    card: {
      padding: 14,
      borderRadius: 10,
      background: "white",
      boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
    },
    smallCard: (isActive) => ({
      padding: 12,
      borderRadius: 8,
      background: "#fff",
      boxShadow: isActive
        ? "0 4px 16px rgba(99,102,241,0.2)"
        : "0 4px 12px rgba(2,6,23,0.04)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
      border: isActive ? "2px solid #6366f1" : "1px solid #f3f4f6",
      position: "relative",
    }),
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
      background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
      transition: "width 0.3s ease",
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
      balanceTotal,
      editing,
      editForm,
    } = this.state;
    const { Spinner, styles } = this;

    const metaActiva = objetivos.find((o) => o.estado === "en_progreso");

    return (
      <>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .btn {
            padding: 8px 12px;
            borderRadius: 8px;
            border: none;
            cursor: pointer;
            fontSize: 14px;
            fontWeight: 500;
            background: #f3f4f6;
            color: #374151;
            transition: all 0.2s;
          }
          .btn:hover { background: #e5e7eb; }
          .btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .btn-primary {
            background: linear-gradient(135deg,#6366f1,#7c3aed);
            color: #fff;
          }
          .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
          .btn-success {
            background: linear-gradient(135deg,#10b981,#059669);
            color: #fff;
          }
          .btn-warning {
            background: linear-gradient(135deg,#f59e0b,#d97706);
            color: #fff;
          }
          .btn-edit {
            background: linear-gradient(135deg,#06b6d4,#0891b2);
            color: #fff;
          }
          .form-input {
            width: 100%;
            padding: 8px;
            borderRadius: 6px;
            border: 1px solid #e5e7eb;
            marginTop: 4px;
          }
          .badge {
            padding: 4px 10px;
            borderRadius: 6px;
            fontSize: 12px;
            fontWeight: 600;
          }
          .badge-active {
            background: #dbeafe;
            color: #1e40af;
          }
          .badge-paused {
            background: #fef3c7;
            color: #92400e;
          }
          .badge-completed {
            background: #d1fae5;
            color: #065f46;
          }
        `}</style>
        <div style={styles.container}>
          <div style={styles.left}>
            <div style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>Tus metas</h3>
                  <p
                    style={{ margin: "4px 0", color: "#6b7280", fontSize: 14 }}
                  >
                    Progresa meta por meta secuencialmente
                  </p>
                </div>
                <button
                  className="btn"
                  onClick={async () => {
                    await this.fetchCuenta();
                    await this.fetchBalanceTotal();
                    await this.fetchObjetivos();
                  }}
                >
                  {loadingList ? <Spinner /> : "Refrescar"}
                </button>
              </div>

              {message && (
                <div
                  style={{
                    color: "#b91c1c",
                    marginBottom: 12,
                    padding: 10,
                    background: "#fee2e2",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  {message}
                </div>
              )}
              {successMessage && (
                <div
                  style={{
                    color: "#065f46",
                    marginBottom: 12,
                    padding: 10,
                    background: "#d1fae5",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                >
                  {successMessage}
                </div>
              )}

              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)",
                  borderRadius: 8,
                  border: "1px solid #bae6fd",
                }}
              >
                <div
                  style={{ fontSize: 13, color: "#0369a1", marginBottom: 4 }}
                >
                  Balance total disponible
                </div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#0c4a6e" }}
                >
                  {this.currency(balanceTotal)}
                </div>
                {metaActiva && (
                  <div style={{ fontSize: 12, color: "#0369a1", marginTop: 6 }}>
                    🎯 Progresando en: {metaActiva.nombre}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{ fontWeight: 600, display: "block", marginBottom: 6 }}
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
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      this.setState((s) => ({ showForm: !s.showForm }))
                    }
                    disabled={!cuenta}
                  >
                    {showForm ? "Ocultar formulario" : "Crear meta"}
                  </button>
                </div>
              </div>

              {showForm && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <h4 style={{ margin: "0 0 12px 0" }}>Nueva meta</h4>
                  <form
                    onSubmit={this.createObjetivo}
                    style={{ display: "grid", gap: 10 }}
                  >
                    <label>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          fontSize: 14,
                        }}
                      >
                        Nombre de la meta
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        value={form.nombre}
                        onChange={(e) =>
                          this.setState({
                            form: { ...form, nombre: e.target.value },
                          })
                        }
                        placeholder="Ej: Vacaciones en Europa"
                      />
                    </label>
                    <label>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          fontSize: 14,
                        }}
                      >
                        Fecha objetivo
                      </div>
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
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          fontSize: 14,
                        }}
                      >
                        Monto objetivo
                      </div>
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
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
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
                              nombre: "",
                              fecha_objetivo: "",
                              monto_objetivo: "",
                            },
                          })
                        }
                      >
                        Limpiar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 15 }}>
                  Mis metas
                </h4>
                {loadingList ? (
                  <p>
                    <Spinner /> Cargando...
                  </p>
                ) : objetivos.length === 0 ? (
                  <p style={{ marginTop: 8, color: "#6b7280" }}>
                    No tienes metas creadas todavía.
                  </p>
                ) : (
                  objetivos.map((o) => {
                    const isActive = o.estado === "en_progreso";
                    const isCompleted = o.estado === "terminada";
                    const isPaused = o.estado === "en_pausa";

                    return (
                      <div
                        key={o.id_objetivo}
                        style={styles.smallCard(isActive)}
                      >
                        {isActive && (
                          <div
                            style={{
                              position: "absolute",
                              top: -8,
                              left: 12,
                              background:
                                "linear-gradient(135deg, #6366f1, #8b5cf6)",
                              color: "white",
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
                            }}
                          >
                            ⚡ ACTIVA
                          </div>
                        )}
                        <div style={{ width: 60, flexShrink: 0 }}>
                          <Doughnut
                            data={this.chartData(
                              o.monto_objetivo,
                              o.progreso || 0
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
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 15 }}>
                              {o.nombre || `Meta #${o.id_objetivo}`}
                            </div>
                            <span
                              className={`badge ${
                                isCompleted
                                  ? "badge-completed"
                                  : isActive
                                  ? "badge-active"
                                  : "badge-paused"
                              }`}
                            >
                              {isCompleted
                                ? "Completada"
                                : isActive
                                ? "En progreso"
                                : "En pausa"}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#6b7280",
                              marginBottom: 6,
                            }}
                          >
                            Objetivo:{" "}
                            <strong>{this.currency(o.monto_objetivo)}</strong>
                            {" · "}
                            {o.fecha_objetivo}
                          </div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={styles.progressOuter}>
                              <div
                                style={styles.progressInner(o.porcentaje || 0)}
                              />
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                            }}
                          >
                            {isCompleted ? (
                              <span
                                style={{ color: "#065f46", fontWeight: 600 }}
                              >
                                ✓ Meta completada
                              </span>
                            ) : (
                              <>
                                {this.currency(o.progreso || 0)} ·{" "}
                                {this.percent(o.porcentaje || 0)}
                                {isPaused && (
                                  <span
                                    style={{ color: "#92400e", marginLeft: 8 }}
                                  >
                                    (pausada)
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <button
                            className="btn"
                            onClick={() =>
                              this.setState({ selectedId: o.id_objetivo })
                            }
                            style={{ fontSize: 13, padding: "6px 10px" }}
                          >
                            Ver
                          </button>
                          {!isCompleted && !isActive && (
                            <button
                              className="btn btn-success"
                              onClick={() =>
                                this.updateEstadoMeta(
                                  o.id_objetivo,
                                  "en_progreso"
                                )
                              }
                              style={{ fontSize: 12, padding: "6px 10px" }}
                            >
                              Activar
                            </button>
                          )}
                          {isActive && (
                            <button
                              className="btn btn-warning"
                              onClick={() =>
                                this.updateEstadoMeta(o.id_objetivo, "en_pausa")
                              }
                              style={{ fontSize: 12, padding: "6px 10px" }}
                            >
                              Pausar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho - Detalle */}
          <div style={styles.right}>
            <div style={styles.card}>
              <h3 style={{ margin: "0 0 16px 0" }}>Detalle & progreso</h3>
              {loading ? (
                <p>
                  <Spinner /> Cargando detalle...
                </p>
              ) : !detalle ? (
                <p style={{ color: "#6b7280" }}>
                  Selecciona una meta para ver su progreso.
                </p>
              ) : (
                <div>
                  {editing ? (
                    <div
                      style={{
                        marginBottom: 20,
                        padding: 12,
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <h4 style={{ margin: "0 0 12px 0" }}>Editar meta</h4>
                      <form
                        onSubmit={this.updateObjetivo}
                        style={{ display: "grid", gap: 10 }}
                      >
                        <label>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 4,
                              fontSize: 14,
                            }}
                          >
                            Nombre de la meta
                          </div>
                          <input
                            type="text"
                            className="form-input"
                            value={editForm.nombre}
                            onChange={(e) =>
                              this.setState({
                                editForm: {
                                  ...editForm,
                                  nombre: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 4,
                              fontSize: 14,
                            }}
                          >
                            Monto objetivo
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={editForm.monto_objetivo}
                            onChange={(e) =>
                              this.setState({
                                editForm: {
                                  ...editForm,
                                  monto_objetivo: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                          >
                            Guardar cambios
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => this.setState({ editing: false })}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "flex",
                          gap: 20,
                          alignItems: "center",
                          marginBottom: 20,
                        }}
                      >
                        <div style={{ width: 140, flexShrink: 0 }}>
                          <Doughnut
                            data={this.chartData(
                              detalle.monto_objetivo,
                              detalle.progreso
                            )}
                            options={{
                              cutout: "70%",
                              plugins: {
                                legend: {
                                  position: "bottom",
                                  labels: { font: { size: 11 } },
                                },
                              },
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 8px 0" }}>
                            {detalle.nombre || `Meta #${detalle.id_objetivo}`}
                          </h4>
                          <div
                            style={{
                              fontSize: 14,
                              color: "#6b7280",
                              marginBottom: 4,
                            }}
                          >
                            <strong>Cuenta:</strong> {detalle.correo_cuenta}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: "#6b7280",
                              marginBottom: 4,
                            }}
                          >
                            <strong>Fecha objetivo:</strong>{" "}
                            {detalle.fecha_objetivo}
                          </div>
                          <div style={{ fontSize: 14, color: "#6b7280" }}>
                            <strong>Estado:</strong>{" "}
                            <span
                              className={`badge ${
                                detalle.estado === "terminada"
                                  ? "badge-completed"
                                  : detalle.estado === "en_progreso"
                                  ? "badge-active"
                                  : "badge-paused"
                              }`}
                            >
                              {detalle.estado === "terminada"
                                ? "Completada"
                                : detalle.estado === "en_progreso"
                                ? "En progreso"
                                : "En pausa"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                          marginBottom: 20,
                        }}
                      >
                        <div
                          style={{
                            padding: 12,
                            background: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginBottom: 4,
                            }}
                          >
                            Objetivo
                          </div>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#111827",
                            }}
                          >
                            {this.currency(detalle.monto_objetivo)}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 12,
                            background:
                              detalle.estado === "en_progreso"
                                ? "#f0f9ff"
                                : "#f8fafc",
                            borderRadius: 8,
                            border:
                              detalle.estado === "en_progreso"
                                ? "1px solid #bae6fd"
                                : "1px solid #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginBottom: 4,
                            }}
                          >
                            Progreso actual
                          </div>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color:
                                detalle.estado === "en_progreso"
                                  ? "#0369a1"
                                  : "#111827",
                            }}
                          >
                            {this.currency(detalle.progreso)}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginBottom: 8,
                          }}
                        >
                          Porcentaje completado
                        </div>
                        <div style={styles.progressOuter}>
                          <div
                            style={styles.progressInner(detalle.porcentaje)}
                          />
                        </div>
                        <div
                          style={{
                            textAlign: "center",
                            marginTop: 8,
                            fontSize: 24,
                            fontWeight: 700,
                            color:
                              detalle.porcentaje >= 100 ? "#059669" : "#6366f1",
                          }}
                        >
                          {this.percent(detalle.porcentaje)}
                        </div>
                      </div>

                      {detalle.estado === "terminada" && (
                        <div
                          style={{
                            padding: 12,
                            background: "#d1fae5",
                            borderRadius: 8,
                            color: "#065f46",
                            textAlign: "center",
                            fontWeight: 600,
                            marginBottom: 16,
                          }}
                        >
                          🎉 ¡Meta completada exitosamente!
                        </div>
                      )}

                      {detalle.estado === "en_pausa" && (
                        <div
                          style={{
                            padding: 12,
                            background: "#fef3c7",
                            borderRadius: 8,
                            color: "#92400e",
                            fontSize: 14,
                            marginBottom: 16,
                          }}
                        >
                          ⏸️ Meta en pausa. Actívala para continuar progresando.
                        </div>
                      )}

                      {detalle.estado === "en_progreso" && (
                        <div
                          style={{
                            padding: 12,
                            background: "#dbeafe",
                            borderRadius: 8,
                            color: "#1e40af",
                            fontSize: 14,
                            marginBottom: 16,
                          }}
                        >
                          ⚡ Esta meta está activa y recibiendo progreso de tu
                          balance.
                        </div>
                      )}

                      {/* Acciones */}
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {detalle.estado !== "terminada" && (
                          <button
                            className="btn btn-edit"
                            onClick={() => this.setState({ editing: true })}
                            disabled={loading}
                            style={{ flex: 1 }}
                          >
                            ✏️ Editar meta
                          </button>
                        )}
                        {detalle.estado === "en_progreso" && (
                          <button
                            className="btn btn-warning"
                            onClick={() =>
                              this.updateEstadoMeta(
                                detalle.id_objetivo,
                                "en_pausa"
                              )
                            }
                            disabled={loading}
                            style={{ flex: 1 }}
                          >
                            Pausar meta
                          </button>
                        )}
                        {detalle.estado === "en_pausa" && (
                          <button
                            className="btn btn-success"
                            onClick={() =>
                              this.updateEstadoMeta(
                                detalle.id_objetivo,
                                "en_progreso"
                              )
                            }
                            disabled={loading}
                            style={{ flex: 1 }}
                          >
                            Activar meta
                          </button>
                        )}
                        {detalle.estado === "en_progreso" &&
                          detalle.porcentaje >= 100 && (
                            <button
                              className="btn btn-primary"
                              onClick={() =>
                                this.updateEstadoMeta(
                                  detalle.id_objetivo,
                                  "terminada"
                                )
                              }
                              disabled={loading}
                              style={{ flex: 1 }}
                            >
                              ✓ Marcar como completada
                            </button>
                          )}
                      </div>

                      {detalle.estado === "en_progreso" &&
                        detalle.porcentaje < 100 && (
                          <div
                            style={{
                              marginTop: 16,
                              padding: 10,
                              background: "#f8fafc",
                              borderRadius: 6,
                              fontSize: 13,
                              color: "#6b7280",
                            }}
                          >
                            💡 Sigue agregando ingresos en Daily Input para
                            alcanzar tu meta. Te faltan{" "}
                            {this.currency(
                              detalle.monto_objetivo - detalle.progreso
                            )}
                          </div>
                        )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
}
