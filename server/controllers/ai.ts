import { google } from "@ai-sdk/google";
import { generateText, streamText } from "ai";
import { tools } from "../tools/tools";
import { FastifyReply, FastifyRequest } from "fastify";

const model = google('gemini-2.5-flash');

export const generateResponse = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { prompt } = request.body as any;
    const { text, steps } = await generateText({
      model,
      prompt,
      maxSteps: 5,
      tools: tools,
    });
    
    const toolsUsed = steps.flatMap(step => step.toolCalls)

    console.log('Tools used:', toolsUsed);
    reply.send(text);
  } catch (error) {
    console.error('Error generating response:', error);
    reply.status(500).send({ error: 'Failed to generate response' });
  }
};
