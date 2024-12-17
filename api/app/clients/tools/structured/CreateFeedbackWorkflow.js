const { z } = require('zod');
const DifyFAWorkflow = require('./DifyFAWorkflow');

class CreateFeedbackWorkflowAPI extends DifyFAWorkflow {

  // Override the constructor to change the name of the tool
  constructor(fields) {
    super(fields);

    this.difyWorkflowApiKey = this.getEnvVariable('DIFY_CREATE_FEEDBACK_WORKFLOW_API_KEY');
    this.name = 'create_feedback_workflow_api';

    this.description_for_model = `
    Descrizione:
    Questo tool serve per generare un feedback a partire dalla conversazione con l'utente, fornendo ai sviluppatori
    una base per comprendere e correggere gli errori del modello. Evita di menzionare il motivo per cui si sta 
    generando il feedback: limitati a riportare i fatti, le richieste dell'utente e i dati forniti dal sistema.
    `;
    
    this.description = this.description_for_model;
    
    
    this.schema = this.schema.extend({
      riassunto_della_chat: z.string().describe(
        'Un riassunto chiaro e fedele della conversazione (max 8000 caratteri). ' +
        'Non menzionare che il feedback è stato generato; limitati a descrivere i fatti e le richieste emerse. ' +
        'Includi dettagli utili al debugging (es. conversation_id, query SQL, dati di magazzino, ecc.), ' +
        'ed evidenzia le informazioni non coerenti o gli errori riscontrati. ' +
        'Evita valutazioni personali: riporta solo le informazioni discusse in maniera chiara e concisa, senza omettere' +
        'dettagli rilevanti.'
      ),
      autore: z.string().describe(
        'Il nome o identificativo dell\'autore del feedback, cioè l\'utente che ha segnalato il problema.'
      ),
      commento: z.string().optional().describe(
        'Un commento aggiuntivo dell\'utente (opzionale), per fornire chiarimenti sul problema rilevato. ' +
        'Se non presente, lascia vuoto. Non aggiungere informazioni non fornite dall\'utente.'
      ),
      title: z.string().describe(
        'Un titolo breve e significativo che descriva il problema o l\'errore emerso nella conversazione. ' +
        'Utilizza le parole chiave rilevanti presenti nella conversazione o nel commento dell\'utente, ' +
        'senza aggiungere interpretazioni personali.'
      ),
      prompt_for_benchmark: z.string().describe(
        'Il prompt originale dell\'utente, così come espresso nella conversazione, da utilizzare per il benchmark. ' +
        'Non aggiungere istruzioni o dettagli non presenti nella richiesta originale. ' +
        'Il prompt deve riflettere fedelmente la domanda dell\'utente, mantenendo il formato e il contesto. ' +
        'Questo campo è obbligatorio. Usa le stesse parole o espressioni usate dall\'utente per garantire ' +
        'la massima coerenza.'
      ),
      risposta_attesa: z.string().optional().describe(
        'Se, in base alla conversazione (soprattutto nel commento dell\'utente), la risposta richiesta' +
        'dall\'utente è assolutamente chiara e univoca, indicala qui.' +
        'Non inventare nulla: fornisci la risposta attesa solo se sei certo al 100%. ' +
        'Il commento dell\'utente è tipicamente il campo per capire se compilare questa proprietà. ' + 
        'In caso di dubbio, lascia vuoto.'
      ),
    });
    

  }

}

module.exports = CreateFeedbackWorkflowAPI;
