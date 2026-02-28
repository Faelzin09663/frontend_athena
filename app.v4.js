// DOM Elements
const chatHistory = document.getElementById('chat-history');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const micToggleBtn = document.getElementById('mic-toggle-btn');
const taskList = document.getElementById('task-list');
const weatherWidget = document.getElementById('weather-widget');

// --- Initialization ---
function init() {
    if (window.initialized) return;
    window.initialized = true;
    connect(); // WebSocket
    fetchTasks();
    fetchWeather();
    if(typeof fetchCalendar === 'function') fetchCalendar();
    initMicToggle();
    updateCurrentProjectDisplay();
    initMusicPlayer(); // Music Widget

    // Polling for Weather (every 30 mins)
    setInterval(fetchWeather, 30 * 60 * 1000);
}

// --- WebSocket Setup ---
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
let ws;

function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        statusDot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
        statusText.innerText = "Online";
        console.log("Connected to WebSocket");
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        statusDot.className = "w-2 h-2 rounded-full bg-red-500";
        statusText.innerText = "Offline (Retrying...)";
        setTimeout(connect, 3000);
    };
    
    ws.onerror = (err) => {
        console.error("WS Error:", err);
    };
}

// --- Message Handling ---
function handleMessage(msg) {
    if (msg.type === "history") {
        chatHistory.innerHTML = ''; // Limpa placeholder
        const history = msg.payload;
        if (history && history.length > 0) {
            history.forEach(item => appendMessage(item.sender, item.text, item.attachment));
        } else {
            showPlaceholder();
        }
        
    } else if (msg.type === "transcription") {
        const { sender, text, attachment } = msg.payload;
        if ((text && text.trim() !== "") || attachment) {
            appendMessage(sender, text, attachment);
        }
        
    } else if (msg.type === "status") {
        statusText.innerText = msg.payload;
        if (msg.payload.includes("Activated")) {
            statusDot.className = "w-2 h-2 rounded-full bg-blue-500 animate-ping";
        } else if (msg.payload.includes("Standby")) {
            statusDot.className = "w-2 h-2 rounded-full bg-yellow-500";
        }

    } else if (msg.type === "log") {
        // Exibe no painel Developer Logs
        appendDevLog(msg.payload);

    } else if (msg.type === "athena_status") {
        // Estado da sessão Live API: "connecting", "connected", "reconnecting"
        const state = msg.payload;
        const dotMobile = document.getElementById('status-dot-mobile');
        if (state === "connecting" || state === "reconnecting") {
            const label = state === "reconnecting" ? "Reconectando..." : "Conectando...";
            statusText.innerText = label;
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-yellow-500 z-10 relative shadow-[0_0_8px_rgba(234,179,8,0.6)]";
            if (dotMobile) dotMobile.className = "w-2 h-2 rounded-full bg-yellow-500";
        } else if (state === "connected") {
            statusText.innerText = "Athena Online";
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-green-500 z-10 relative shadow-[0_0_8px_rgba(34,197,94,0.6)]";
            if (dotMobile) dotMobile.className = "w-2 h-2 rounded-full bg-green-500";
        } else if (state === "error") {
            statusText.innerText = "Erro na sessão";
            statusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500 z-10 relative";
            if (dotMobile) dotMobile.className = "w-2 h-2 rounded-full bg-red-500";
        }
    }
}


function showPlaceholder() {
    chatHistory.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-600 gap-4 opacity-40 select-none">
            <i class="fa-solid fa-microphone-lines text-5xl"></i>
            <p class="text-center">Diga "Athena" ou Digite abaixo</p>
        </div>
    `;
}

// --- Toast Notifications ---
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-enter w-72 bg-[#1c1c1c]/90 backdrop-blur-md border border-glass-border/40 rounded-xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden pointer-events-auto';

    let iconHtml = '';
    if (type === 'success') {
        iconHtml = '<div class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0"><i class="fa-solid fa-check text-sm"></i></div>';
    } else if (type === 'error') {
        iconHtml = '<div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0"><i class="fa-solid fa-triangle-exclamation text-sm"></i></div>';
    } else if (type === 'warning') {
        iconHtml = '<div class="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0"><i class="fa-solid fa-circle-exclamation text-sm"></i></div>';
    } else {
        iconHtml = '<div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0"><i class="fa-solid fa-info text-sm"></i></div>';
    }

    toast.innerHTML = `
        ${iconHtml}
        <div class="flex-1 min-w-0 pt-0.5">
            <h4 class="text-sm font-semibold text-gray-100">${title}</h4>
            <p class="text-xs text-gray-400 mt-0.5 truncate">${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-white transition-colors absolute top-3 right-3">
            <i class="fa-solid fa-xmark text-xs"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('toast-enter');
            toast.classList.add('toast-exit');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300); // Wait for exit animation
        }
    }, 5000);
}

// --- Developer Dashboard Logic ---
const devModal = document.getElementById('dev-modal');
const devOutput = document.getElementById('dev-terminal-output');

function toggleDevModal(show) {
    if (show) {
        devModal.classList.remove('hidden');
        devModal.classList.add('flex');
    } else {
        devModal.classList.add('hidden');
        devModal.classList.remove('flex');
    }
}

function clearDevLogs() {
    devOutput.innerHTML = '<div class="text-gray-500 italic">Logs cleared. Connected to Athena Dev Stream...</div>';
}

function appendDevLog(logText) {
    const logItem = document.createElement('div');
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    
    // Simple syntax highlighting for logs
    let styledText = logText
        .replace(/\[Server\]/g, '<span class="text-purple-400">[Server]</span>')
        .replace(/\[Error\]/gi, '<span class="text-red-500 font-bold">[Error]</span>')
        .replace(/\[Athena\]/gi, '<span class="text-blue-400">[Athena]</span>')
        .replace(/\[Music\]/gi, '<span class="text-pink-400">[Music]</span>')
        .replace(/\[Proactive\]/gi, '<span class="text-yellow-400">[Proactive]</span>');

    logItem.innerHTML = `<span class="text-gray-600 mr-2">[${time}]</span> ${styledText}`;
    logItem.className = 'border-b border-white/5 pb-1 mb-1 break-words';
    
    devOutput.appendChild(logItem);
    
    // Auto scroll
    if (devOutput.scrollHeight - devOutput.scrollTop < devOutput.clientHeight + 100) {
        devOutput.scrollTop = devOutput.scrollHeight;
    }
}


// --- Chat Logic ---
sendBtn.addEventListener('click', sendMessage);
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

const API_URL = window.location.protocol + '//' + window.location.host;
async function sendMessage() {
    const text = textInput.value.trim();
    if (!text && !activeAttachment) return;
    
    const currentAttachment = activeAttachment;
    
    textInput.value = '';
    clearImagePreview();
    
    try {
        const payload = { text: text || "Analisar imagem" };
        if (currentAttachment) {
            // Envia apenas o nome do arquivo para evitar corrupção do path no JSON (ex.: \0 no Windows)
            payload.attachment_path = currentAttachment.split(/[\\\/]/).pop();
        }

        const response = await fetch(`${API_URL}/api/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            console.error("Erro ao enviar mensagem");
        }
    } catch (e) {
        console.error("Send failed:", e);
    }
}

function appendMessage(sender, text, attachment = null) {
    // Se houver o placeholder central, remove ele
    const placeholder = chatHistory.querySelector('.fa-microphone-lines');
    if (placeholder) {
        chatHistory.innerHTML = '';
    }

    const isUser = sender.toLowerCase() === 'user';
    
    const div = document.createElement('div');
    div.className = `flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`;
    
    const bubbleClass = isUser 
        ? "bg-blue-600 text-white rounded-br-none" 
        : "bg-glass border border-glass-border text-gray-200 rounded-bl-none";

    let attachmentHtml = '';
    if (attachment) {
        // Handle both Windows (\) and Unix (/) paths
        const filename = attachment.split(/[\\\/]/).pop();
        const isImage = attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        const isPdf = attachment.match(/\.pdf$/i);
        
        if (isImage) {
            attachmentHtml = `<div class="mb-2 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                <img src="${API_URL}/static/backend/uploads/${filename}" class="max-w-full max-h-64 object-contain cursor-pointer hover:scale-[1.02] transition-transform" onclick="window.open(this.src)">
            </div>`;
        } else if (isPdf) {
            attachmentHtml = `<div class="mb-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-xs cursor-pointer hover:bg-red-500/20 transition-colors" onclick="window.open('${API_URL}/static/backend/uploads/${filename}')">
                <i class="fa-solid fa-file-pdf text-red-500 text-xl"></i>
                <div class="flex flex-col overflow-hidden">
                    <span class="font-bold text-gray-200 truncate">${filename}</span>
                    <span class="text-[10px] text-gray-500">Documento PDF</span>
                </div>
            </div>`;
        } else {
            attachmentHtml = `<div class="mb-2 p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-xs">
                <i class="fa-solid fa-file text-blue-400"></i>
                <span class="truncate text-gray-300">${filename}</span>
            </div>`;
        }
    }

    let contentHtml = text ? `<p class="text-sm leading-relaxed">${text}</p>` : '';

    div.innerHTML = `
        <div class="px-4 py-2 rounded-2xl max-w-[80%] ${bubbleClass} shadow-lg backdrop-blur-sm">
            ${!isUser ? `<p class="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">Athena</p>` : ''}
            ${attachmentHtml}
            ${contentHtml}
        </div>
    `;
    
    chatHistory.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function resetChat() {
    if(!confirm("Deseja iniciar uma nova conversa e apagar o histórico atual?")) return;
    
    try {
        const res = await fetch(`${API_URL}/api/chat/reset`, { method: 'POST' });
        if (res.ok) {
            // UI will be cleared via WebSocket "history" event with empty payload
            // But we can also force clear locally just in case
            chatHistory.innerHTML = '';
            showPlaceholder();
        }
    } catch (e) {
        console.error("Reset chat failed:", e);
    }
}

// --- Tasks Logic ---
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/api/tasks`);
        const tasks = await res.json();
        // Filter out completed tasks or separate them (user wants "remove" behavior)
        // We will show only uncompleted tasks for now as per user request "remove"
        renderTasks(tasks.filter(t => !t.completed));
    } catch (e) {
        console.error("Fetch tasks failed:", e);
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = "";
    if (tasks.length === 0) {
        taskList.innerHTML = '<div class="text-center text-gray-600 text-xs mt-4">Nenhuma tarefa pendente</div>';
        return;
    }
    
    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = "group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors";
        
        // Priority Color
        let prioColor = "bg-green-500";
        if (task.priority === "medium") prioColor = "bg-yellow-500";
        if (task.priority === "high") prioColor = "bg-orange-500";
        if (task.priority === "urgent") prioColor = "bg-red-500";
        
        const dateHtml = task.due_date ? `<span class="text-[10px] text-gray-500 ml-auto mr-2">${formatDate(task.due_date)}</span>` : '';

        div.innerHTML = `
            <div class="w-1.5 h-1.5 rounded-full ${prioColor} flex-shrink-0"></div>
            
            <button onclick="completeTask(${task.id})" class="text-gray-500 hover:text-green-500 transition-colors" title="Concluir">
                <i class="fa-regular fa-circle"></i>
            </button>
            
            <div class="flex-1 min-w-0 flex flex-col">
                <span class="text-sm text-gray-300 group-hover:text-white truncate">${task.text}</span>
            </div>

            ${dateHtml}

            <button onclick="deleteTask(${task.id})" class="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Remover">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        taskList.appendChild(div);
    });
}

function formatDate(dateStr) {
    if(!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

async function completeTask(id) {
    try {
        await fetch(`${API_URL}/api/tasks/${id}/complete`, { method: 'POST' });
        fetchTasks(); 
    } catch (e) {
        console.error("Complete task failed:", e);
    }
}

async function deleteTask(id) {
    if(!confirm("Tem certeza que deseja remover esta tarefa?")) return;
    try {
        await fetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
        fetchTasks();
    } catch (e) {
        console.error("Delete task failed:", e);
    }
}

// Modal Logic
const taskModal = document.getElementById('task-modal');
const taskDescInput = document.getElementById('task-desc');
const taskDateInput = document.getElementById('task-date');
const taskPriorityInput = document.getElementById('task-priority');

function openTaskModal() {
    toggleTaskModal(true);
}

function toggleTaskModal(show) {
    if (show) {
        taskModal.classList.remove('hidden');
        // Small delay to allow display block to apply before opacity transition
        setTimeout(() => taskModal.classList.remove('opacity-0'), 10);
        taskDescInput.focus();
        resetTaskForm();
    } else {
        taskModal.classList.add('opacity-0');
        setTimeout(() => taskModal.classList.add('hidden'), 300);
    }
}

function resetTaskForm() {
    taskDescInput.value = "";
    taskDateInput.value = "";
    selectPriority('low');
}

function selectPriority(prio) {
    taskPriorityInput.value = prio;
    document.querySelectorAll('.prio-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-white');
    });
    document.getElementById(`prio-${prio}`).classList.add('ring-2', 'ring-white');
}

async function submitTask() {
    const text = taskDescInput.value.trim();
    if (!text) return;
    
    const priority = taskPriorityInput.value;
    const dueDate = taskDateInput.value;

    try {
        await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, priority, due_date: dueDate })
        });
        toggleTaskModal(false);
        fetchTasks();
    } catch (e) {
        console.error("Add task failed:", e);
    }
}

// --- Calendar Logic ---
const calendarList = document.getElementById('calendar-list');

async function fetchCalendar() {
    try {
        const res = await fetch(`${API_URL}/api/calendar`);
        const events = await res.json();
        renderCalendar(events);
    } catch (e) {
        console.error("Fetch calendar failed:", e);
        if(calendarList) calendarList.innerHTML = '<div class="text-center text-gray-600 text-xs mt-4">Erro ao carregar</div>';
    }
}

function renderCalendar(events) {
    if(!calendarList) return;
    calendarList.innerHTML = "";
    if (events.length === 0) {
        calendarList.innerHTML = '<div class="text-center text-gray-600 text-xs mt-4">Nenhum evento próximo</div>';
        return;
    }
    
    events.forEach(event => {
        const date = new Date(event.start);
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        const div = document.createElement('div');
        div.className = "flex flex-col gap-0.5 p-2 rounded-lg hover:bg-white/5 transition-colors border-l-2 border-red-500/50 pl-3";
        
        div.innerHTML = `
            <span class="text-xs text-red-300 font-bold">${dateStr} • ${timeStr}</span>
            <span class="text-sm text-gray-200 truncate" title="${event.summary}">${event.summary}</span>
        `;
        calendarList.appendChild(div);
    });
}

// --- Weather Logic ---
async function fetchWeather() {
    const lat = -19.908224;
    const lon = -44.021058; 
    
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
        const data = await res.json();
        
        const temp = Math.round(data.current.temperature_2m);
        weatherWidget.innerHTML = `
            <div class="text-3xl font-bold">${temp}°C</div>
            <div class="text-xs text-gray-400">Belo Horizonte, MG</div>
        `;
    } catch (e) {
        weatherWidget.innerHTML = `<div class="text-xs text-red-400">Clima Indisponível</div>`;
    }
}

// --- Music Player State (declared early to avoid TDZ errors) ---
let _musicIsPlaying = false;
let _musicDuration = 1;
let _musicShuffle = false;
let _musicRepeat = false;
let _musicPollInterval = null;
let _musicSearching = false;
let _musicQueueCount = 0;
let _musicPaused = false;

// --- Microphone Toggle Logic ---
// --- Microphone Toggle Logic ---
let micMuted = true;
let isMicCaptured = false;
let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingInterval;

function initMicToggle() {
    updateMicButton(true);
    
    if (isMobileDevice) {
        // Mobile: Modo "Mensagem de Voz" (Hold to Record)
        micToggleBtn.addEventListener('touchstart', startVoiceMessage, {passive: true});
        micToggleBtn.addEventListener('touchend', stopVoiceMessage);
        micToggleBtn.addEventListener('touchcancel', stopVoiceMessage);
    } else {
        // PC: Modo "Live API" (Toggle on/off)
        micToggleBtn.addEventListener('click', toggleMic);
        initAudioStreaming(); // Sobe os WebSockets de Live Audio pro PC
    }
    
    // Tenta desbloquear o áudio ao primeiro clique na tela (mobile)
    document.body.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }, { once: true });
}

// ==============================
// MODO PC: LIVE API (WEBRTC)
// ==============================
function toggleMic() {
    if (isMobileDevice) return; // Segurança
    
    micMuted = !micMuted;
    updateMicButton(micMuted);
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (!micMuted && !isMicCaptured) {
        startAudioCapture();
        isMicCaptured = true;
    }
}

// ==============================
// MODO MOBILE: VOICE MESSAGE
// ==============================
async function startVoiceMessage(e) {
    if (!isMobileDevice) return;
    
    micToggleBtn.classList.add('bg-red-500', 'animate-pulse');
    micToggleBtn.classList.remove('bg-green-600');
    micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            micToggleBtn.classList.remove('bg-red-500', 'animate-pulse');
            micToggleBtn.classList.add('bg-green-600');
            micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            updateMicButton(true); // Reseta a cor de mute
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Só envia se tiver mais de 1 segundo
            if (Date.now() - recordingStartTime > 1000) {
                await sendVoiceMessage(audioBlob);
            }
            
            // Limpa as tracks do microfone pra não ficar com ícone de gravando no celular
            stream.getTracks().forEach(track => track.stop());
        };
        
        recordingStartTime = Date.now();
        mediaRecorder.start();
    } catch (err) {
        console.error("Erro ao acessar microfone para mensagem de voz:", err);
        micToggleBtn.classList.remove('bg-red-500', 'animate-pulse');
        updateMicButton(true);
    }
}

function stopVoiceMessage(e) {
    if (!isMobileDevice || !mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
}

async function sendVoiceMessage(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "voice_message.webm");
    
    // Mostra indicador de digitação no chat
    const chatHistory = document.getElementById('chat-history');
    const loadingId = "loader-" + Date.now();
    const loadingHtml = `<div id="${loadingId}" class="flex justify-start mb-4"><div class="bg-gray-800 rounded-2xl rounded-tl-sm p-4 animate-pulse text-gray-400"><i class="fa-solid fa-microphone-lines mr-2"></i> Transcrevendo áudio...</div></div>`;
    chatHistory.insertAdjacentHTML('beforeend', loadingHtml);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        // Envia o áudio para o servidor
        const uploadRes = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadRes.json();
        
        if (uploadData.saved_path) {
            // Repassa pro chat
            await fetch(`${API_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: "Mensagem de voz.", 
                    attachment_path: uploadData.saved_path 
                })
            });
        }
    } catch (err) {
        console.error("[Voice Message] Falha no upload:", err);
    } finally {
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();
    }
}

function updateMicButton(muted) {
    micMuted = muted;
    
    if (muted) {
        micToggleBtn.className = "w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-600/20";
        micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        micToggleBtn.title = "Microfone Mudo";
    } else {
        micToggleBtn.className = "w-10 h-10 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-green-600/20";
        micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        micToggleBtn.title = "Microfone Ativo";
    }
}

// --- WebRTC Audio Logic ---
let audioContext;
let audioPlaybackTime = 0; // usado para agendar chunks de TTS em sequência
let audioInWs;
let audioOutWs;
let micStream;
let audioProcessor;

async function initAudioStreaming() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    audioInWs = new WebSocket(`${protocol}//${host}/ws/audio_in`);
    audioInWs.binaryType = 'arraybuffer';
    
    audioInWs.onopen = () => {
        console.log("[Audio] Audio IN WebSocket connected");
        // startAudioCapture() was moved to toggleMic to allow user gesture
    };
    
    audioOutWs = new WebSocket(`${protocol}//${host}/ws/audio_out`);
    audioOutWs.binaryType = 'arraybuffer';
    
    audioOutWs.onopen = () => console.log("[Audio] Audio OUT WebSocket connected");
    audioOutWs.onmessage = async (event) => {
        try {
            // Garante que temos um AudioContext (pode ainda não existir se só voz estiver sendo usada)
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const rawData = new Int16Array(event.data);
            const inputSampleRate = 24000; // Gemini Live saída
            const outputSampleRate = audioContext.sampleRate || 48000;

            // Converte Int16 para Float32
            const floatData = new Float32Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) {
                floatData[i] = rawData[i] / 32768.0;
            }

            // Reamostragem simples (linear) de 24 kHz -> sample rate nativo do AudioContext
            function resampleFloat32(buffer, inRate, outRate) {
                if (inRate === outRate) return buffer;
                const ratio = inRate / outRate;
                const newLength = Math.round(buffer.length / ratio);
                const result = new Float32Array(newLength);
                for (let i = 0; i < newLength; i++) {
                    const idx = i * ratio;
                    const i0 = Math.floor(idx);
                    const i1 = Math.min(i0 + 1, buffer.length - 1);
                    const t = idx - i0;
                    result[i] = buffer[i0] * (1 - t) + buffer[i1] * t;
                }
                return result;
            }

            const resampled = resampleFloat32(floatData, inputSampleRate, outputSampleRate);

            const audioBuffer = audioContext.createBuffer(1, resampled.length, outputSampleRate);
            const channelData = audioBuffer.getChannelData(0);
            channelData.set(resampled);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            // Agenda chunks em sequência para evitar cortes/overlaps
            // Adiciona um pequeno buffer de 100ms se estivermos muito próximos do tempo atual (evita stuttering)
            if (audioPlaybackTime < audioContext.currentTime + 0.1) {
                audioPlaybackTime = audioContext.currentTime + 0.1;
            }
            source.start(audioPlaybackTime);
            audioPlaybackTime += audioBuffer.duration;
        } catch(e) {
            console.error("Audio playback error:", e);
        }
    };
}

async function startAudioCapture(deviceId = null) {
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    if (audioProcessor) audioProcessor.disconnect();
    
    try {
        const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
        micStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Safari iOS: Ensure AudioContext exists (created in toggleMic) or create if fallback
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(micStream);
        audioProcessor = audioContext.createScriptProcessor(1024, 1, 1);

        const targetSampleRate = 16000;

        function downsampleBuffer(buffer, inputSampleRate, outSampleRate) {
            if (outSampleRate === inputSampleRate) {
                return buffer;
            }
            const sampleRateRatio = inputSampleRate / outSampleRate;
            const newLength = Math.floor(buffer.length / sampleRateRatio);
            const result = new Float32Array(newLength);
            let offsetResult = 0;
            let offsetBuffer = 0;
            while (offsetResult < result.length) {
                const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
                let accum = 0;
                let count = 0;
                for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                    accum += buffer[i];
                    count++;
                }
                result[offsetResult] = count > 0 ? accum / count : 0;
                offsetResult++;
                offsetBuffer = nextOffsetBuffer;
            }
            return result;
        }

        audioProcessor.onaudioprocess = (e) => {
            if (micMuted || !audioInWs || audioInWs.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const inputSampleRate = audioContext.sampleRate || 48000;
            const resampled = downsampleBuffer(inputData, inputSampleRate, targetSampleRate);

            const pcm16 = new Int16Array(resampled.length);
            for (let i = 0; i < resampled.length; i++) {
                let s = Math.max(-1, Math.min(1, resampled[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            audioInWs.send(pcm16.buffer);
        };

        source.connect(audioProcessor);
        // Não precisamos monitorar o próprio microfone no fone/caixa, apenas capturar e enviar.
        // audioProcessor.connect(audioContext.destination);
        console.log("[Audio] Audio capture started");
    } catch (e) {
        console.error("Failed to start audio capture:", e);
    }
}

// --- Settings Logic (Refactored) ---
const settingsModal = document.getElementById('settings-modal');
const micSelect = document.getElementById('mic-select');

function openSettingsModal() {
    toggleSettingsModal(true);
    loadAudioDevices();
}

function toggleSettingsModal(show) {
    if (show) {
        settingsModal.classList.remove('hidden');
        setTimeout(() => settingsModal.classList.remove('opacity-0'), 10);
    } else {
        settingsModal.classList.add('opacity-0');
        setTimeout(() => settingsModal.classList.add('hidden'), 300);
    }
}

async function loadAudioDevices() {
    micSelect.innerHTML = '<option>Carregando...</option>';
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        
        micSelect.innerHTML = '';
        if (audioInputs.length === 0) {
            micSelect.innerHTML = '<option value="">Nenhum dispositivo encontrado</option>';
            return;
        }

        audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Microfone ${index + 1}`;
            micSelect.appendChild(option);
        });
        
    } catch (e) {
        console.error("Failed to load audio devices:", e);
        micSelect.innerHTML = '<option>Erro ao carregar</option>';
    }
}

async function saveSettings() {
    const selectedMicId = micSelect.value;
    if (selectedMicId === "") return;

    try {
        await startAudioCapture(selectedMicId);
        toggleSettingsModal(false);
    } catch (e) {
        console.error("Failed to save settings:", e);
        alert("Erro ao salvar configurações.");
    }
}

// --- Sessions Logic ---
const sessionsList = document.getElementById('sessions-list');

async function fetchSessions() {
    try {
        const res = await fetch(`${API_URL}/api/sessions`);
        const sessions = await res.json();
        renderSessions(sessions);
    } catch (e) {
        console.error("Fetch sessions failed:", e);
    }
}

function renderSessions(sessions) {
    if (!sessionsList) return;
    sessionsList.innerHTML = "";
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = '<div class="text-center text-gray-600 text-xs mt-4">Nenhuma conversa</div>';
        return;
    }
    
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = "group flex items-center gap-2 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5";
        
        const date = new Date(session.updated_at);
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        div.onclick = () => activateSession(session.id);

        div.innerHTML = `
            <i class="fa-regular fa-message text-gray-500 text-xs"></i>
            <div class="flex-1 min-w-0 flex flex-col">
                <span class="text-sm text-gray-300 group-hover:text-white truncate">${session.title}</span>
                <span class="text-[10px] text-gray-600">${dateStr}</span>
            </div>
            <button onclick="event.stopPropagation(); deleteSession(${session.id})" class="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        `;
        sessionsList.appendChild(div);
    });
}

async function activateSession(id) {
    try {
        await fetch(`${API_URL}/api/sessions/${id}/activate`, { method: 'POST' });
        // UI will update via WebSocket history event
    } catch (e) {
        console.error("Activate session failed:", e);
    }
}

async function deleteSession(id) {
    if(!confirm("Excluir esta conversa?")) return;
    try {
        await fetch(`${API_URL}/api/sessions/${id}`, { method: 'DELETE' });
        fetchSessions();
    } catch (e) {
        console.error("Delete session failed:", e);
    }
}

// Override resetChat to create new session
async function resetChat() {
    try {
        // Create new session via API
        const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
        if(res.ok) {
            fetchSessions();
            chatHistory.innerHTML = '';
            showPlaceholder();
        }
    } catch (e) {
        console.error("New chat failed:", e);
    }
}


// Start
init();
// Add sessions fetch to init
fetchSessions();

// --- File Upload & Visual Context Logic ---
const uploadedFilesList = document.getElementById('uploaded-files-list');
const imagePreviewContainer = document.getElementById('image-preview-container');
let activeAttachment = null;

async function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file); 
        
        try {
            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                const data = await res.json();
                renderUploadedFile(data);
                
                // Se for imagem ou PDF, adiciona ao preview do chat automaticamente
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    addToImagePreview(data);
                }
            } else {
                console.error("Upload failed for", file.name);
            }
        } catch (e) {
            console.error("Upload error:", e);
        }
    }
    
    // Reset input
    document.getElementById('file-upload-input').value = '';
}

function addToImagePreview(fileData) {
    activeAttachment = fileData.saved_path;
    imagePreviewContainer.classList.remove('hidden');
    imagePreviewContainer.classList.add('flex');
    
    const div = document.createElement('div');
    div.className = "relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 group bg-white/5 flex items-center justify-center";
    
    const filename = fileData.saved_path.split(/[\\\/]/).pop();
    const isImage = fileData.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isImage) {
        div.innerHTML = `
            <img src="/static/backend/uploads/${filename}" class="w-full h-full object-cover">
            <button onclick="clearImagePreview()" class="absolute top-0 right-0 bg-black/60 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-xmark text-[10px]"></i>
            </button>
        `;
    } else {
        // PDF ou outro documento
        div.innerHTML = `
            <i class="fa-solid fa-file-pdf text-red-500 text-2xl"></i>
            <button onclick="clearImagePreview()" class="absolute top-0 right-0 bg-black/60 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-xmark text-[10px]"></i>
            </button>
        `;
    }
    
    // Limpa preview anterior
    imagePreviewContainer.innerHTML = '';
    imagePreviewContainer.appendChild(div);
    
    textInput.placeholder = `Perguntar sobre ${fileData.filename}...`;
    textInput.focus();
}

function clearImagePreview() {
    activeAttachment = null;
    imagePreviewContainer.innerHTML = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreviewContainer.classList.remove('flex');
    textInput.placeholder = "Message Athena...";
}

function renderUploadedFile(fileData) {
    const noFilesMsg = document.getElementById('no-files-msg');
    if (noFilesMsg) noFilesMsg.style.display = 'none';
    
    const div = document.createElement('div');
    div.className = "relative group flex flex-col items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all select-none";
    div.dataset.path = fileData.saved_path;
    
    // Double click to Activate Context
    div.ondblclick = () => toggleFileSelection(div, fileData); 

    let iconClass = "fa-file";
    let colorClass = "text-gray-400";
    
    if (fileData.filename.endsWith('.pdf')) { iconClass = "fa-file-pdf"; colorClass = "text-red-400"; }
    else if (fileData.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) { iconClass = "fa-file-image"; colorClass = "text-blue-400"; }
    else if (fileData.filename.match(/\.(txt|md|py|js|json|css|html)$/i)) { iconClass = "fa-file-code"; colorClass = "text-green-400"; }
    else if (fileData.filename.match(/\.(doc|docx)$/i)) { iconClass = "fa-file-word"; colorClass = "text-blue-600"; }

    div.innerHTML = `
        <div class="relative">
             <i class="fa-regular ${iconClass} text-2xl mb-1 ${colorClass}"></i>
             <div class="absolute -top-1 -right-2 w-3 h-3 rounded-full bg-blue-500 border border-black opacity-0 transition-opacity flex items-center justify-center" id="selection-dot">
                <i class="fa-solid fa-check text-[6px] text-white"></i>
             </div>
        </div>
        <span class="text-[9px] text-gray-300 truncate w-full text-center leading-tight">${fileData.filename}</span>
        <div class="absolute inset-0 border-2 border-blue-500 rounded-lg opacity-0 pointer-events-none transition-opacity" id="selection-border"></div>
    `;
    
    uploadedFilesList.appendChild(div);
}

function toggleFileSelection(el, fileData) {
    const border = el.querySelector('#selection-border');
    const dot = el.querySelector('#selection-dot');
    
    const isSelected = border.classList.contains('opacity-100');
    
    // Clear all others
    document.querySelectorAll('#uploaded-files-list > div').forEach(d => {
        const b = d.querySelector('#selection-border');
        const dt = d.querySelector('#selection-dot');
        if(b) b.classList.remove('opacity-100');
        if(b) b.classList.add('opacity-0');
        if(dt) dt.classList.add('opacity-0');
    });
    
    if (!isSelected) {
        border.classList.remove('opacity-0');
        border.classList.add('opacity-100');
        dot.classList.remove('opacity-0');
        
        if (fileData.filename.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i)) {
            addToImagePreview(fileData);
        } else {
            activeAttachment = fileData.saved_path;
            textInput.placeholder = `Perguntar sobre ${fileData.filename}...`;
            textInput.focus();
        }
    } else {
        clearImagePreview();
    }
}

// --- Project Management Logic ---
async function updateCurrentProjectDisplay() {
    try {
        const res = await fetch('/api/project/current');
        const data = await res.json();
        const display = document.getElementById('current-project-display');
        if (display) {
            display.innerText = data.name || "Nenhum";
            display.classList.add('animate-pulse');
            setTimeout(() => display.classList.remove('animate-pulse'), 2000);
        }
    } catch (e) {
        console.error("Erro ao buscar projeto atual:", e);
    }
}

// Chamar ao iniciar e periodicamente ou após ações de projeto
setInterval(updateCurrentProjectDisplay, 10000);
document.addEventListener('DOMContentLoaded', () => {
    init();
    updateCurrentProjectDisplay();
});

// --- Camera & Screen Capture Logic ---
let videoStream = null;
let videoWs = null;
let currentFacing = 'user'; // 'user' or 'environment'
let frameInterval = null;

const cameraModal = document.getElementById('camera-modal');
const cameraPreview = document.getElementById('camera-preview');
const cameraIndicator = document.getElementById('camera-indicator');
const startVideoBtn = document.getElementById('start-video-stream-btn');
const stopVideoBtn = document.getElementById('stop-video-stream-btn');

async function openCameraModal() {
    cameraModal.classList.remove('hidden');
    setTimeout(() => cameraModal.classList.remove('opacity-0'), 10);
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: currentFacing }
        });
        cameraPreview.srcObject = videoStream;
    } catch (error) {
        console.error('Camera access error:', error);
        alert('Não foi possível acessar a câmera. Verifique as permissões.');
        closeCameraModal();
    }
}

function closeCameraModal() {
    stopVideoStream();
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    cameraPreview.srcObject = null;
    cameraModal.classList.add('opacity-0');
    setTimeout(() => cameraModal.classList.add('hidden'), 300);
}

async function toggleCameraFacing() {
    if (!videoStream) return;
    videoStream.getTracks().forEach(track => track.stop());
    currentFacing = currentFacing === 'user' ? 'environment' : 'user';
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: currentFacing }
        });
        cameraPreview.srcObject = videoStream;
    } catch (error) {
        console.error('Failed to switch camera:', error);
        alert('Erro ao trocar câmera');
    }
}

async function startVideoStream() {
    if (!videoStream) return;
    try {
        const res = await fetch('/api/video/start', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to start video');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        videoWs = new WebSocket(`${protocol}//${window.location.host}/ws/video`);
        
        videoWs.onopen = () => {
            console.log('[Video] WebSocket connected');
            cameraIndicator.classList.remove('hidden');
            startVideoBtn.classList.add('hidden');
            stopVideoBtn.classList.remove('hidden');
            sendVideoFrames();
        };
        
        videoWs.onerror = (error) => console.error('[Video] WebSocket error:', error);
        videoWs.onclose = () => { console.log('[Video] WebSocket closed'); stopFrameCapture(); };
    } catch (error) {
        console.error('Failed to start video stream:', error);
        alert('Erro ao iniciar stream de vídeo');
    }
}

function sendVideoFrames() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    frameInterval = setInterval(() => {
        if (!videoWs || videoWs.readyState !== WebSocket.OPEN || !videoStream) {
            stopFrameCapture();
            return;
        }
        canvas.width = cameraPreview.videoWidth || 640;
        canvas.height = cameraPreview.videoHeight || 480;
        ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
            if (blob && videoWs && videoWs.readyState === WebSocket.OPEN) {
                blob.arrayBuffer().then(buffer => videoWs.send(buffer));
            }
        }, 'image/jpeg', 0.7);
    }, 200); // 5 FPS
}

function stopFrameCapture() {
    if (frameInterval) { clearInterval(frameInterval); frameInterval = null; }
}

async function stopVideoStream() {
    stopFrameCapture();
    if (videoWs) { videoWs.close(); videoWs = null; }
    try { await fetch('/api/video/stop', { method: 'POST' }); } catch (error) { console.error('Failed to stop video:', error); }
    cameraIndicator.classList.add('hidden');
    stopVideoBtn.classList.add('hidden');
    startVideoBtn.classList.remove('hidden');
}

async function captureScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always', displaySurface: 'monitor' }
        });
        
        const res = await fetch('/api/video/start', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to start screen capture');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const screenWs = new WebSocket(`${protocol}//${window.location.host}/ws/video`);
        
        screenWs.onopen = () => {
            console.log('[Screen] WebSocket connected');
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.muted = true;
            screenVideo.playsInline = true;
            screenVideo.play().catch(e => console.error('Play error on hidden screen video:', e));
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const screenInterval = setInterval(() => {
                if (!screenWs || screenWs.readyState !== WebSocket.OPEN) {
                    clearInterval(screenInterval);
                    screenStream.getTracks().forEach(track => track.stop());
                    return;
                }
                canvas.width = screenVideo.videoWidth || 1280;
                canvas.height = screenVideo.videoHeight || 720;
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(blob => {
                    if (blob && screenWs.readyState === WebSocket.OPEN) {
                        blob.arrayBuffer().then(buffer => screenWs.send(buffer));
                    }
                }, 'image/jpeg', 0.6);
            }, 500); // 2 FPS
            
            screenStream.getVideoTracks()[0].onended = async () => {
                clearInterval(screenInterval);
                screenWs.close();
                await fetch('/api/video/stop', { method: 'POST' });
                console.log('[Screen] Capture ended');
            };
        };
    } catch (error) {
        console.error('Screen capture error:', error);
        if (error.name === 'NotAllowedError') alert('Permissão negada para captura de tela');
        else alert('Erro ao capturar tela');
    }
}

// ═══════════════════════════════════════════════════════════
// 🎵 MUSIC PLAYER
// ═══════════════════════════════════════════════════════════

function initMusicPlayer() {
    fetchMusicStatus();
    _musicPollInterval = setInterval(fetchMusicStatus, 2000);
}

async function fetchMusicStatus() {
    try {
        const res = await fetch('/api/music/status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.available === false || data.error) {
            // msc_api offline — mantém UI de estado vazio
            return;
        }
        updateMusicUI(data);
    } catch (e) {
        // API offline ou rede — ignora silenciosamente
    }
}

function updateMusicUI(data) {
    const title       = document.getElementById('music-title');
    const queueCount  = document.getElementById('music-queue-count');
    const thumbnail   = document.getElementById('music-thumbnail');
    const thumbPlaceholder = document.getElementById('music-thumb-placeholder');
    const playIcon    = document.getElementById('music-play-icon');
    const progressFill = document.getElementById('music-progress-fill');
    const timeCurrent = document.getElementById('music-time-current');
    const timeTotal   = document.getElementById('music-time-total');
    const dot         = document.getElementById('music-playing-dot');

    // Estado do player: 'State.Playing', 'State.Paused', 'State.Stopped'
    const state = data.estado_do_player || '';
    _musicIsPlaying = state.includes('Playing');
    _musicPaused    = state.includes('Paused');
    _musicQueueCount = data.total_na_fila || 0;
    _musicDuration = Math.max(data.duracao_total || 1, 1);

    // Título
    const songTitle = data.musica_atual || 'Nenhuma música';
    if (title) title.textContent = songTitle;

    // Fila
    if (queueCount) {
        const n = data.total_na_fila || 0;
        queueCount.textContent = n === 0 ? 'fila vazia' : `${n} na fila`;
    }

    // Thumbnail
    if (data.thumbnail && data.thumbnail !== '') {
        if (thumbnail) { thumbnail.src = data.thumbnail; thumbnail.classList.remove('hidden'); }
        if (thumbPlaceholder) thumbPlaceholder.classList.add('hidden');
    } else {
        if (thumbnail) thumbnail.classList.add('hidden');
        if (thumbPlaceholder) thumbPlaceholder.classList.remove('hidden');
    }

    // Play/Pause icon
    if (playIcon) {
        playIcon.className = _musicIsPlaying
            ? 'fa-solid fa-pause text-sm'
            : 'fa-solid fa-play text-sm';
    }

    // Dot pulsante
    if (dot) { _musicIsPlaying ? dot.classList.remove('hidden') : dot.classList.add('hidden'); }

    // Progresso
    const cur = data.tempo_atual || 0;
    const pct = Math.min((cur / _musicDuration) * 100, 100);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (timeCurrent) timeCurrent.textContent = formatTime(cur);
    if (timeTotal)   timeTotal.textContent   = formatTime(_musicDuration);
}

function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Variáveis globais do estado de música — declaradas no topo do arquivo para evitar TDZ

async function musicSearchDirect() {
    const input = document.getElementById('music-search-input');
    const query = (input && input.value || '').trim();
    const btn = document.getElementById('music-search-btn');
    const titleEl = document.getElementById('music-title');
    const queueEl = document.getElementById('music-queue-count');

    // Sem texto: se houver fila, pula pro próximo; se pausado, retoma
    if (!query) {
        if (_musicQueueCount > 0) {
            await fetch(`${API_URL}/api/music/next`);
            setTimeout(fetchMusicStatus, 500);
        } else if (_musicPaused) {
            await fetch(`${API_URL}/api/music/resume`);
            setTimeout(fetchMusicStatus, 300);
        }
        return;
    }

    if (_musicSearching) return;
    _musicSearching = true;

    // Feedback visual
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[9px]"></i> Buscando';
    if (titleEl) titleEl.textContent = 'Buscando...';
    if (queueEl) queueEl.textContent = 'aguardando yt-dlp...';

    try {
        console.log('[Music] Tocando:', query);
        const res = await fetch(`${API_URL}/api/music/play?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        console.log('[Music] Resposta:', data);
        if (data.error || data.available === false) {
            if (titleEl) titleEl.textContent = 'Erro ao buscar';
            if (queueEl) queueEl.textContent = data.error || 'msc_api offline';
        } else {
            if (input) input.value = '';
            setTimeout(fetchMusicStatus, 500);
            setTimeout(fetchMusicStatus, 2000);
        }
    } catch(err) {
        console.error('[Music] Falha:', err);
        if (titleEl) titleEl.textContent = 'Falha na conexão';
        if (queueEl) queueEl.textContent = 'verifique o terminal';
    } finally {
        _musicSearching = false;
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play text-[9px]"></i> Tocar';
    }
}

// Alias para compatibilidade com versão antiga (form onsubmit)
async function musicSearch(e) {
    if (e && e.preventDefault) e.preventDefault();
    return musicSearchDirect();
}

async function musicTogglePlay() {
    try {
        if (_musicIsPlaying) {
            // Tocando → pausar
            await fetch(`${API_URL}/api/music/pause`);
        } else if (_musicPaused) {
            // Pausado → retomar
            await fetch(`${API_URL}/api/music/resume`);
        } else if (_musicQueueCount > 0) {
            // Parado mas tem fila → próxima
            await fetch(`${API_URL}/api/music/next`);
        } else {
            // Nada para tocar — tenta retomar mesmo assim
            await fetch(`${API_URL}/api/music/resume`);
        }
        setTimeout(fetchMusicStatus, 300);
    } catch (e) { console.error('[Music] Toggle error:', e); }
}

async function musicNext() {
    try {
        await fetch(`${API_URL}/api/music/next`);
        setTimeout(fetchMusicStatus, 500);
    } catch (e) { console.error('[Music] Next error:', e); }
}

async function musicPrev() {
    // Reinicia a música atual ao segundo 0
    try {
        await fetch(`${API_URL}/api/music/seek?seconds=0`);
        setTimeout(fetchMusicStatus, 300);
    } catch (e) { console.error('[Music] Prev error:', e); }
}

function musicSeekClick(event) {
    const bar = document.getElementById('music-progress-bar');
    if (!bar || !_musicIsPlaying) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const targetSec = Math.round(ratio * _musicDuration);
    fetch(`${API_URL}/api/music/seek?seconds=${targetSec}`).then(() => setTimeout(fetchMusicStatus, 300));
}

function musicShuffle() {
    _musicShuffle = !_musicShuffle;
    const btn = document.getElementById('music-btn-shuffle');
    if (btn) {
        btn.classList.toggle('text-green-400', _musicShuffle);
        btn.classList.toggle('text-gray-500', !_musicShuffle);
    }
    // Shuffle não é suportado pela msc_api — apenas UI
}

function musicRepeat() {
    _musicRepeat = !_musicRepeat;
    const btn = document.getElementById('music-btn-repeat');
    if (btn) {
        btn.classList.toggle('text-green-400', _musicRepeat);
        btn.classList.toggle('text-gray-500', !_musicRepeat);
    }
    // Repeat não é suportado pela msc_api — apenas UI
}

// --- Mobile and Sidebar Toggle Logic ---
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const desktopWidgets = document.getElementById('widgets-container');
    const mobileWidgets = document.getElementById('mobile-widgets-container');
    
    if (!mobileMenu || !desktopWidgets || !mobileWidgets) return;

    if (mobileMenu.classList.contains('hidden')) {
        // Abrindo: mover widgets para o menu mobile
        while (desktopWidgets.firstChild) {
            mobileWidgets.appendChild(desktopWidgets.firstChild);
        }
        mobileMenu.classList.remove('hidden');
        setTimeout(() => mobileMenu.classList.remove('opacity-0'), 10);
    } else {
        // Fechando: devolver widgets para o desktop
        while (mobileWidgets.firstChild) {
            desktopWidgets.appendChild(mobileWidgets.firstChild);
        }
        mobileMenu.classList.add('opacity-0');
        setTimeout(() => mobileMenu.classList.add('hidden'), 300);
    }
}

function toggleVisualPanel() {
    const panel = document.getElementById('visual-panel');
    if (!panel) return;
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
}

// ═══════════════════════════════════════════════════════════
// 📒 CONTACTS AGENDA (WhatsApp)
// ═══════════════════════════════════════════════════════════

let _pendingNicknames = [];      // Apelidos à serem salvos no novo contato
let _editNicknames = [];         // Apelidos do contato em edição

// Abre o modal e carrega os contatos
function openContactsModal() {
    const modal = document.getElementById('contacts-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    _pendingNicknames = [];
    renderNicknameTags('nicknames-tags', _pendingNicknames);
    loadContacts();
}

function closeContactsModal() {
    const modal = document.getElementById('contacts-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    // Limpa o formulário
    document.getElementById('contact-name-input').value = '';
    document.getElementById('contact-phone-input').value = '';
    document.getElementById('nickname-input').value = '';
    _pendingNicknames = [];
    renderNicknameTags('nicknames-tags', _pendingNicknames);
}

// Carrega contatos da API
async function loadContacts() {
    try {
        const res = await fetch(`${API_URL}/api/contacts`);
        const contacts = await res.json();
        renderContacts(contacts);
    } catch (e) {
        console.error('[Contacts] Failed to load:', e);
    }
}

// Renderiza a lista de contatos
function renderContacts(contacts) {
    const list = document.getElementById('contacts-list');
    const empty = document.getElementById('contacts-empty');
    
    // Remove cards existentes (mantém o #contacts-empty)
    list.querySelectorAll('.contact-card').forEach(c => c.remove());

    if (!contacts || contacts.length === 0) {
        if (empty) empty.style.display = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    contacts.forEach(contact => {
        const card = document.createElement('div');
        card.className = 'contact-card flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-green-500/20 transition-all group';
        
        // Avatar com iniciais
        const initials = contact.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        
        // Badges de apelidos
        const nickBadges = (contact.nicknames || []).map(n =>
            `<span class="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-medium border border-green-500/20">${n}</span>`
        ).join('');

        card.innerHTML = `
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-600/20 border border-green-500/20 flex items-center justify-center flex-shrink-0 text-green-300 font-bold text-xs">${initials}</div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-white leading-tight">${contact.name}</p>
                <p class="text-[11px] text-gray-500 font-mono mt-0.5">+${contact.phone}</p>
                ${nickBadges ? `<div class="flex flex-wrap gap-1 mt-1.5">${nickBadges}</div>` : ''}
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onclick="openEditModal('${contact.id}', ${JSON.stringify(contact.name).replace(/'/g, "\\'")} , '${contact.phone}', ${JSON.stringify(contact.nicknames || [])})"
                    class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Editar">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button onclick="deleteContact('${contact.id}')"
                    class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remover">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        `;
        list.appendChild(card);
    });
}

// ─── Nicknames tags (novo contato) ───────────────────────────────────────────

function handleNicknameKeydown(event) {
    if (event.key === 'Enter') { event.preventDefault(); addNicknameTag(); }
}

function addNicknameTag() {
    const input = document.getElementById('nickname-input');
    const value = input.value.trim();
    if (!value || _pendingNicknames.includes(value)) { input.value = ''; return; }
    _pendingNicknames.push(value);
    input.value = '';
    renderNicknameTags('nicknames-tags', _pendingNicknames, removeNicknameTag);
}

function removeNicknameTag(index) {
    _pendingNicknames.splice(index, 1);
    renderNicknameTags('nicknames-tags', _pendingNicknames, removeNicknameTag);
}

// ─── Nicknames tags (editar contato) ─────────────────────────────────────────

function handleEditNicknameKeydown(event) {
    if (event.key === 'Enter') { event.preventDefault(); addEditNicknameTag(); }
}

function addEditNicknameTag() {
    const input = document.getElementById('edit-nickname-input');
    const value = input.value.trim();
    if (!value || _editNicknames.includes(value)) { input.value = ''; return; }
    _editNicknames.push(value);
    input.value = '';
    renderNicknameTags('edit-nicknames-tags', _editNicknames, removeEditNicknameTag);
}

function removeEditNicknameTag(index) {
    _editNicknames.splice(index, 1);
    renderNicknameTags('edit-nicknames-tags', _editNicknames, removeEditNicknameTag);
}

// ─── Renderiza tags de apelidos no container informado ───────────────────────

function renderNicknameTags(containerId, nicknames, removeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    nicknames.forEach((nick, i) => {
        const tag = document.createElement('span');
        tag.className = 'flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-[11px] border border-green-500/30';
        tag.innerHTML = `${nick} <button onclick="${removeCallback ? removeCallback.name + '(' + i + ')' : ''}" class="ml-0.5 text-green-400/60 hover:text-red-400 transition-colors"><i class="fa-solid fa-xmark text-[9px]"></i></button>`;
        container.appendChild(tag);
    });
}

// ─── Salvar novo contato ──────────────────────────────────────────────────────

async function saveNewContact() {
    const name = document.getElementById('contact-name-input').value.trim();
    const phone = document.getElementById('contact-phone-input').value.trim();

    if (!name || !phone) {
        showToast('Atenção', 'Nome e telefone são obrigatórios.', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, nicknames: _pendingNicknames })
        });
        if (!res.ok) throw new Error('API error');

        showToast('Contato salvo! ✅', `${name} adicionado à agenda.`, 'success');
        document.getElementById('contact-name-input').value = '';
        document.getElementById('contact-phone-input').value = '';
        document.getElementById('nickname-input').value = '';
        _pendingNicknames = [];
        renderNicknameTags('nicknames-tags', _pendingNicknames);
        await loadContacts();
    } catch (e) {
        showToast('Erro', 'Não foi possível salvar o contato.', 'error');
        console.error('[Contacts] Save failed:', e);
    }
}

// ─── Deletar contato ──────────────────────────────────────────────────────────

async function deleteContact(id) {
    if (!confirm('Remover este contato da agenda?')) return;
    try {
        const res = await fetch(`${API_URL}/api/contacts/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('API error');
        showToast('Removido', 'Contato excluído da agenda.', 'info');
        await loadContacts();
    } catch (e) {
        showToast('Erro', 'Não foi possível remover o contato.', 'error');
        console.error('[Contacts] Delete failed:', e);
    }
}

// ─── Editar contato ───────────────────────────────────────────────────────────

function openEditModal(id, name, phone, nicknames) {
    document.getElementById('edit-contact-id').value = id;
    document.getElementById('edit-name-input').value = name;
    document.getElementById('edit-phone-input').value = phone;
    _editNicknames = Array.isArray(nicknames) ? [...nicknames] : [];
    renderNicknameTags('edit-nicknames-tags', _editNicknames, removeEditNicknameTag);

    const modal = document.getElementById('contact-edit-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditModal() {
    const modal = document.getElementById('contact-edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function submitEditContact() {
    const id = document.getElementById('edit-contact-id').value;
    const name = document.getElementById('edit-name-input').value.trim();
    const phone = document.getElementById('edit-phone-input').value.trim();

    if (!name || !phone) {
        showToast('Atenção', 'Nome e telefone são obrigatórios.', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, nicknames: _editNicknames })
        });
        if (!res.ok) throw new Error('API error');

        showToast('Atualizado! ✅', `${name} foi atualizado na agenda.`, 'success');
        closeEditModal();
        await loadContacts();
    } catch (e) {
        showToast('Erro', 'Não foi possível atualizar o contato.', 'error');
        console.error('[Contacts] Update failed:', e);
    }
}

