const axios = require('axios').default;
const { z } = require('zod');
const { StructuredTool } = require('langchain/tools');
const { logger } = require('~/config');

class DifyFA extends StructuredTool {
  constructor(fields) {
    super();
    this.override = fields.override ?? false;

    this.difyUrl = this.getEnvVariable('DIFY_API_CHAT_URL');

    // this.schema = z.object({
    //   original_prompt: z.string().optional().describe('Il testo della domanda così come viene scritta dall\'utente.'),
    //   context: z.string().optional().describe('Contesto ricavato dall\'assistente per la domanda originale. Conciso ed efficace, da utilizzare solo ed esclusivamente se il prompt originale non è sufficiente per rispondere alla domanda. Lasciare vuoto se non necessario.'),
    //   data_requested: z.string().optional().describe('Specifica i dati necessari richiesti all\'API per rispondere efficacemente alla domanda originale dell\'utente.'),
    //   isBenchmark: z.boolean().describe('Indica se si sta utilizzando il tool trainer e si vuole ottenere un benchmarking o meno. In questo caso usa solo i campi con prefisso "BENCHMARK -".'),
    //   prompt_from_forme: z.string().optional().describe('BENCHMARK - La richiesta come formulata al tool da analizzare, combinando i campi originali utilizzati (ad esempio original_prompt e context).'),
    //   correct_answer: z.string().optional().describe('BENCHMARK - La risposta corretta alla richiesta, indicata dall\'utente.'),
    //   forme_tool: z.string().optional().describe('BENCHMARK - Il machine name del tool utilizzato per la richiesta da analizzare.'),
    //   conversation_id: z.string().optional().describe('Identificativo univoco della conversazione in corso con il tool. Utilizzare per ulteriori messaggi con l\'agente nella conversazione. Non indicare o inventare se prima conversazione con l\'agente.'),
    // });

    this.schema = z.object({
      conversation_id: z.string().describe('Identificativo univoco della conversazione in corso con il tool. Utilizzare per ulteriori messaggi con l\'agente nella conversazione. Non indicare o inventare se nuova conversazione con l\'agente, usare stringa vuota "". In caso di diverse conversazioni, scegliere quella corretta in base al ragionamento.'),
      prompt_for_agent: z.string().describe('Il prompt perfetto del supervisore per l\'agente. Utilizzare questo valore anche per i follow-up con l\'agente, ad esempio per le conferme e le richieste di maggiori informazioni. Non essere conciso, ma chiaro e completo.'),
    });


  }

  getEnvVariable(varName) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing ${varName} environment variable.`);
    }
    return value;
  }


  // eslint-disable-next-line no-unused-vars
  async _call(query, _runManager) {
  //  async _call({ query }, _runManager) {

  logger.info(`[DifyFAAPI] Query: ${JSON.stringify(query)}`);

    // Create a formatted string that concatenates all the query objects
    let questionString = '';
    let conversationId = '';
    for (const key in query) {
      // Skip conversatin_id key
      if (key === 'conversation_id' && query[key] !== '' && query[key] !== ' ') {
        conversationId = query[key];
        continue;
      }
      questionString += `${key}: \n${query[key]}\n\n`;
    }

    const body = {
      inputs: {},
      query: questionString,
      response_mode: 'streaming',
      conversation_id: conversationId,
      user: 'ForMe_Supervisor'
    }

    let url = this.difyUrl;
    logger.info(`[DifyFAAPI] Querying Dify: ${url}`);
    logger.info(`[DifyFAAPI] Body: ${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.difyApiKey}`
        },
        
        body: JSON.stringify(body)
      });


    // Get text from response
    const text = await response.text();

    // Convert to array of object with new line as delimiter
    const records = text.split("\n\n");

    // Initialize answer
    let answer = "";
    let conversation_id = "";

    // Loop through the records and JSON parse each record
    records.forEach((record) => {
        try {
            // Trim "data: " at the beginning of each record
            record = record.replace("data: ", "");
            // Concatenate all the "answer" fields with content
            const recordObj = JSON.parse(record);

            // Check if the record is an answer
            if (recordObj.thought && recordObj.thought !== "") {
                answer += recordObj.thought;
                conversation_id = recordObj.conversation_id;
            }
        } catch (error) {
            // console.log(error);
        }
    });

    return `conversation_id: ${conversation_id}\n\n${answer}`;

    } catch (error) {
      logger.error('[DifyFAAPI] API request failed', error);
      return `[DifyFAAPI] API request failed: ${error.message}`;
    }
  }

}

module.exports = DifyFA;
