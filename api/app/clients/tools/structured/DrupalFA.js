const axios = require('axios');
const { z } = require('zod');
const { StructuredTool } = require('langchain/tools');
const { logger } = require('~/config');
const ExternalFA = require('./ExternalFA');

class DrupalFAAPI extends ExternalFA {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.name = 'drupal_fa_api';
    this.predictionId = this.getEnvVariable('FLOWISE_DRUPAL_FA_PREDICTION_ID');

    this.description_for_model = `
    // Descrizione:
    // Questo tool è utilizzato per accedere a informazioni aziendali generiche di Forma Aquae come articoli (prodotti aziendali come vasche o lavabi), procedure aziendali e dati non espressamente indicati in altri strumenti. Questo agente fornisce un accesso centralizzato e standardizzato ai contenuti aziendali attraverso l'API di Drupal.
    //
    // Funzionalità Principali:
    // - Recupero Articoli: Accesso ai dati relativi ai prodotti aziendali come vasche, lavabi e altre attrezzature.
    // - Procedure Aziendali: Accesso alle procedure aziendali standard e altri documenti operativi.
    // - Dati Generici: Accesso a dati aziendali generici non specificati in altri strumenti.
    //
    // Formato della Risposta:
    // - L'agente deve restituire i dati in un formato strutturato (yaml o json) che includa solo i dati necessari per l'assistente principale.
    `;
    
    this.description = `Uno strumento per interrogare l'API di Drupal FA. L'input dovrebbe essere un prompt per l'agente per recuperare la query string. L'output sarà la risposta grezza in formato testuale dall'API.`;
  }

}

module.exports = DrupalFAAPI;
