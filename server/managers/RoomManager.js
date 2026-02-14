import { Room } from '../models/Room.js';
import { Player } from '../models/Player.js';

class RoomManager {
    constructor() {
        this.rooms = new Map(); // Map<roomId, Room>
    }

    createRoom(hostId, hostName, config) {
        const room = new Room(hostId, hostName, config);
        const host = new Player(hostId, hostName);
        host.isReady = true; // El host siempre está listo al crear
        room.addPlayer(host);
        this.rooms.set(room.id, room);
        return room;
    }

    joinRoom(roomId, playerId, playerName) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Sala no encontrada' };

        // Verificar si ya está en la sala (reconectar)
        if (room.players.has(playerId)) {
            return { room, player: room.getPlayer(playerId) };
        }

        const newPlayer = new Player(playerId, playerName);
        const success = room.addPlayer(newPlayer);

        if (!success) return { error: 'No se puede unir a esta sala (Juego en curso o llena)' };

        return { room, player: newPlayer };
    }

    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.removePlayer(playerId);
            if (room.players.size === 0) {
                this.rooms.delete(roomId);
            }
            return room;
        }
        return null;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
}

export const roomManager = new RoomManager();
