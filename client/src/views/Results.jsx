import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

const Results = ({ room, isHost }) => {
    const { socket } = useSocket();

    // Calcular puntuaciones o mostrarlas si ya vienen del servidor
    // Asumimos que el backend enviará scores en el futuro, pero por ahora
    // mostraremos una tabla dummy o lo que tengamos.
    // En el plan, el backend calcula. Aquí solo renderizamos.

    // TODO: El backend debería enviar 'answers' de todos en round_ended.
    // Por ahora, room.players tiene score acumulado.
    // Necesitamos ver las respuestas de esta ronda. 
    // Modificaré el backend luego para incluir `lastRoundResults` en room data.
    // Por ahora mostremos el ranking global.

    const handleNextRound = () => {
        socket.emit('start_game', { roomId: room.id }); // Reutilizamos start_game para siguiente ronda
    };

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4">
            <div className="bg-white shadow-xl rounded-lg p-6 w-full border-2 border-gray-300">
                <h2 className="text-4xl font-bold text-center mb-6 text-blue-600 font-hand">Resultados Ronda {room.currentRound} ({room.currentLetter})</h2>

                {/* Tabla de Puntuaciones */}
                <div className="overflow-x-auto mb-8">
                    <h3 className="text-2xl font-bold text-gray-700 mb-2 font-hand">🏆 Puntuaciones</h3>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="p-2 font-bold uppercase">Jugador</th>
                                <th className="p-2 font-bold uppercase text-right">Puntaje Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {room.players.sort((a, b) => b.score - a.score).map((p, index) => (
                                <tr key={p.id} className={`border-b border-gray-200 hover:bg-yellow-50 ${p.id === socket.id ? 'bg-blue-50' : ''}`}>
                                    <td className="p-3 font-hand text-xl flex items-center">
                                        <span className="mr-2">{index + 1}.</span>
                                        {index === 0 && '👑 '}
                                        {p.username} {p.id === socket.id && '(Tú)'}
                                        {room.roundStopCaller === p.id && (
                                            <span className="ml-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse shadow-sm">
                                                STOP!
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 font-hand text-xl text-right font-bold w-32">
                                        {p.score} pts
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Tabla de Respuestas */}
                <div className="overflow-x-auto mb-6">
                    <h3 className="text-2xl font-bold text-gray-700 mb-2 font-hand">📝 Respuestas de la Ronda</h3>
                    <table className="w-full text-left border-collapse border-2 border-gray-300">
                        <thead className="bg-yellow-100">
                            <tr>
                                <th className="p-2 border border-gray-300 font-bold">Categoría</th>
                                {room.players.map(p => (
                                    <th key={p.id} className="p-2 border border-gray-300 font-bold min-w-[150px]">
                                        {p.username}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {room.config.categories.map(cat => (
                                <tr key={cat} className="hover:bg-gray-50">
                                    <td className="p-2 border border-gray-300 font-bold bg-gray-100">{cat}</td>
                                    {room.players.map(p => {
                                        const answer = p.answers[room.currentRound]?.[cat] || '';

                                        // Usamos el puntaje REAL calculado por el servidor para la validación visual
                                        // Si no existe lastRoundScores (versiones viejas), fallback a false.
                                        const score = room.lastRoundScores?.[p.id]?.[cat] || 0;
                                        const isZero = score === 0;

                                        return (
                                            <td key={p.id} className={`p-2 border border-gray-300 font-hand text-lg ${!isZero ? 'text-green-700 font-bold' : 'text-red-400 line-through'}`}>
                                                {answer || '-'}
                                                {!isZero && <span className="text-xs text-gray-500 ml-1">({score})</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Leyenda de Puntuación */}
                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6 text-sm text-blue-800">
                    <h4 className="font-bold mb-2">Sistema de Puntuación:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><span className="font-bold">10 puntos:</span> Respuesta única (nadie más la escribió).</li>
                        <li><span className="font-bold">5 puntos:</span> Respuesta repetida (alguien más la escribió).</li>
                        <li><span className="font-bold">0 puntos:</span> Respuesta inválida, no escrita o no existe en el diccionario.</li>
                    </ul>
                </div>

                <div className="mt-8 flex justify-center space-x-4">
                    {isHost ? (
                        <>
                            <button
                                onClick={handleNextRound}
                                className="bg-blue-600 text-white px-8 py-3 rounded shadow hover:bg-blue-700 font-bold text-xl transition transform hover:-translate-y-1"
                            >
                                {room.currentRound >= room.config.maxRounds ? 'Volver al Inicio' : 'Siguiente Ronda'}
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center text-gray-500 animate-pulse px-4">
                            Esperando al anfitrión...
                        </div>
                    )}

                    <button
                        onClick={() => {
                            if (confirm('¿Seguro que quieres salir de la partida?')) {
                                sessionStorage.removeItem('stop_game_session');
                                window.location.href = '/';
                            }
                        }}
                        className="bg-red-500 text-white px-6 py-3 rounded shadow hover:bg-red-600 font-bold text-lg transition transform hover:-translate-y-1"
                    >
                        Salir
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Results;
