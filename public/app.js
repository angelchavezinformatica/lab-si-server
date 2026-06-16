document.addEventListener('DOMContentLoaded', () => {
    const codeEditor = document.getElementById('code-editor');
    const lineNumbers = document.getElementById('line-numbers');
    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-btn');
    const presetsSelect = document.getElementById('presets');
    const terminalOutput = document.getElementById('terminal-output');
    const terminalStats = document.getElementById('terminal-stats');
    const statExit = document.getElementById('stat-exit');
    const statTime = document.getElementById('stat-time');

    const connStatus = document.getElementById('connection-status');
    const serverUserSpan = document.getElementById('server-user');

    // Stdin interactive elements
    const terminalInputLine = document.getElementById('terminal-input-line');
    const terminalStdin = document.getElementById('terminal-stdin');

    // System Info spans
    const infoOs = document.getElementById('info-os');
    const infoHost = document.getElementById('info-host');
    const infoUidGid = document.getElementById('info-uid-gid');
    const infoShell = document.getElementById('info-shell');

    let socket = null;

    // Preset Python scripts
    const templates = {
        basic: `# Hola Mundo Básico
print("¡Hola, Mundo desde el Laboratorio de Seguridad Informática!")
print("Este es un entorno libre de ejecución de código Python.")
`,
        'sys-info': `# Exploración de Información del Sistema
import os
import sys
import platform

print("=== Información del Intérprete Python ===")
print("Versión de Python: ", sys.version)
print("Plataforma:        ", sys.platform)
print("Ejecutable:        ", sys.executable)
print("")

print("=== Credenciales del Proceso Actual ===")
print("UID Real:    ", os.getuid() if hasattr(os, 'getuid') else 'N/A')
print("GID Real:    ", os.getgid() if hasattr(os, 'getgid') else 'N/A')
print("Directorio de trabajo: ", os.getcwd())
print("")

print("=== Comandos de Consola Ejecutados en el Host ===")
print("Usuario (whoami):")
os.system("whoami")
print("Identificadores (id):")
os.system("id")
`,
        interactive: `# Entrada Interactiva de Usuario (stdin)
import sys

print("=== Demostración de Entrada de Usuario (stdin) ===")
print("Escribe tus respuestas en la línea inferior y presiona Enter.")
print("-" * 55)

try:
    nombre = input("Introduce tu nombre: ")
    print(f"[+] Hola, {nombre}!")
    
    ciudad = input("¿De qué ciudad eres?: ")
    print(f"[+] ¡Excelente! {nombre} de {ciudad}.")
    
    numero = input("Escribe un número para duplicar: ")
    val = int(numero)
    print(f"[+] El doble de {val} es {val * 2}.")
except ValueError:
    print("[-] Eso no parece un número válido.")
except Exception as e:
    print("[-] Ocurrió un error leyendo la entrada:", e)
`,
        processes: `# Listar Procesos del Sistema
import os

print("=== Listado de los primeros 15 Procesos (ps aux) ===")
print("Auditar los procesos en ejecución ayuda a detectar privilegios elevados")
print("o aplicaciones vulnerables ejecutándose como root.")
print("-" * 55)

os.system("ps aux | head -n 16")
`,
        'suid-search': `# Búsqueda de archivos SUID en directorios comunes
import os

print("=== Búsqueda de Archivos con bit SUID activado ===")
print("El bit SUID permite que un archivo se ejecute con los permisos de su propietario.")
print("Si el propietario es root, un fallo en el binario puede dar acceso root.")
print("Buscando en directorios del sistema (primeros 15 resultados)...")
print("-" * 55)

# Buscar binarios SUID
cmd = "find /usr/bin /usr/sbin /usr/local/bin /bin /sbin -perm -4000 -type f 2>/dev/null | head -n 15"
os.system(cmd)
`,
        'suid-exploit': `# Simulación de Escalada de Privilegios
import os
import sys

print("=== Demostración Conceptual de Escalada ===")
print("Para fines educativos, asumamos que quieres probar si tienes privilegios elevados.")
print("")
print("1. Identificar privilegios actuales:")
os.system("id")

print("")
print("2. Verificación de archivos clave legibles (e.g. /etc/passwd):")
try:
    with open('/etc/passwd', 'r') as f:
        print("[+] Éxito al leer /etc/passwd (Primeras 5 líneas):")
        for i in range(5):
            line = f.readline()
            if not line: break
            print("    " + line.strip())
except Exception as e:
    print("[-] Error al leer /etc/passwd:", e)

print("")
print("3. Intento de lectura de archivo confidencial (e.g. /etc/shadow):")
try:
    with open('/etc/shadow', 'r') as f:
        print("[+] ¡ÉXITO! Se puede leer /etc/shadow (¡Vulnerabilidad grave / Privilegios de Root!):")
        print("    " + f.readline().strip())
except Exception as e:
    print("[-] Acceso denegado a /etc/shadow (Comportamiento seguro / Usuario normal):", e)
`,
        custom: `# Escribe aquí tu código personalizado para pruebas de auditoría...
import os

os.system("id")
`
    };

    // Initialize line numbers based on text content
    function updateLineNumbers() {
        const text = codeEditor.value;
        const lines = text.split('\n');
        const count = lines.length;
        
        let numbersHTML = '';
        for (let i = 1; i <= count; i++) {
            numbersHTML += `<div>${i}</div>`;
        }
        lineNumbers.innerHTML = numbersHTML;
    }

    // Sync line numbers scrolling with editor
    codeEditor.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeEditor.scrollTop;
    });

    // Update numbers on input or keypresses
    codeEditor.addEventListener('input', updateLineNumbers);

    // Support Tab key in editor
    codeEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeEditor.selectionStart;
            const end = codeEditor.selectionEnd;
            const value = codeEditor.value;
            
            // Insert 4 spaces
            codeEditor.value = value.substring(0, start) + '    ' + value.substring(end);
            
            // Put caret in correct position
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
            updateLineNumbers();
        }
    });

    // Handle preset template selection
    presetsSelect.addEventListener('change', () => {
        const selected = presetsSelect.value;
        if (templates[selected]) {
            codeEditor.value = templates[selected];
            updateLineNumbers();
            // Scroll to top
            codeEditor.scrollTop = 0;
            lineNumbers.scrollTop = 0;
        }
    });

    // Add interactive option to presets select element
    const interactiveOpt = document.createElement('option');
    interactiveOpt.value = 'interactive';
    interactiveOpt.textContent = 'Entrada Interactiva (input)';
    presetsSelect.insertBefore(interactiveOpt, presetsSelect.children[2]);

    // Set default preset
    codeEditor.value = templates.basic;
    updateLineNumbers();

    // Fetch system info and update status
    async function fetchSystemInfo() {
        try {
            const res = await fetch('/api/system-info');
            if (res.ok) {
                const info = await res.json();
                
                // Connection indicators
                connStatus.textContent = 'Conectado';
                connStatus.className = 'status-val status-connected';
                serverUserSpan.textContent = info.username;

                // Host details grid
                infoOs.textContent = `${info.osType} ${info.osRelease} (${info.arch})`;
                infoHost.textContent = info.hostname;
                infoUidGid.textContent = `uid=${info.uid}(${info.username}) gid=${info.gid}`;
                infoShell.textContent = info.shell || '/bin/sh';
            } else {
                throw new Error('Server returned error status');
            }
        } catch (err) {
            console.error('Connection failed:', err);
            connStatus.textContent = 'Desconectado';
            connStatus.className = 'status-val status-disconnected';
            serverUserSpan.textContent = 'N/A';
        }
    }

    // Initial system load
    fetchSystemInfo();

    // Send stdin input on Enter
    terminalStdin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = terminalStdin.value;
            if (socket && socket.readyState === WebSocket.OPEN) {
                // Send text with newline to python process stdin
                socket.send(JSON.stringify({ type: 'input', data: val + '\n' }));
                
                // Echo typed input to terminal
                const echoSpan = document.createElement('span');
                echoSpan.style.color = '#ffffff';
                echoSpan.style.fontWeight = 'bold';
                echoSpan.textContent = val + '\n';
                terminalOutput.appendChild(echoSpan);
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }
            terminalStdin.value = '';
        }
    });

    // Run code trigger via WebSockets
    runBtn.addEventListener('click', () => {
        if (socket) {
            try { socket.close(); } catch(e) {}
        }

        const code = codeEditor.value;
        
        // Disable button & show executing state
        runBtn.disabled = true;
        runBtn.innerHTML = `
            <svg class="run-icon spinning" viewBox="0 0 24 24" width="18" height="18" style="animation: spin 1s linear infinite;">
                <path fill="currentColor" d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm0 14c4.41 0 8-3.59 8-8h2c0 5.52-4.48 10-10 10v-2z"/>
            </svg>
            CONECTANDO...
        `;
        
        terminalOutput.innerHTML = '<div class="sys-msg">// Estableciendo sesión de ejecución en tiempo real...</div>';
        terminalStats.style.display = 'none';
        terminalInputLine.style.display = 'none';

        // Connect via WebSocket
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${window.location.host}`;
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            terminalOutput.innerHTML = '';
            runBtn.innerHTML = `
                <svg class="run-icon spinning" viewBox="0 0 24 24" width="18" height="18" style="animation: spin 1s linear infinite;">
                    <path fill="currentColor" d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm0 14c4.41 0 8-3.59 8-8h2c0 5.52-4.48 10-10 10v-2z"/>
                </svg>
                EJECUTANDO...
            `;
            
            // Send the code to execute
            socket.send(JSON.stringify({ type: 'run', code }));
            
            // Show interactive stdin input prompt
            terminalInputLine.style.display = 'flex';
            terminalStdin.value = '';
            terminalStdin.focus();
        };

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                
                if (msg.type === 'stdout') {
                    const span = document.createElement('span');
                    span.textContent = msg.data;
                    terminalOutput.appendChild(span);
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                } else if (msg.type === 'stderr') {
                    const span = document.createElement('span');
                    span.className = 'stderr';
                    span.textContent = msg.data;
                    terminalOutput.appendChild(span);
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                } else if (msg.type === 'exit') {
                    // Show execution statistics
                    statExit.textContent = msg.code !== null ? msg.code : 'Killed/Timeout';
                    statTime.textContent = `${msg.timeMs}ms`;
                    
                    if (msg.code === 0) {
                        statExit.style.color = 'var(--accent)';
                    } else {
                        statExit.style.color = 'var(--console-err)';
                    }
                    
                    terminalStats.style.display = 'flex';
                    terminalInputLine.style.display = 'none';
                    resetRunButton();
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err);
            }
        };

        socket.onerror = (err) => {
            console.error('WebSocket Error:', err);
            const errDiv = document.createElement('div');
            errDiv.className = 'stderr';
            errDiv.textContent = '\nError de Conexión en tiempo real.';
            terminalOutput.appendChild(errDiv);
            terminalInputLine.style.display = 'none';
            resetRunButton();
        };

        socket.onclose = () => {
            terminalInputLine.style.display = 'none';
            resetRunButton();
            socket = null;
        };
    });

    function resetRunButton() {
        runBtn.disabled = false;
        runBtn.innerHTML = `
            <svg class="run-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>
            EJECUTAR CÓDIGO
        `;
    }

    // Clear console trigger
    clearBtn.addEventListener('click', () => {
        terminalOutput.innerHTML = '<div class="sys-msg">// Consola limpia. Esperando ejecución de código...</div>';
        terminalStats.style.display = 'none';
        terminalInputLine.style.display = 'none';
        if (socket) {
            try { socket.close(); } catch(e) {}
        }
    });
});
