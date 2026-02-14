// Persistencia global en memoria de los mejores puntajes
class ScoreManager {
    constructor() {
        this.highScores = []; // Array de { username, score, date }
    }

    addScore(username, score) {
        // Buscar si el usuario ya existe (case insensitive)
        const normalizedUser = username.trim();
        const existingEntry = this.highScores.find(s => s.username.toLowerCase() === normalizedUser.toLowerCase());

        if (existingEntry) {
            // Si ya existe, actualizamos solo si la nueva puntuación es mayor (Récord Personal)
            if (score > existingEntry.score) {
                existingEntry.score = score;
                existingEntry.date = new Date();
                existingEntry.username = normalizedUser; // Actualizar capitalización si cambió
            }
        } else {
            this.highScores.push({
                username: normalizedUser,
                score,
                date: new Date()
            });
        }

        // Ordenar descendentemente
        this.highScores.sort((a, b) => b.score - a.score);

        // Mantener solo top 50
        if (this.highScores.length > 50) {
            this.highScores = this.highScores.slice(0, 50);
        }
    }

    getTopScores(limit = 10) {
        return this.highScores.slice(0, limit);
    }
}

export const scoreManager = new ScoreManager();
