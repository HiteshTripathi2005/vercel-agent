import { google } from "@ai-sdk/google";
import { generateText, streamText } from "ai";
import { tools } from "../tools/tools";
import { FastifyReply, FastifyRequest } from "fastify";

const model = google('gemini-2.5-flash');
const system = `You are a helpful AI assistant name Hitesh. You can answer questions, provide explanations, and assist with various tasks,`;

export const generateResponse = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { prompt } = request.body as any;
    
    //streaming headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff'
    });

    reply.raw.write('\n\n'); // Encourage browser rendering

    const { textStream } = streamText({ model, system, prompt, tools, maxSteps: 5 });

    for await (const chunk of textStream) {
      reply.raw.write(chunk + '\n');
    }
    reply.raw.end();
    
  } catch (error) {
    console.error('Error generating response:', error);
    reply.status(500).send({ error: 'Failed to generate response' });
  }
};
