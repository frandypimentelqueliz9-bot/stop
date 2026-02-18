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
    const [username, setUsername] = useState(''); // Estado para el usuario actual

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

    // Efecto para manejar la conexión y reconexión
    useEffect(() => {
        if (!socket) return;

        const attemptRejoin = () => {
            const session = localStorage.getItem('stop_game_session');
            if (session) {
                try {
                    const { roomId, username: storedUsername } = JSON.parse(session);
                    if (roomId && storedUsername) {
                        console.log('Intentando reconectar/unirse a:', roomId);
                        setUsername(storedUsername); // Asegurar que tenemos el username en estado
                        socket.emit('join_room', { roomId, username: storedUsername });
                    }
                } catch (e) {
                    console.error('Error parsing session:', e);
                    localStorage.removeItem('stop_game_session');
                }
            }
        };

        const handleRoomUpdate = (updatedRoom) => {
            setRoom(updatedRoom);

            // Actualizar sesión
            if (!localStorage.getItem('stop_game_session') ||
                (JSON.parse(localStorage.getItem('stop_game_session')).roomId !== updatedRoom.id)) {

                // Usar el username del estado o intentar recuperarlo
                const currentSession = localStorage.getItem('stop_game_session');
                const currentUser = currentSession ? JSON.parse(currentSession).username : username;

                if (currentUser) {
                    localStorage.setItem('stop_game_session', JSON.stringify({ roomId: updatedRoom.id, username: currentUser }));
                    if (!username) setUsername(currentUser);
                }
            }
        };

        const handleError = (msg) => {
            // Ignorar alertas intrusivas si es solo un error de reconexión momentáneo
            console.error('Socket error:', msg);
            if (msg === 'Sala no encontrada') {
                alert(msg);
                localStorage.removeItem('stop_game_session');
                setRoom(null);
                setUsername('');
            }
        };

        // Listeners de eventos
        socket.on('room_created', handleRoomUpdate);
        socket.on('room_update', handleRoomUpdate);
        socket.on('error', handleError);

        socket.on('room_closed', () => {
            alert('La sala ha sido cerrada por el anfitrión.');
            localStorage.removeItem('stop_game_session');
            setRoom(null);
            setUsername('');
        });

        socket.on('timer_update', (timeLeft) => {
            setRoom(prev => prev ? { ...prev, timeLeft } : null);
        });

        // Si ya estamos conectados al montar (o al cambiar socket), intentamos unirnos
        if (isConnected) {
            attemptRejoin();
        }

        // Listener explícito para 'connect' (por si acaso ocurre después)
        socket.on('connect', attemptRejoin);

        return () => {
            socket.off('connect', attemptRejoin);
            socket.off('room_created', handleRoomUpdate);
            socket.off('room_update', handleRoomUpdate);
            socket.off('room_closed');
            socket.off('timer_update');
            socket.off('error', handleError);
        };
    }, [socket, isConnected]); // Dependencia clave: isConnected

    // Restauración inicial de sesión (solo para setear username visualmente antes de conectar)
    useEffect(() => {
        const session = localStorage.getItem('stop_game_session');
        if (session) {
            try {
                const { username } = JSON.parse(session);
                if (username) setUsername(username);
            } catch (e) { }
        }
    }, []);

    const prevRoomRef = useRef(null);
    useEffect(() => {
        if (!room) return;
        const prevRoom = prevRoomRef.current;
        if (prevRoom && prevRoom.gameState === 'LOBBY' && room.gameState === 'LOBBY' && room.players.length > prevRoom.players.length) playSound('join');
        if (prevRoom && prevRoom.gameState === 'PLAYING' && room.gameState === 'REVIEW') playSound('stop');
        if (prevRoom && prevRoom.gameState === 'LOBBY' && room.gameState === 'PLAYING') playSound('start');
        prevRoomRef.current = room;
    }, [room]);

    // Lógica de renderizado
    const renderContent = () => {
        if (!isConnected) return <div className="flex items-center justify-center h-screen text-2xl text-gray-500 animate-pulse">Conectando al servidor...</div>;

        if (!room) {
            return <Home />;
        }

        if (room.gameState === 'LOBBY') {
            const isHost = room.hostId === socket.id || (username && room.players.find(p => p.id === room.hostId)?.username === username);
            return <Lobby room={room} isHost={isHost} />;
        }

        if (room.gameState === 'PLAYING' || room.gameState === 'REVIEW') {
            return <Game room={room} />;
        }

        if (room.gameState === 'RESULTS') {
            const isHost = room.hostId === socket.id || (username && room.players.find(p => p.id === room.hostId)?.username === username);
            return <Results room={room} isHost={isHost} />;
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
