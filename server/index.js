import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { roomManager } from './managers/RoomManager.js';
import { scoreManager } from './managers/ScoreManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*", // Permitir todo en dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

/*app.get('/', (req, res) => {
    res.send('Stop Game Server Running');
});*/

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    // Crear Sala
    socket.on('create_room', ({ username, config }) => {
        try {
            const room = roomManager.createRoom(socket.id, username, config);

            // Callback para actualizaciones de sala
            room.setUpdateCallback((data) => {
                if (data.type === 'timer') {
                    io.to(room.id).emit('timer_update', data.timeLeft);
                } else {
                    io.to(room.id).emit('room_update', room.data);
                }
            });

            socket.join(room.id);
            socket.emit('room_created', room.data);
            console.log(`Sala ${room.id} creada por ${username}`);
        } catch (e) {
            console.error(e);
            socket.emit('error', 'Error al crear sala');
        }
    });

    // Unirse a Sala
    socket.on('join_room', async ({ roomId, username }) => {
        // Verificar existencia de la sala
        const room = roomManager.getRoom(roomId);
        if (!room) {
            socket.emit('error', 'Sala no encontrada');
            return;
        }

        // Importación dinámica de Player
        let playerClass;
        try {
            const module = await import('./models/Player.js');
            playerClass = module.Player;
        } catch (e) {
            console.error("Error importando Player", e);
            socket.emit('error', 'Error interno del servidor');
            return;
        }

        // Crear instancia de Player
        const newPlayer = new playerClass(socket.id, username);

        // Intentar añadir (addPlayer maneja reconexión si el usuario ya existe)
        const added = room.addPlayer(newPlayer);

        if (!added) {
            socket.emit('error', 'No se puede unir (Juego en curso o lleno)');
            return;
        }

        socket.join(roomId);
        // Emitir a todos en la sala (incluido el nuevo)
        io.to(roomId).emit('room_update', room.data);
        console.log(`${username} se unió (o reconectó) a ${roomId}`);
    });

    // Iniciar Juego o Siguiente Ronda
    socket.on('start_game', ({ roomId }) => {
        const room = roomManager.getRoom(roomId);
        if (room && room.hostId === socket.id) {
            if (room.gameState === 'LOBBY') {
                room.startGame();
            } else if (room.gameState === 'RESULTS') {
                if (room.currentRound >= room.config.maxRounds) {
                    room.resetToLobby();
                } else {
                    room.startRound();
                }
            }
        }
    });

    // Enviar respuesta (parcial o final)
    socket.on('submit_answer', ({ roomId, answers }) => {
        const room = roomManager.getRoom(roomId);
        if (room) {
            const player = room.getPlayer(socket.id);
            if (player) {
                // Guardar respuestas en la ronda actual
                if (!player.answers) player.answers = {}; // Asegurar estructura
                player.answers[room.currentRound] = answers;
            }
        }
    });

    // Stop / Basta
    socket.on('call_stop', ({ roomId }) => {
        const room = roomManager.getRoom(roomId);
        if (room) {
            room.stopRound(socket.id);
        }
    });

    // Ranking
    socket.on('get_ranking', () => {
        socket.emit('receive_ranking', scoreManager.getTopScores(10));
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        // Manejar desconexión: buscar en qué salas estaba y sacarlo
        // Esto es ineficiente O(N), en prod usaríamos un mapa socketId -> roomId
        roomManager.rooms.forEach((room) => {
            if (room.players.has(socket.id)) {
                room.removePlayer(socket.id);
                io.to(room.id).emit('room_update', room.data);
                if (room.players.size === 0) {
                    roomManager.rooms.delete(room.id);
                }
            }
        });
    });
});
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});

//agregado ultimo
