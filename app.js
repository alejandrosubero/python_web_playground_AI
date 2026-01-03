let pyodide;
let editor;
const terminal = document.getElementById('terminal');
const statusMsg = document.getElementById('status-msg');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const tabCode = document.getElementById('tabCode');
const tabOutput = document.getElementById('tabOutput');
const terminalSection = document.getElementById('terminalSection');
const closeTerminal = document.getElementById('closeTerminal');

const DEFAULT_CODE = `# Python Playground
import sys

def greet(name):
    return f"Hello, {name}!"

print("Python Version:", sys.version.split()[0])
print(greet("iOS Developer"))

# Math example
numbers = [1, 2, 3, 4, 5]
squares = [n**2 for n in numbers]
print(f"Squares: {squares}")
`;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.47.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    const savedCode = localStorage.getItem('python_code') || DEFAULT_CODE;
    
    editor = monaco.editor.create(document.getElementById('monaco-container'), {
        value: savedCode,
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false },
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        wordWrap: 'on', // Better for mobile
        renderLineHighlight: 'line',
        hideCursorInOverviewRuler: true,
        // iOS specific settings
        scrollbars: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8
        }
    });

    // Save code on change
    let saveTimeout;
    editor.onDidChangeModelContent(() => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('python_code', editor.getValue());
        }, 300);
    });
});

// Initialize Pyodide
async function initPyodide() {
    try {
        const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.mjs');
        pyodide = await loadPyodide();
        
        // Setup stdout/stderr redirection
        pyodide.setStdout({ batched: (text) => appendToTerminal(text, 'stdout') });
        pyodide.setStderr({ batched: (text) => appendToTerminal(text, 'stderr') });

        statusMsg.innerHTML = "✓ Ready!";
        runBtn.disabled = false;
        
        setTimeout(() => {
            if (statusMsg) statusMsg.remove();
        }, 1500);

        playStartupSound();
    } catch (err) {
        appendToTerminal(`Error: ${err.message}`, 'stderr');
    }
}

function appendToTerminal(text, className) {
    const span = document.createElement('div');
    span.className = className;
    span.textContent = text;
    terminal.appendChild(span);
    terminal.scrollTop = terminal.scrollHeight;
}

async function runCode() {
    if (!pyodide) return;
    
    const code = editor.getValue();
    
    // UI Feedback
    runBtn.disabled = true;
    const originalIcon = document.getElementById('runIcon').textContent;
    document.getElementById('runIcon').textContent = '⌛';
    
    // Mobile: switch to output
    if (window.innerWidth < 768) {
        switchTab('output');
    }

    try {
        const lastResult = terminal.querySelector('.result');
        if (lastResult) lastResult.style.opacity = '0.5';

        const result = await pyodide.runPythonAsync(code);
        
        if (result !== undefined) {
            appendToTerminal(`>>> ${result}`, 'result');
        }
        playSuccessSound();
    } catch (err) {
        appendToTerminal(err.message, 'stderr');
        playErrorSound();
    } finally {
        runBtn.disabled = false;
        document.getElementById('runIcon').textContent = originalIcon;
    }
}

// Mobile Tab Switching
function switchTab(tab) {
    if (tab === 'code') {
        terminalSection.classList.add('translate-x-full');
        tabCode.classList.add('tab-active', 'border-t-2');
        tabOutput.classList.remove('tab-active', 'border-t-2');
        tabOutput.classList.add('text-gray-400');
        tabCode.classList.remove('text-gray-400');
    } else {
        terminalSection.classList.remove('translate-x-full');
        tabOutput.classList.add('tab-active', 'border-t-2');
        tabCode.classList.remove('tab-active', 'border-t-2');
        tabCode.classList.add('text-gray-400');
        tabOutput.classList.remove('text-gray-400');
    }
}

// Audio Feedback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = 'sine', volume = 0.1) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const playStartupSound = () => playTone(440, 0.2, 'triangle', 0.05);
const playSuccessSound = () => {
    playTone(523.25, 0.1, 'sine', 0.05);
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.05), 100);
};
const playErrorSound = () => playTone(220, 0.2, 'sawtooth', 0.05);

// Event Listeners
runBtn.addEventListener('click', runCode);
clearBtn.addEventListener('click', () => terminal.innerHTML = '');

tabCode.addEventListener('click', () => switchTab('code'));
tabOutput.addEventListener('click', () => switchTab('output'));
closeTerminal.addEventListener('click', () => switchTab('code'));

// Keyboard shortcut: Cmd/Ctrl + Enter
window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
    }
});

// CRITICAL FIX: Only prevent context menu in terminal, not editor
document.getElementById('terminal').addEventListener('contextmenu', e => {
    e.preventDefault();
});

// Start
initPyodide();
