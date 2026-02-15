import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './context/SocketContext';
import Home from './views/Home';
import Lobby from './views/Lobby';
import Game from './views/Game';
import Results from './views/Results';
import io from 'socket.io-client';

import { playSound, initAudio } from './utils/soundManager';

function App() {
    const { socket, isConnected } = useSocket();
    const [room, setRoom] = useState(null);
    const [playerId, setPlayerId] = useState(null);

    const usernameRef = useRef(''); // Para guardar username actual sin renderizar

    // Desbloquear audio en móviles con la primera interacción
    useEffect(() => {
        const unlockAudio = () => {
            initAudio();
            ['click', 'touchstart', 'keydown'].forEach(event =>
                document.removeEventListener(event, unlockAudio)
            );
        };

        ['click', 'touchstart', 'keydown'].forEach(event =>
            document.addEventListener(event, unlockAudio)
        );

        return () => {
            ['click', 'touchstart', 'keydown'].forEach(event =>
                document.removeEventListener(event, unlockAudio)
            );
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            // Reintentar si se desconectó y volvió
            const session = sessionStorage.getItem('stop_game_session');
            if (session) {
                try {
                    const { roomId, username } = JSON.parse(session);
                    // Solo reemitir join si tenemos datos válidos
                    if (roomId && username) {
                        console.log('Reconectando socket...', roomId);
                        socket.emit('join_room', { roomId, username });
                    }
                } catch (e) { console.error(e); }
            }
        };

        const handleRoomUpdate = (updatedRoom) => {
            setRoom(updatedRoom);
            // Guardar sesión si no existe o actualizarla
            if (!sessionStorage.getItem('stop_game_session') || JSON.parse(sessionStorage.getItem('stop_game_session')).roomId !== updatedRoom.id) {
                // Intentamos inferir el usuario si es posible, o mantenemos el ref
                const currentSession = sessionStorage.getItem('stop_game_session');
                const currentUser = currentSession ? JSON.parse(currentSession).username : (usernameRef.current || '');

                if (currentUser) {
                    sessionStorage.setItem('stop_game_session', JSON.stringify({ roomId: updatedRoom.id, username: currentUser }));
                }
            }
        };

        const handleError = (msg) => {
            alert(msg);
            // Si hay error de "Sala no encontrada", limpiar sesión
            if (msg === 'Sala no encontrada') {
                sessionStorage.removeItem('stop_game_session');
                setRoom(null);
            }
        };

        // Listeners
        socket.on('connect', handleConnect);
        socket.on('room_created', handleRoomUpdate);
        socket.on('room_update', handleRoomUpdate); // Unificamos lógica
        socket.on('error', handleError);

        socket.on('timer_update', (timeLeft) => {
            setRoom(prev => prev ? { ...prev, timeLeft } : null);
        });

        // Intentar recuperar sesión AL MONTAR (una sola vez)
        const session = sessionStorage.getItem('stop_game_session');
        if (session) {
            try {
                const { roomId, username } = JSON.parse(session);
                if (roomId && username) {
                    console.log('Restaurando sesión inicial...', roomId);
                    usernameRef.current = username;
                    socket.emit('join_room', { roomId, username });
                }
            } catch (e) { console.error(e); }
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('room_created', handleRoomUpdate);
            socket.off('room_update', handleRoomUpdate);
            socket.off('timer_update');
            socket.off('error', handleError);
        };
    }, [socket]);

    const prevRoomRef = useRef(null);
    useEffect(() => {
        if (!room) return;

        const prevRoom = prevRoomRef.current;

        // Sonido al entrar alguien al lobby
        if (prevRoom && prevRoom.gameState === 'LOBBY' && room.gameState === 'LOBBY') {
            if (room.players.length > prevRoom.players.length) {
                playSound('join');
            }
        }

        // Sonido STOP al cambiar a REVIEW
        if (prevRoom && prevRoom.gameState === 'PLAYING' && room.gameState === 'REVIEW') {
            playSound('stop');
        }

        // Sonido START al cambiar a PLAYING
        if (prevRoom && prevRoom.gameState === 'LOBBY' && room.gameState === 'PLAYING') {
            playSound('start');
        }

        prevRoomRef.current = room;
    }, [room]);

    // Lógica de renderizado
    const renderContent = () => {
        if (!isConnected) return <div className="flex items-center justify-center h-screen text-2xl text-gray-500 animate-pulse">Conectando al servidor...</div>;

        if (!room) {
            return <Home />;
        }

        if (room.gameState === 'LOBBY') {
            return <Lobby room={room} isHost={room.hostId === socket.id} />;
        }

        if (room.gameState === 'PLAYING' || room.gameState === 'REVIEW') {
            return <Game room={room} />;
        }

        if (room.gameState === 'RESULTS') {
            return <Results room={room} />;
        }

        return <div>Mayor estado desconocido: {room.gameState}</div>;
    };

    return (
        <div className="min-h-screen bg-yellow-50 font-hand text-gray-800 flex flex-col justify-between">
            <div className="flex-grow w-full">
                {renderContent()}
            </div>
            <footer className="w-full py-4 text-center text-sm text-gray-500 opacity-75 mt-auto">
                Desarrollado por Ing. Frandy Pimentel
            </footer>
        </div>
    );
}

export default App;
