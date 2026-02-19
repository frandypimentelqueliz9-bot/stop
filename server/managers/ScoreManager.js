import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Score } from '../models/Score.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCORES_FILE = path.join(__dirname, '../scores.json');

// Persistencia global en memoria de los mejores puntajes
class ScoreManager {

    constructor() {
        this.highScores = []; // Array de { username, score, date }
        this.onScoreUpdate = null;
        this.useDB = false;
    }

    // Inicialización asíncrona para conectar a BD
    async init() {
        if (process.env.MONGO_URI) {
            try {
                // Conectando específicamente a la base de datos 'stopbd'
                // MongoDB (Mongoose) maneja esto automáticamente: 
                // Si la BD existe, se conecta. Si no existe, la crea cuando guardes el primer dato.
                await mongoose.connect(process.env.MONGO_URI, { dbName: 'stopbd' });
                this.useDB = true;
                console.log('✅ Conectado a MongoDB Atlas (Base de datos: stopbd).');
                await this.loadScoresFromDB();
            } catch (error) {
                console.error('❌ Error conectando a MongoDB:', error.message);
                console.warn('⚠️ Usando sistema de archivos local (NO persistente en Render).');
                this.loadScoresFromFile();
            }
        } else {
            console.warn('⚠️ MONGO_URI no definido. Usando sistema de archivos local (NO persistente en Render).');
            this.loadScoresFromFile();
        }
    }

    setOnScoreUpdate(callback) {
        this.onScoreUpdate = callback;
    }

    loadScoresFromFile() {
        try {
            if (fs.existsSync(SCORES_FILE)) {
                const data = fs.readFileSync(SCORES_FILE, 'utf-8');
                try {
                    const loaded = JSON.parse(data);
                    // Asegurar estrictamente máximo 5 al cargar
                    this.highScores = Array.isArray(loaded) ? loaded.slice(0, 5) : [];
                    console.log(`✅ [LOCAL] Ranking cargado: ${this.highScores.length} registros.`);
                } catch (parseError) {
                    this.highScores = [];
                }
            } else {
                this.highScores = [];
            }
        } catch (error) {
            console.error('❌ [LOCAL] Error:', error.message);
            this.highScores = [];
        }
    }

    saveScoresToFile() {
        try {
            const top5 = this.highScores.slice(0, 5);
            fs.writeFileSync(SCORES_FILE, JSON.stringify(top5, null, 2), 'utf-8');
        } catch (error) {
            console.error('❌ [LOCAL] Error guardando:', error.message);
        }
    }

    async loadScoresFromDB() {
        try {
            // Obtener top 5 de BD
            const scores = await Score.find().sort({ score: -1 }).limit(5);
            this.highScores = scores.map(s => ({
                username: s.username,
                score: s.score,
                date: s.date
            }));
            console.log(`✅ [MONGO] Ranking cargado: ${this.highScores.length} registros.`);
        } catch (error) {
            console.error('❌ [MONGO] Error cargando ranking de BD:', error);
            // Fallback a memoria vacía si falla la BD
            this.highScores = [];
        }
    }

    async addScore(username, score) {
        console.log(`Intentando registrar puntaje: ${username} - ${score}`);
        const normalizedUser = username.trim();

        if (this.useDB) {
            try {
                // Verificar si existe el usuario en BD
                const existing = await Score.findOne({
                    username: { $regex: new RegExp(`^${normalizedUser}$`, 'i') }
                });

                if (existing) {
                    if (score > existing.score) {
                        console.log('¡Nuevo récord personal (DB)!');
                        existing.score = score;
                        existing.date = new Date();
                        existing.username = normalizedUser; // Actualizar casing
                        await existing.save();
                    } else {
                        console.log('No supera el récord personal (DB).');
                    }
                } else {
                    console.log('Usuario nuevo (DB). Añadiendo.');
                    await Score.create({
                        username: normalizedUser,
                        score,
                        date: new Date()
                    });
                }

                // Recargar ranking actualizado
                await this.loadScoresFromDB();

            } catch (error) {
                console.error('❌ Error guardando score en DB:', error);
            }
        } else {
            // Lógica Local (Original)
            const existingEntry = this.highScores.find(s => s.username.toLowerCase() === normalizedUser.toLowerCase());

            if (existingEntry) {
                if (score > existingEntry.score) {
                    console.log('¡Nuevo récord personal (Local)!');
                    existingEntry.score = score;
                    existingEntry.date = new Date();
                    existingEntry.username = normalizedUser;
                } else {
                    return;
                }
            } else {
                this.highScores.push({
                    username: normalizedUser,
                    score,
                    date: new Date()
                });
            }

            // Ordenar y recortar
            this.highScores.sort((a, b) => b.score - a.score);
            if (this.highScores.length > 5) {
                this.highScores = this.highScores.slice(0, 5);
            }
            this.saveScoresToFile();
        }

        // Notificar actualización
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.getTopScores(5));
        }
    }

    getTopScores(limit = 5) {
        return this.highScores.slice(0, limit);
    }
}

export const scoreManager = new ScoreManager();
