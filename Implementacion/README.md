# Daily Input App - Registro de Finanzas Personales

Bienvenido al proyecto **Daily Input App**. Esta es una aplicación sencilla para registrar tus ingresos y gastos diarios, utilizando **React** y una base de datos **Supabase** para gestionar los movimientos.

Este documento te guiará paso a paso para que puedas descargar y ejecutar la aplicación en tu propio computador, incluso si nunca lo has hecho antes.

---

## 1. Requisitos Indispensables (Lo que necesitas)

Para que esta aplicación funcione, necesitarás tener instaladas dos cosas en tu computadora:

### A. Node.js (El motor de JavaScript)

Node.js es el programa que permite a tu computadora ejecutar el código de React.

* **¿Cómo instalarlo?**
    1.  Ve a la página oficial de Node.js: [https://nodejs.org/](https://nodejs.org/)
    2.  Descarga e instala la versión **LTS (Recomendada para la mayoría de usuarios)**.
    3.  Sigue las instrucciones del instalador (normalmente basta con presionar "Siguiente" o "Next" varias veces).

### B. Supabase (La Base de Datos en la Nube)

Supabase es donde se guardarán tus cuentas, movimientos y conceptos.

* **¿Qué necesitas de Supabase?**
    1.  Una **cuenta** gratuita en [Supabase.com](https://supabase.com/).
    2.  Crear un nuevo **Proyecto**.
    3.  Obtener dos datos clave de tu proyecto (los encontrarás en la sección **Settings > API**):
        * `SUPABASE_URL`: La URL de tu API (ej: `https://abcd1234.supabase.co`).
        * `SUPABASE_KEY`: La clave pública (`anon key`).

---

## 🛠️ 2. Configuración de la Base de Datos (SQL)

Antes de ejecutar el código, debes asegurarte de que la estructura de tu base de datos en Supabase sea la correcta, incluyendo las tablas y las funciones que el código utiliza

### A. Crear las Tablas

Tu aplicación utiliza las siguientes tablas (como se ve en el esquema de la imagen):

* `usuario`
* `cuenta`
* `concepto`
* `objetivo`
* `movimiento_concepto`
* `movimiento_espontaneo`

Debes crearlas manualmente siguiendo la estructura del esquema

### B. Funciones RPC (Remote Procedure Call)

La aplicación hace llamadas a funciones especiales en Supabase (llamadas RPC). **Estas funciones deben estar creadas en la base de datos**

---

## 3. Ejecución del Proyecto

Sigue estos pasos:

### A. Descargar el Código (Clonar)

1.  Abre la aplicación de **Terminal** (**PowerShell** en Windows / **Terminal** en Mac)
2.  Navega hasta la carpeta donde quieres guardar el proyecto (ejemplo: `cd ~/Documentos/proyectos`).
3.  Copia la URL de tu repositorio en GitHub y ejecuta el comando para clonar:

    ```bash
    git clone https://github.com/ZeroDyna/Planify.git
    ```

4.  Entra a la carpeta del proyecto recién descargado:

    ```bash
    cd Planify
    ```

### B. Instalar Dependencias

Los proyectos de React usan librerías externas. Este comando las descarga e instala automáticamente:

```bash
npm install