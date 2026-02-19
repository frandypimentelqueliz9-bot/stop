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
        this.letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split('');

        // Bolsa de letras para garantizar variedad a largo plazo (tipo Tetris)
        this.letterBag = [];
        this.refillLetterBag();

        // Callback para comunicar cambios al servidor (io.emit)
        this.onStateChange = null;
        this.onEmpty = null; // Callback cuando la sala queda vacía
    }

    refillLetterBag() {
        this.letterBag = [...this.letters];
        // Fisher-Yates Shuffle
        for (let i = this.letterBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.letterBag[i], this.letterBag[j]] = [this.letterBag[j], this.letterBag[i]];
        }
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
            // Cancelar timeout de desconexión si existe
            if (existingPlayer.disconnectTimeout) {
                clearTimeout(existingPlayer.disconnectTimeout);
                existingPlayer.disconnectTimeout = null;
            }
            existingPlayer.isConnected = true;

            // Si el host se reconecta, actualizamos su ID
            if (this.hostId === existingPlayer.id) {
                this.hostId = player.id;
            }

            // Borramos la entrada antigua con el socket viejo
            this.players.delete(existingPlayer.id);

            // Actualizamos el ID del jugador existente al nuevo socket
            existingPlayer.id = player.id;
            // No reseteamos isReady bruscamente si el juego ya empezó, pero si es lobby sí
            // existingPlayer.isReady = false; // Reset ready al reconectar por seguridad <- Esto puede ser molesto si se reconecta rápido

            // Lo volvemos a añadir con el nuevo socket como key
            this.players.set(player.id, existingPlayer);
            return true;
        }

        if (this.gameState !== GameState.LOBBY) return false;
        this.players.set(player.id, player);

        // Seguridad: Si el host actual no existe en la sala (ej: fue borrado por timeout),
        // asignamos el rol de host a este nuevo jugador.
        if (!this.players.has(this.hostId)) {
            this.hostId = player.id;
        }

        return true;
    }

    removePlayer(playerId) {
        // Asegurarnos de limpiar timeouts si removemos manualmente
        const player = this.players.get(playerId);
        if (player && player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
        }

        this.players.delete(playerId);

        if (this.hostId === playerId && this.players.size > 0) {
            // Asignar nuevo host al siguiente jugador CONECTADO si es posible
            const nextHost = Array.from(this.players.values()).find(p => p.isConnected) || this.players.values().next().value;
            this.hostId = nextHost.id;
        }

        if (this.players.size === 0) {
            if (this.onEmpty) this.onEmpty();
        }
    }

    handleDisconnect(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        player.isConnected = false;

        // Iniciar temporizador de desconexión (e.g. 60 segundos)
        if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);

        player.disconnectTimeout = setTimeout(() => {
            this.removePlayer(playerId);
            // Notificar que se ha eliminado definitivamente
            this.broadcastState();
        }, 300000); // 5 minutos de espera para móviles

        this.broadcastState();
    }

    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    startGame() {
        if (this.gameState !== GameState.LOBBY) return;
        this.currentRound = 0;
        this.usedLetters.clear();
        this.players.forEach(p => p.resetForNewGame());

        // Select a random round to be 15 seconds
        if (this.config.maxRounds > 0) {
            this.shortRoundNumber = Math.floor(Math.random() * this.config.maxRounds) + 1;
        } else {
            this.shortRoundNumber = -1;
        }

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

        if (this.currentRound === this.shortRoundNumber) {
            this.timeLeft = 15;
        } else {
            this.timeLeft = this.config.timePerRound;
        }
        this.players.forEach(p => p.answers[this.currentRound] = {});

        this.broadcastState();

        this.broadcastState();

        // Iniciar Temporizador
        if (this.timer) clearInterval(this.timer);

        const startTimer = () => {
            this.timer = setInterval(() => {
                this.timeLeft--;
                if (this.timeLeft <= 0) {
                    this.stopRound(null); // Tiempo agotado
                } else {
                    if (this.onStateChange) this.onStateChange({ type: 'timer', timeLeft: this.timeLeft, roomId: this.id });
                }
            }, 1000);
        };

        if (this.currentRound === this.shortRoundNumber) {
            // Si es ronda rápida, damos 3 segundos de gracia para que se vea la alerta
            // antes de empezar a descontar el tiempo.
            setTimeout(startTimer, 3000);
        } else {
            startTimer();
        }
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
        // Asegurar que tenemos letras disponibles
        if (this.letterBag.length === 0) {
            this.refillLetterBag();
        }

        let char = this.letterBag.pop();
        let loopCount = 0;

        // Si por casualidad la letra ya salió en esta misma partida (ej: tras un refill),
        // buscamos otra.
        while (this.usedLetters.has(char) && loopCount < 50) {
            // Devolverla al "fondo" de la bolsa (inicio del array) para usarla después
            this.letterBag.unshift(char);

            if (this.letterBag.length === 0) {
                this.refillLetterBag();
            }
            char = this.letterBag.pop();
            loopCount++;
        }

        // Si fallamos demasiadas veces (muy raro), forzamos refill y cogemos cualquiera
        if (loopCount >= 50) {
            this.refillLetterBag();
            char = this.letterBag.pop();
        }

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
        this.usedLetters.clear();
        this.players.forEach(p => p.resetForNewGame());
        this.broadcastState();
    }

    get data() {
        return {
            type: 'update',
            id: this.id,
            hostId: this.hostId,
            players: Array.from(this.players.values()).map(p => {
                const { disconnectTimeout, ...publicData } = p;
                return publicData;
            }),
            gameState: this.gameState,
            config: this.config,
            currentRound: this.currentRound,
            currentLetter: this.currentLetter,
            timeLeft: this.timeLeft,
            isShortRound: this.currentRound === this.shortRoundNumber,
            roundStopCaller: this.roundStopCaller,
            lastRoundScores: this.lastRoundScores || {} // Enviamos detalle de ptos
        };
    }
}
