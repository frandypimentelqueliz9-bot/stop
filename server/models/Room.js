import { v4 as uuidv4 } from 'uuid';
import { scoreManager } from '../managers/ScoreManager.js';
import { validationManager } from '../managers/ValidationManager.js';

export const GameState = {
    LOBBY: 'LOBBY',
    PLAYING: 'PLAYING',
    REVIEW: 'REVIEW',
    RESULTS: 'RESULTS'
};

export class Room {
    constructor(hostId, hostName, config = {}) {
        this.id = uuidv4().substring(0, 6).toUpperCase();
        this.hostId = hostId;
        this.players = new Map();
        this.gameState = GameState.LOBBY;

        this.config = {
            maxRounds: config.maxRounds || 5,
            timePerRound: config.timePerRound || 60,
            categories: config.categories || [
                'Nombre', 'Apellido', 'Ciudad/País', 'Animal', 'Flor/Fruto', 'Color', 'Cosa'
            ]
        };

        this.currentRound = 0;
        this.currentLetter = null;
        this.timer = null; // Referencia al intervalo
        this.timeLeft = 0;
        this.usedLetters = new Set();
        this.previousGameLetters = new Set(); // Para evitar repetición entre partidas consecutivas
        this.letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

        // Callback para comunicar cambios al servidor (io.emit)
        this.onStateChange = null;
    }

    setUpdateCallback(callback) {
        this.onStateChange = callback;
    }

    broadcastState() {
        if (this.onStateChange) this.onStateChange(this.data);
    }

    addPlayer(player) {
        // Comprobar si ya existe un jugador con ese nombre
        // (OJO: en un entorno real con muchos usuarios deberíamos usar un token único no nombre,
        // pero para este MVP es suficiente y robusto para lo que pide el usuario).
        const existingPlayer = Array.from(this.players.values()).find(p => p.username === player.username);

        if (existingPlayer) {
            // Caso RECONEXIÓN
            // Borramos la entrada antigua con el socket viejo
            this.players.delete(existingPlayer.id);

            // Actualizamos el ID del jugador existente al nuevo socket
            existingPlayer.id = player.id;
            existingPlayer.isReady = false; // Reset ready al reconectar por seguridad

            // Lo volvemos a añadir con el nuevo socket como key
            this.players.set(player.id, existingPlayer);
            return true;
        }

        if (this.gameState !== GameState.LOBBY) return false;
        this.players.set(player.id, player);
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.hostId === playerId && this.players.size > 0) {
            this.hostId = this.players.keys().next().value;
        }
    }

    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    startGame() {
        if (this.gameState !== GameState.LOBBY) return;
        this.currentRound = 0;
        this.usedLetters.clear();
        this.players.forEach(p => p.resetForNewGame());
        this.startRound();
    }

    startRound() {
        if (this.currentRound >= this.config.maxRounds) {
            this.finishGame();
            return;
        }

        this.currentRound++;
        this.gameState = GameState.PLAYING;
        this.currentLetter = this.getRandomLetter();
        this.timeLeft = this.config.timePerRound;
        this.players.forEach(p => p.answers[this.currentRound] = {});

        this.broadcastState();

        // Iniciar Temporizador
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                this.stopRound(null); // Tiempo agotado
            } else {
                // Optimización: No enviar broadcast cada segundo si no es necesario, 
                // pero para sincronizar timer vizual sí.
                // En prod, mejor sincronizar timestamps, pero aquí simple:
                // this.broadcastState(); -> Demasiado ruido. Mejor evento 'timer_tick' dedicado.
                if (this.onStateChange) this.onStateChange({ type: 'timer', timeLeft: this.timeLeft, roomId: this.id });
            }
        }, 1000);
    }

    saveGameScores() {
        this.players.forEach(p => {
            scoreManager.addScore(p.username, p.score);
        });
    }

    // ... (rest of file)

    stopRound(playerWhoStoppedId) {
        if (this.gameState !== GameState.PLAYING) return;

        clearInterval(this.timer);
        this.gameState = GameState.REVIEW;
        this.roundStopCaller = playerWhoStoppedId;

        this.broadcastState();

        setTimeout(() => {
            this.calculateScores();
        }, 3000);
    }

    calculateScores() {
        const roundIdx = this.currentRound;
        const categoryAnswers = {};

        // Reiniciar puntajes de la ronda para envio al frontend
        this.lastRoundScores = {}; // { playerId: { category: points } }

        // 1. Agrupar respuestas
        this.players.forEach(player => {
            this.lastRoundScores[player.id] = {}; // Init obj

            const answers = player.answers[roundIdx] || {};
            this.config.categories.forEach(cat => {
                if (!categoryAnswers[cat]) categoryAnswers[cat] = {};

                let word = answers[cat] || '';

                // VALIDACIÓN CENTRALIZADA
                const isValid = validationManager.validate(cat, word) &&
                    word.trim().toUpperCase().startsWith(this.currentLetter);

                if (isValid) {
                    const normalizedGroupKey = validationManager.normalize(word);
                    if (!categoryAnswers[cat][normalizedGroupKey]) categoryAnswers[cat][normalizedGroupKey] = [];
                    categoryAnswers[cat][normalizedGroupKey].push(player.id);
                }
            });
        });

        // 2. Asignar puntos y guardar detalle
        this.players.forEach(player => {
            let roundScore = 0;
            const answers = player.answers[roundIdx] || {};

            this.config.categories.forEach(cat => {
                let word = answers[cat] || '';
                const normalizedGroupKey = validationManager.normalize(word);
                let points = 0;

                if (normalizedGroupKey && categoryAnswers[cat][normalizedGroupKey]) {
                    const sameAnswers = categoryAnswers[cat][normalizedGroupKey];
                    if (sameAnswers.includes(player.id)) {
                        if (sameAnswers.length === 1) {
                            points = 10;
                        } else {
                            points = 5;
                        }
                    }
                }

                this.lastRoundScores[player.id][cat] = points;
                roundScore += points;
            });

            player.score += roundScore;
        });

        this.gameState = GameState.RESULTS;

        // Si fue la última ronda, guardamos los puntajes globales
        if (this.currentRound >= this.config.maxRounds) {
            this.saveGameScores();
        }

        this.broadcastState();
    }

    getRandomLetter() {
        let available = this.letters.filter(l => !this.usedLetters.has(l));

        // Estrategia: Intentar no repetir letras de la última partida si es posible
        // para dar sensación de variedad ("más dinámico")
        const freshLetters = available.filter(l => !this.previousGameLetters.has(l));

        if (freshLetters.length > 0) {
            available = freshLetters;
        }

        if (available.length === 0) {
            this.usedLetters.clear();
            available = this.letters;
        }

        const char = available[Math.floor(Math.random() * available.length)];
        this.usedLetters.add(char);
        return char;
    }

    finishGame() {
        this.gameState = GameState.RESULTS;
        clearInterval(this.timer);

        this.players.forEach(p => {
            scoreManager.addScore(p.username, p.score);
        });

        this.broadcastState();
    }

    resetToLobby() {
        this.currentRound = 0;
        this.gameState = GameState.LOBBY;

        // Guardamos las letras de esta partida para intentar no repetirlas en la siguiente
        this.previousGameLetters = new Set(this.usedLetters);

        this.usedLetters.clear();
        this.players.forEach(p => p.resetForNewGame());
        this.broadcastState();
    }

    get data() {
        return {
            type: 'update',
            id: this.id,
            hostId: this.hostId,
            players: Array.from(this.players.values()),
            gameState: this.gameState,
            config: this.config,
            currentRound: this.currentRound,
            currentLetter: this.currentLetter,
            timeLeft: this.timeLeft,
            roundStopCaller: this.roundStopCaller,
            lastRoundScores: this.lastRoundScores || {} // Enviamos detalle de ptos
        };
    }
}
