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

print("System Version:", sys.version)
print(greet("Developer"))

# Try some math
numbers = [1, 2, 3, 4, 5]
squares = [n**2 for n in numbers]
print(f"Squares of {numbers}: {squares}")
`;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs' } });
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
    });

    // Save code on change
    editor.onDidChangeModelContent(() => {
        localStorage.setItem('python_code', editor.getValue());
    });
});

// Initialize Pyodide
async function initPyodide() {
    try {
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/"
        });
        
        // Setup stdout redirection
        pyodide.setStdout({
            batched: (text) => appendToTerminal(text, 'stdout')
        });
        pyodide.setStderr({
            batched: (text) => appendToTerminal(text, 'stderr')
        });

        statusMsg.innerHTML = "✓ Python engine ready.";
        runBtn.disabled = false;
        setTimeout(() => {
            if (statusMsg) statusMsg.remove();
        }, 2000);

        playStartupSound();
    } catch (err) {
        appendToTerminal(`Error loading Pyodide: ${err.message}`, 'stderr');
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
    
    // On mobile, automatically switch to output tab
    if (window.innerWidth < 768) {
        switchTab('output');
    }

    try {
        // Clear previous result styling if any
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

// Audio logic using WebAudio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = 'sine', volume = 0.1) {
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
const playErrorSound = () => {
    playTone(220, 0.2, 'sawtooth', 0.05);
};

// Event Listeners
runBtn.addEventListener('click', runCode);
clearBtn.addEventListener('click', () => {
    terminal.innerHTML = '';
});
tabCode.addEventListener('click', () => switchTab('code'));
tabOutput.addEventListener('click', () => switchTab('output'));
closeTerminal.addEventListener('click', () => switchTab('code'));

// Keyboard Shortcut: Cmd/Ctrl + Enter to run
window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
    }
});

// Start initialization
initPyodide();