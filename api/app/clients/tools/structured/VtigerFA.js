const axios = require('axios');
const { z } = require('zod');
const { StructuredTool } = require('langchain/tools');
const { logger } = require('~/config');
const ExternalFA = require('./ExternalFA');

class VtigerFAAPI extends ExternalFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'vtiger_fa_api';
    this.predictionId = this.getEnvVariable('FLOWISE_VTIGER_PREDICTION_ID');

    // TODO: Change!!

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni aziendali generiche di Forma Aquae come articoli (prodotti aziendali come vasche o lavabi), procedure aziendali e dati non espressamente indicati in altri strumenti. Questo agente fornisce un accesso centralizzato e standardizzato ai contenuti aziendali attraverso l'API di Vtiger.
    //
    // Funzionalità Principali:
    // - Recupero Fatture: Accesso alle fatture emesse e ricevute.
    // - Recupero Ordini: Accesso agli ordini emessi e ricevuti.
    // - Recupero Lead: Accesso ai lead aziendali.
    // - Recupero Contatti: Accesso ai contatti aziendali.
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Vtiger FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;
  }

}

module.exports = VtigerFAAPI;
