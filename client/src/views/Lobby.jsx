import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSocket } from '../context/SocketContext';

const Lobby = ({ room, isHost }) => {
    const { socket } = useSocket();
    const [copySuccess, setCopySuccess] = useState('');

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(room.id);
            setCopySuccess('¡Copiado!');
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = room.id;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopySuccess('¡Copiado!');
        }
        setTimeout(() => setCopySuccess(''), 2000);
    };

    const startGame = () => {
        socket.emit('start_game', { roomId: room.id });
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4">
            <div className="bg-white shadow-xl rounded-lg p-6 w-full transform -rotate-1 border-2 border-gray-300">
                <div className="flex justify-between items-center mb-6 border-b-2 border-dashed border-gray-300 pb-4">
                    <h2 className="text-3xl font-bold font-hand text-blue-600">Sala de Espera</h2>
                    <div className="flex items-center space-x-2 bg-yellow-100 px-4 py-2 rounded-full border border-yellow-300">
                        <span className="font-bold text-gray-700">CÓDIGO:</span>
                        <span className="font-mono text-xl font-black text-gray-900 tracking-widest">{room.id}</span>
                        <button
                            onClick={copyToClipboard}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                            {copySuccess || 'Copiar'}
                        </button>
                    </div>
                </div>

                {/* Enlace de Invitación y QR */}
                <div className="mb-6 bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-center gap-4">
                    <div className="flex-1 overflow-hidden">
                        <p className="text-gray-500 text-xs font-bold mb-1 uppercase">Enlace de invitación:</p>
                        <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded border border-gray-300">
                            <span className="text-gray-600 text-sm truncate flex-1 select-all font-mono">
                                {window.location.host}/?room={room.id}
                            </span>
                            <button
                                onClick={async () => {
                                    const link = `${window.location.protocol}//${window.location.host}/?room=${room.id}`;
                                    try {
                                        await navigator.clipboard.writeText(link);
                                        setCopySuccess('¡Enlace copiado!');
                                    } catch (err) {
                                        const textArea = document.createElement("textarea");
                                        textArea.value = link;
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand('copy');
                                        document.body.removeChild(textArea);
                                        setCopySuccess('¡Enlace copiado!');
                                    }
                                    setTimeout(() => setCopySuccess(''), 2000);
                                }}
                                className="text-green-600 font-bold text-xs hover:text-green-800 uppercase"
                            >
                                {copySuccess || 'Copiar'}
                            </button>
                        </div>
                    </div>

                    {/* QR Code Pequeñito */}
                    <div className="bg-white p-1 rounded border border-gray-300 shadow-sm flex-shrink-0" title="Escanear para unirse">
                        <QRCodeSVG
                            value={`${window.location.protocol}//${window.location.host}/?room=${room.id}`}
                            size={50}
                            fgColor="#333"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xl font-bold mb-4 text-gray-600">Jugadores ({room.players.length})</h3>
                        <ul className="space-y-2">
                            {room.players.map((p) => (
                                <li key={p.id} className="flex items-center bg-gray-50 p-2 rounded border border-gray-200 shadow-sm animate-fade-in">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mr-3">
                                        {p.username.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-hand text-lg">{p.username} {p.id === room.hostId ? '👑' : ''}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-gray-600">Reglas</h3>
                            <ul className="list-disc pl-5 text-gray-500 font-hand text-lg">
                                <li>Rondas: {room.config.maxRounds}</li>
                                <li>Tiempo: {room.config.timePerRound}s</li>
                                <li>Categorías: {room.config.categories.join(', ')}</li>
                            </ul>
                        </div>

                        {isHost ? (
                            <>
                                <button
                                    onClick={startGame}
                                    disabled={room.players.length < 2}
                                    className={`mt-6 w-full text-white text-2xl font-bold py-4 rounded shadow-lg transform transition ${room.players.length < 2
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-green-500 hover:bg-green-600 hover:-translate-y-1 active:translate-y-0'
                                        }`}
                                >
                                    {room.players.length < 2 ? 'ESPERANDO JUGADORES...' : '¡COMENZAR JUEGO!'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (window.confirm('¿Estás seguro de que quieres cerrar la sala? Todos los jugadores serán desconectados.')) {
                                            socket.emit('close_room', { roomId: room.id });
                                        }
                                    }}
                                    className="mt-4 w-full text-red-500 font-bold py-2 rounded border-2 border-red-200 hover:bg-red-50 hover:border-red-400 transition"
                                >
                                    Cerrar Sala
                                </button>
                            </>
                        ) : (
                            <div className="mt-6 text-center p-4 bg-gray-100 rounded text-gray-500 animate-pulse">
                                Esperando al anfitrión...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Lobby;
