import React, { useState, useEffect } from 'react';
import useSound from 'use-sound';
import { useSocket } from '../context/SocketContext';

// URLs de sonido (usando CDNs confiables para demo, deberian ser locales en prod)
const SOUNDS = {
    BG_MUSIC: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3', // Música de fondo tipo concurso
    STOP_SFX: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Silbato o Alarma de Stop
    TIMEOUT_SFX: 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3' // Alarma de tiempo
};

// Opciones estáticas para evitar reinicios del hook
const BG_OPTIONS = { loop: true, volume: 0.1 }; // Volumen bajo para fondo
const SFX_OPTIONS = { volume: 0.5 };

const Game = ({ room }) => {
    const { socket } = useSocket();
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(room.timeLeft);
    const [feedback, setFeedback] = useState(null);

    // Sonidos
    const [playBg, { stop: stopBg }] = useSound(SOUNDS.BG_MUSIC, BG_OPTIONS);
    const [playStop] = useSound(SOUNDS.STOP_SFX, SFX_OPTIONS);
    const [playTimeout] = useSound(SOUNDS.TIMEOUT_SFX, SFX_OPTIONS);

    // Gestión de música de fondo y efectos
    useEffect(() => {
        if (room.gameState === 'PLAYING') {
            playBg();
        } else {
            stopBg();

            // Si pasamos a REVIEW (se detuvo el juego)
            if (room.gameState === 'REVIEW') {
                if (room.roundStopCaller) {
                    playStop(); // Fue por STOP
                } else {
                    playTimeout(); // Fue por Tiempo
                }
            }
        }

        return () => stopBg();
    }, [room.gameState, playBg, stopBg, playStop, playTimeout, room.roundStopCaller]);

    // Sincronizar timer desde el socket si es necesario, 
    // pero room.timeLeft ya viene actualizado en 'room_update'.
    // Para suavidad, podríamos usar un timer local sincronizado.
    useEffect(() => {
        setTimeLeft(room.timeLeft);
    }, [room.timeLeft]);

    const handleChange = (category, value) => {
        if (room.gameState !== 'PLAYING') return;
        setAnswers(prev => ({
            ...prev,
            [category]: value
        }));
    };

    const handleStop = () => {
        socket.emit('call_stop', { roomId: room.id });
    };

    // Enviar respuestas cada vez que cambian (debouncear en prod) o al final
    // Aquí las enviamos al updatear o al final.
    // Mejor estrategia para MVP: Enviar todo al recibir 'stop_round' o cuando el usuario da Stop.
    // Pero necesitamos validación en tiempo real? No.

    // Efecto para enviar respuestas cuando se detiene la ronda
    useEffect(() => {
        if (room.gameState === 'REVIEW' || room.gameState === 'RESULTS') {
            socket.emit('submit_answer', { roomId: room.id, answers });
        }
    }, [room.gameState]);



    // Verificar si todas las categorías han sido respondidas
    const canCallStop = room.config.categories.every(cat => answers[cat] && answers[cat].trim().length > 0);

    return (
        <div className="w-full max-w-6xl mx-auto p-2 flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded shadow border-b-4 border-blue-200 mb-4">
                <div className="flex items-center space-x-4">
                    <div className="bg-yellow-300 w-16 h-16 flex items-center justify-center rounded-full text-4xl font-black border-2 border-black transform -rotate-3 shadow-lg">
                        {room.currentLetter}
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase">Ronda</p>
                        <p className="text-2xl font-bold">{room.currentRound} / {room.config.maxRounds}</p>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-5xl font-mono font-bold text-gray-800">
                        {timeLeft}s
                    </div>
                </div>

                <button
                    onClick={handleStop}
                    disabled={room.gameState !== 'PLAYING' || !canCallStop}
                    title={!canCallStop ? "Completa todas las categorías para hacer STOP" : "¡STOP!"}
                    className="bg-red-600 text-white px-8 py-4 rounded-full font-black text-2xl shadow-lg border-b-4 border-red-800 hover:bg-red-700 active:border-b-0 active:translate-y-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    STOP!
                </button>

            </div>

            {/* Tablero Scrollable */}
            <div className="flex-1 overflow-auto bg-white p-6 rounded shadow border-2 border-gray-200 relative"
                style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '100% 2rem', lineHeight: '2rem' }}>

                {/* Margen izquierdo rojo */}
                <div className="absolute left-12 top-0 bottom-0 w-0.5 bg-red-300"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ml-8">
                    {room.config.categories.map((cat) => (
                        <div key={cat} className="mb-2">
                            <label className="block text-gray-500 font-bold text-sm uppercase mb-1">{cat}</label>
                            <input
                                type="text"
                                value={answers[cat] || ''}
                                onChange={(e) => handleChange(cat, e.target.value)}
                                disabled={room.gameState !== 'PLAYING'}
                                className="w-full bg-transparent border-b-2 border-blue-200 focus:border-blue-600 outline-none font-hand text-2xl text-blue-900 pb-1"
                                placeholder={`Empieza con ${room.currentLetter}...`}
                                autoComplete="off"
                                onPaste={(e) => {
                                    e.preventDefault();
                                    return false;
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer / Status */}
            {room.gameState === 'REVIEW' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-lg shadow-2xl text-center transform scale-110 animate-bounce-in">
                        <h2 className="text-4xl font-bold mb-2">¡TIEMPO!</h2>
                        <p className="text-xl">Revisando respuestas...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game;
