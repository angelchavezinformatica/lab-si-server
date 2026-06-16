# Python Sandbox - Laboratorio de Seguridad Informática

Este es un entorno básico de ejecución (sandbox) de código Python diseñado con fines exclusivamente académicos y de investigación en seguridad informática. El objetivo principal de la aplicación es demostrar escenarios prácticos de auditoría de sistemas, análisis de procesos y **escalada de privilegios locales**.

⚠️ **ADVERTENCIA DE SEGURIDAD CRÍTICA** ⚠️

- **Ejecución Arbitraria de Código (RCE):** Por diseño, esta aplicación permite ejecutar cualquier código Python directamente en el sistema operativo host con los privilegios del proceso del servidor de Node.js.
- **Sin Aislamiento (No Sandboxed):** El entorno no aplica políticas de restricción de permisos o aislamiento de recursos para permitir la demostración de escalada de privilegios.
- **Uso Red Local/Localhost:** El servidor está configurado por defecto para escuchar únicamente en `127.0.0.1` (localhost). **NUNCA expongas esta aplicación al internet público o a redes no confiables**, ya que permitiría a terceros tomar control completo de la máquina donde se ejecuta el servidor.

---

## Características

- **Editor Web Interactivo:** Permite escribir código Python personalizado con soporte de indentación automática (Tab).
- **Consola integrada:** Visualización en tiempo real de salidas estándar (`stdout`) y errores (`stderr`).
- **Plantillas Educativas integradas:**
  - Inspección básica de identidad y variables de entorno del sistema (`whoami`, `id`, `os.getcwd`).
  - Listado de procesos activos (`ps aux`).
  - Auditoría y búsqueda de binarios del sistema con bit SUID activado (`find / -perm -4000`).
  - Simulación conceptual de escalada de privilegios y lectura de archivos de sistema (`/etc/passwd`).

---

## Requisitos Previos

- **Node.js** (v18 o superior recomendado)
- **Python 3** (instalado y accesible en el PATH del sistema como `python3`)

---

## Instalación y Ejecución

1. Clonar o descargar el repositorio e ingresar a la carpeta del proyecto:

   ```bash
   cd lab-si-server
   ```

2. Instalar las dependencias de Node.js necesarias:

   ```bash
   npm install
   ```

3. Iniciar el servidor web:

   ```bash
   node server.js
   ```

4. Abrir un navegador web y acceder a:
   [http://127.0.0.1:3000](http://127.0.0.1:3000)

---

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
