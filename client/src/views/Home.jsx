import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const Home = ({ onJoin }) => {
    const { socket, isConnected } = useSocket();
    const [username, setUsername] = useState('');
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState(null);
    const [ranking, setRanking] = useState([]);

    const handleCreate = () => {
        if (!username.trim()) return setError('Ingresa un nombre');
        socket.emit('create_room', { username, config: {} });
    };

    const handleJoin = () => {
        if (!username.trim()) return setError('Ingresa un nombre');
        if (!roomId.trim()) return setError('Ingresa un código de sala');
        socket.emit('join_room', { roomId: roomId.toUpperCase(), username });
    };

    useEffect(() => {
        // Chequear si hay código en la URL
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
            setRoomId(roomParam);
        }

        if (socket && isConnected) {
            socket.emit('get_ranking');

            const handleRanking = (data) => {
                console.log('Ranking recibido:', data);
                setRanking(data);
            };

            socket.on('receive_ranking', handleRanking);
            return () => socket.off('receive_ranking', handleRanking);
        }
    }, [socket, isConnected]);

    return (
        <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto w-full py-8">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-blue-600 drop-shadow-sm rotate-[-2deg]">STOP!</h1>
                <p className="text-xl text-gray-500 mt-2">El clásico juego de lápiz y papel.</p>
            </div>

            <div className="bg-white p-6 shadow-xl border-2 border-gray-200 w-full transform rotate-1 rounded-sm">
                {error && <p className="text-red-500 mb-4 font-bold">{error}</p>}

                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-700 font-bold mb-1">Tu Nombre</label>
                        <input
                            type="text"
                            className="w-full border-b-2 border-blue-300 outline-none p-2 text-xl font-hand bg-transparent focus:border-blue-600 transition-colors placeholder-gray-300"
                            placeholder="Ej: JuanPerez"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="pt-4 border-t border-dashed border-gray-300">
                        <button
                            onClick={handleCreate}
                            disabled={!!roomId}
                            className={`w-full font-bold py-3 px-4 rounded shadow transition transform ${!!roomId
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5'
                                }`}
                        >
                            {!!roomId ? 'Borra el código para crear sala' : 'Crear Nueva Sala'}
                        </button>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="text"
                            className="flex-1 border-2 border-gray-300 rounded p-2 text-center uppercase tracking-widest font-mono"
                            placeholder="CÓDIGO"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            maxLength={6}
                        />
                        <button
                            onClick={handleJoin}
                            className="flex-1 bg-green-600 text-white font-bold py-2 px-4 rounded shadow hover:bg-green-700 transition"
                        >
                            Unirse
                        </button>
                    </div>
                </div>
            </div>

            {/* Ranking Global */}
            <div className="w-full bg-yellow-100 p-4 rounded shadow-md border border-yellow-300 transform -rotate-1">
                <h3 className="text-2xl font-bold text-yellow-800 text-center mb-3 font-hand">🏆 Mejores Jugadores</h3>
                {ranking.length === 0 ? (
                    <p className="text-center text-gray-500 font-hand">Aún no hay récords. ¡Sé el primero!</p>
                ) : (
                    <ul className="space-y-1">
                        {ranking.map((r, i) => (
                            <li key={i} className="flex justify-between border-b border-yellow-200 pb-1 font-hand text-lg">
                                <span>{i + 1}. {r.username}</span>
                                <span className="font-bold">{r.score} pts</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Home;
