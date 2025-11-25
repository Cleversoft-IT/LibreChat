const RetrievalFAAPI = require('./RetrievalFA');
const { z } = require('zod');

class ProcedureFAAPI extends RetrievalFAAPI {
  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'procedure_fa_api';

    this.description_for_model = `
    // Scopo: Questo tool permette di accedere alle procedure e conoscenze aziendali archiviate.
    //
    // Funzionalità Principali:
    // - Accesso alle procedure operative standard dell'azienda
    // - Recupero di documenti relativi a politiche aziendali
    // - Consultazione di manuali e guide interne
    // - Ricerca di informazioni su processi e workflow aziendali
    // - Accesso a documentazione tecnica e best practices
    //
    // Quando Utilizzare:
    // - Per rispondere a domande sulle procedure aziendali
    // - Per verificare i passaggi corretti di un processo interno
    // - Per ottenere informazioni su politiche e regolamenti aziendali
    // - Per consultare documentazione tecnica o manuali operativi
    //
    // Formato della Risposta:
    // - Il tool restituirà le informazioni pertinenti in formato testuale
    // - Se necessario, includerà riferimenti a documenti specifici
    // - Le immagini nelle risposte saranno automaticamente scaricate e visualizzate
    `;
    
    this.description = `Use this tool to access and retrieve information about company procedures and knowledge stored in Zilliz. Images in responses are automatically processed and displayed.`;

    // Extend the schema to add the knowledge_id specific to this implementation
    this.schema = this.schema.extend({
      knowledge_id: z.enum(['procedure']).describe('L\'identificativo univoco della collection su Zilliz. Select from the list of available collections.')
    });
  }
}

module.exports = ProcedureFAAPI;
