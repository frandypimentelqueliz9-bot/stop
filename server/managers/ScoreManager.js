import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCORES_FILE = path.join(__dirname, '../scores.json');

// Persistencia global en memoria de los mejores puntajes
class ScoreManager {
    constructor() {
        this.highScores = []; // Array de { username, score, date }
        this.loadScores();
        this.onScoreUpdate = null;
    }

    setOnScoreUpdate(callback) {
        this.onScoreUpdate = callback;
    }

    loadScores() {
        try {
            if (fs.existsSync(SCORES_FILE)) {
                const data = fs.readFileSync(SCORES_FILE, 'utf-8');
                this.highScores = JSON.parse(data);
            }
        } catch (error) {
            console.error('Error al cargar puntajes:', error);
            this.highScores = [];
        }
    }

    saveScores() {
        try {
            // Guardamos solo el top 5 como solicitó el usuario, 
            // aunque en memoria manejemos más para la sesión actual si fuera necesario.
            // Para cumplir estrictamente "guarde el top 5", cortamos el array antes de guardar.
            const top5 = this.highScores.slice(0, 5);
            fs.writeFileSync(SCORES_FILE, JSON.stringify(top5, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error al guardar puntajes:', error);
        }
    }

    addScore(username, score) {
        console.log(`Intentando registrar puntaje: ${username} - ${score}`);
        // Buscar si el usuario ya existe (case insensitive)
        const normalizedUser = username.trim();
        const existingEntry = this.highScores.find(s => s.username.toLowerCase() === normalizedUser.toLowerCase());

        if (existingEntry) {
            console.log(`Usuario existente encontrado. Récord actual: ${existingEntry.score}`);
            // Si ya existe, actualizamos solo si la nueva puntuación es mayor (Récord Personal)
            if (score > existingEntry.score) {
                console.log('¡Nuevo récord personal!');
                existingEntry.score = score;
                existingEntry.date = new Date();
                existingEntry.username = normalizedUser; // Actualizar capitalización si cambió
            } else {
                console.log('No supera el récord personal.');
            }
        } else {
            console.log('Usuario nuevo. Añadiendo a la lista.');
            this.highScores.push({
                username: normalizedUser,
                score,
                date: new Date()
            });
        }

        // Ordenar descendentemente
        this.highScores.sort((a, b) => b.score - a.score);

        // Mantener solo top 50 en memoria, pero guardar top 5 en archivo
        if (this.highScores.length > 5) {
            this.highScores = this.highScores.slice(0, 5);
        }

        this.saveScores();
        if (this.onScoreUpdate) this.onScoreUpdate(this.getTopScores());
    }

    getTopScores(limit = 10) {
        return this.highScores.slice(0, limit);
    }
}

export const scoreManager = new ScoreManager();
