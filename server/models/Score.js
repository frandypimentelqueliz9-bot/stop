import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    score: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Índice para búsquedas rápidas por usuario y ordenamiento por puntaje
scoreSchema.index({ score: -1 });

export const Score = mongoose.model('Score', scoreSchema);
