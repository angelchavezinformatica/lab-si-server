const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1'; // Binds to localhost for safety

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Create HTTP Server
const server = http.createServer(app);

// Create WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let pythonProcess = null;
    let tempFile = null;
    let timeout = null;
    let startTime = null;

    ws.on('message', (messageStr) => {
        try {
            const msg = JSON.parse(messageStr);
            
            if (msg.type === 'run') {
                const { code } = msg;
                if (typeof code !== 'string') {
                    ws.send(JSON.stringify({ type: 'stderr', data: 'Error: Code must be a string' }));
                    ws.close();
                    return;
                }

                // Generate a unique filename to prevent concurrency collisions
                const fileId = Math.random().toString(36).substring(2, 10);
                tempFile = path.join(tempDir, `run_${fileId}.py`);

                // Write python code to temporary file
                fs.writeFile(tempFile, code, (err) => {
                    if (err) {
                        console.error('Error writing temp file:', err);
                        ws.send(JSON.stringify({ type: 'stderr', data: 'Error: Failed to write code to disk' }));
                        ws.close();
                        return;
                    }

                    startTime = process.hrtime();
                    
                    // Crucial: Use '-u' flag to force Python to flush stdout/stderr immediately (unbuffered)
                    // so input() prompts are streamed instantly.
                    pythonProcess = spawn('python3', ['-u', tempFile]);

                    pythonProcess.stdout.on('data', (data) => {
                        ws.send(JSON.stringify({ type: 'stdout', data: data.toString() }));
                    });

                    pythonProcess.stderr.on('data', (data) => {
                        ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
                    });

                    // Set timeout of 60 seconds for interactive sessions (longer to allow user input)
                    timeout = setTimeout(() => {
                        if (pythonProcess) {
                            pythonProcess.kill();
                            ws.send(JSON.stringify({ type: 'stderr', data: '\n[Execution Timeout: Terminated after 60 seconds]' }));
                        }
                    }, 60000);

                    pythonProcess.on('close', (code) => {
                        if (timeout) clearTimeout(timeout);
                        cleanupFile(tempFile);

                        const diff = process.hrtime(startTime);
                        const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

                        ws.send(JSON.stringify({ type: 'exit', code, timeMs }));
                        ws.close();
                    });
                });
            } else if (msg.type === 'input') {
                if (pythonProcess && pythonProcess.stdin.writable) {
                    pythonProcess.stdin.write(msg.data);
                }
            }
        } catch (err) {
            console.error('Error processing WS message:', err);
        }
    });

    ws.on('close', () => {
        if (timeout) clearTimeout(timeout);
        if (pythonProcess) {
            try {
                pythonProcess.kill();
            } catch (e) {}
        }
        if (tempFile) {
            cleanupFile(tempFile);
        }
    });
});

/**
 * Fallback POST Endpoint to execute python code (non-interactive)
 */
app.post('/api/run', (req, res) => {
    const { code } = req.body;
    if (typeof code !== 'string') {
        return res.status(400).json({ error: 'Code must be a string' });
    }

    const fileId = Math.random().toString(36).substring(2, 10);
    const tempFile = path.join(tempDir, `run_${fileId}.py`);

    fs.writeFile(tempFile, code, (err) => {
        if (err) {
            console.error('Error writing temp file:', err);
            return res.status(500).json({ error: 'Failed to write code to disk' });
        }

        const startTime = process.hrtime();
        const pythonProcess = spawn('python3', [tempFile]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            pythonProcess.kill();
            cleanupFile(tempFile);
            res.json({
                stdout,
                stderr: stderr + '\n[Execution Timeout: Terminated after 10 seconds]',
                exitCode: -1,
                timeMs: 10000
            });
        }, 10000);

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);
            cleanupFile(tempFile);

            const diff = process.hrtime(startTime);
            const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

            res.json({
                stdout,
                stderr,
                exitCode: code,
                timeMs
            });
        });
    });
});

/**
 * Endpoint to get host/system info for security context (privilege escalation exploration)
 */
app.get('/api/system-info', (req, res) => {
    try {
        const userInfo = os.userInfo();
        res.json({
            osType: os.type(),
            osRelease: os.release(),
            hostname: os.hostname(),
            username: userInfo.username,
            uid: userInfo.uid,
            gid: userInfo.gid,
            shell: userInfo.shell,
            homedir: userInfo.homedir,
            platform: os.platform(),
            arch: os.arch()
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve system info' });
    }
});

// Helper function to safely delete the temp file
function cleanupFile(filePath) {
    fs.unlink(filePath, (err) => {
        if (err && err.code !== 'ENOENT') {
            console.error(`Failed to delete temp file ${filePath}:`, err);
        }
    });
}

// Start HTTP + WebSocket Server
server.listen(PORT, HOST, () => {
    console.log(`=============================================================`);
    console.log(`  PYTHON SANDBOX SECURITY LAB SERVER ACTIVE`);
    console.log(`  URL: http://${HOST}:${PORT}`);
    console.log(`  WARNING: Runs arbitrary execution. DO NOT expose publicly.`);
    console.log(`=============================================================`);
});
