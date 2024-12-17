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
    // Descrizione:
    // Questo tool è utilizzato per eseguire le query SQL proveniente dall'agente GO. Da usare solo dopo che
    // il tool "go_fa_api" ha restituito la query in una interazione precedente. Usare solo la query citata.
    `;
    
    this.description = this.description_for_model;

    this.schema = this.schema.extend({
      sql_query: z.string().describe('The SQL query from the go_fa_api to be executed.'),
   });

  }

}

module.exports = GOWorkflowFAAPI;
