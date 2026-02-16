export class Player {
    constructor(id, username) {
        this.id = id;
        this.username = username;
        this.avatar = null; // Futuro: avatar url
        this.score = 0;
        this.isReady = false;
        this.answers = {}; // { roundIndex: { category: answer, time: timestamp } }

        // Manejo de desconexiones temporales
        this.isConnected = true;
        this.disconnectTimeout = null;
    }

    resetForNewGame() {
        this.score = 0;
        this.answers = {};
        this.isReady = false;
    }
}
