import { animals, countries, flowersFruits, colors } from '../data/dictionaries.js';

class ValidationManager {
    constructor() {
        // Normalizar los diccionarios al cargar para búsquedas rápidas (Set)
        // Eliminamos acentos y pasamos a minúsculas
        this.dictionaries = {
            'Animal': new Set(animals.map(w => this.normalize(w))),
            'Ciudad/País': new Set(countries.map(w => this.normalize(w))),
            'Flor/Fruto': new Set(flowersFruits.map(w => this.normalize(w))),
            'Color': new Set(colors.map(w => this.normalize(w))),
            // 'Nombre': Dejamos laxo
            // 'Apellido': Dejamos laxo
            // 'Cosa': Dejamos laxo
        };
    }

    normalize(text) {
        if (!text) return '';
        return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    validate(category, word) {
        const normalizedWord = this.normalize(word);

        // 1. Validaciones básicas ya existentes (longitud, repetición)
        if (normalizedWord.length < 2) return false;
        if (/^(\w)\1+$/.test(normalizedWord)) return false;

        // 2. Validación por Diccionario
        // Si no tenemos diccionario para esa categoría, asumimos válida (ej: Cosa, Nombre...)
        // OJO: 'Ciudad/País' valida SOLO PAÍSES con mi lista actual.
        // Si el usuario escribe una ciudad válida (ej: 'Paris') y no está en mi lista de países, fallará.
        // Para evitar frustración, si la categoría es compuesta como 'Ciudad/País', 
        // y mi lista es solo Countries, es arriesgado. 
        // El usuario pidió: "compruebe que el pais escrito existe". Asumiré que validaré solo si tengo datos.

        if (this.dictionaries[category]) {
            // Verificación estricta
            return this.dictionaries[category].has(normalizedWord);
        }

        // Si no hay diccionario (Nombre, Apellido, Cosa), es válida por defecto (si pasó validación básica)
        return true;
    }
}

export const validationManager = new ValidationManager();
