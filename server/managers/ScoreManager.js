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
                try {
                    const loaded = JSON.parse(data);
                    // Asegurar estrictamente máximo 5 al cargar, descartando el resto
                    this.highScores = Array.isArray(loaded) ? loaded.slice(0, 5) : [];
                    console.log(`✅ Ranking cargado exitosamente: ${this.highScores.length} registros.`);
                } catch (parseError) {
                    console.warn('⚠️ Archivo de ranking corrupto, iniciando ranking vacío.');
                    this.highScores = [];
                }
            } else {
                console.log('⚠️ No se encontró archivo de ranking. Se creará uno nuevo al guardar.');
                this.highScores = [];
            }
        } catch (error) {
            console.error('❌ Error al acceder al archivo de puntajes:', error.message);
            this.highScores = [];
        }
    }

    saveScores() {
        try {
            // Guardamos solo el top 5 para consistencia
            const top5 = this.highScores.slice(0, 5);
            fs.writeFileSync(SCORES_FILE, JSON.stringify(top5, null, 2), 'utf-8');
            console.log('💾 Ranking (Top 5) guardado en disco.');
        } catch (error) {
            console.error('❌ Error al guardar puntajes en disco:', error.message);
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
                return; // No guardamos si no hay cambios
            }
        } else {
            console.log('Usuario nuevo. Añadiendo a la lista.');
            this.highScores.push({
                username: normalizedUser,
                score,
                date: new Date()
            });
        }

        // Ordenar descendentemente por puntaje
        this.highScores.sort((a, b) => b.score - a.score);

        // Mantener solo top 5 en memoria
        if (this.highScores.length > 5) {
            this.highScores = this.highScores.slice(0, 5);
        }

        this.saveScores();

        // Notificar actualización (enviamos top 5 al cliente)
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.getTopScores(5));
        }
    }

    getTopScores(limit = 5) {
        return this.highScores.slice(0, limit);
    }
}

export const scoreManager = new ScoreManager();
