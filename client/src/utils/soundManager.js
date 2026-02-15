let audioCtx = null;

export const initAudio = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }

    // En móviles, el contexto comienza en estado 'suspended' y debe ser 'resumed' por una acción de usuario
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext reanudado con éxito');
        }).catch(err => console.error('Error al reanudar AudioContext:', err));
    }

    // Hack para iOS: reproducir un buffer silencioso
    if (audioCtx) {
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
    }
};

export const playSound = (type) => {
    // Intentar inicializar si no existe, aunque lo ideal es que ya se haya llamado initAudio en un evento de click
    if (!audioCtx) initAudio();
    if (!audioCtx) return;

    // Si sigue suspendido, intentar reanudar (puede fallar si no es evento de usuario)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }

    const ctx = audioCtx;
    // Debemos verificar si ctx es válido antes de usarlo
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'join') {
        // Sonido suave de entrada (burbuja)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
    else if (type === 'start') {
        // Sonido de inicio (acorde ascendente)
        playNote(ctx, 523.25, now, 0.1, 'triangle'); // C5
        playNote(ctx, 659.25, now + 0.1, 0.1, 'triangle'); // E5
        playNote(ctx, 783.99, now + 0.2, 0.3, 'triangle'); // G5
    }
    else if (type === 'stop') {
        // Sonido de STOP (alarma fuerte)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
    else if (type === 'tick') {
        // Tic tac reloj
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }
};

const playNote = (ctx, freq, time, duration, type = 'sine') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    osc.start(time);
    osc.stop(time + duration);
};
