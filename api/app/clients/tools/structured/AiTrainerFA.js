const { z } = require('zod');
const DifyFA = require('./DifyFA');

class AiTrainerFA extends DifyFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.difyApiKey = this.getEnvVariable('DIFY_AITRAINER_API_KEY');
    this.name = 'ai_trainer_fa_api';

    this.description_for_model = `
    /**
     * Descrizione:
     * Questo tool è utilizzato per interagire con un agente AI specializzato nell'ottimizzazione delle istruzioni operative e dei prompt per assistenti, agenti e modelli di linguaggio (LLM).
     *
     * Funzionalità Principali:
     * - Ottimizzazione delle istruzioni operative per migliorare la chiarezza, precisione ed efficacia.
     * - Implementazione delle best practices di prompt engineering.
     * - Esecuzione di benchmarking e test di performance per modelli AI.
     *
     * Formato della Risposta:
     * - L'agente deve restituire solo i dati necessari per il supervisore.
     */
    `;

    this.description = `Uno strumento avanzato per ottimizzare le istruzioni operative e i prompt degli assistenti, agenti AI e modelli di linguaggio. Include funzionalità di benchmarking e test di performance.`;

    this.schema = this.schema.extend({
      context: z.string().optional().describe('Un riassunto della conversazione tra ForMe e l\'utente che ha portato al problema segnalato.'),
      problem: z.string().optional().describe('Descrizione dettagliata del problema segnalato dall\'utente o rilevato durante la conversazione.'),
      solution: z.string().optional().describe('La soluzione consigliata dall\'utente o il comportamento corretto atteso.'),
    });
  }
}

module.exports = AiTrainerFA;
