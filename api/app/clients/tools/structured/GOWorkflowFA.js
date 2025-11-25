const { z } = require('zod');
const DifyFAWorkflow = require('./DifyFAWorkflow');

class GOWorkflowFAAPI extends DifyFAWorkflow {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.difyWorkflowApiKey = this.getEnvVariable('DIFY_GO_WORKFLOW_API_KEY');
    this.name = 'go_workflow_fa_api';

    // TODO: CHANGE!!
    this.description_for_model = `
    // ATTENZIONE: Questo è un tool SECONDARIO da utilizzare SOLO dopo aver utilizzato "go_fa_api"!
    //
    // Descrizione:
    // Questo tool è utilizzato ESCLUSIVAMENTE per eseguire query SQL già validate dal tool "go_fa_api".
    // A differenza di "go_fa_api", questo tool NON valida l'esistenza delle colonne e può generare errori
    // se utilizzato con query SQL non validate.
    //
    // Regole d'uso:
    // 1. DEVE essere utilizzato SOLO dopo che il tool "go_fa_api" ha restituito una query SQL in una interazione precedente
    // 2. DEVE utilizzare ESATTAMENTE la stessa query SQL fornita dal tool "go_fa_api", senza modifiche ai nomi delle colonne
    // 3. DEVE essere utilizzato SOLO quando "go_fa_api" ha restituito dati incompleti o parziali
    //
    // Si consiglia di UTILIZZARE SEMPRE PRIMA il tool "go_fa_api", che ha l'intelligenza per generare 
    // e validare correttamente le query SQL con i nomi delle colonne e tabelle appropriati.
    `;
    
    this.description = this.description_for_model;

    this.schema = this.schema.extend({
      sql_query: z.string().describe('The SQL query from the go_fa_api to be executed.'),
   });

  }

}

module.exports = GOWorkflowFAAPI;
