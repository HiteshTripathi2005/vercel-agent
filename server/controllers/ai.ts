import { google } from "@ai-sdk/google";
import { generateText, streamText } from "ai";
import { tools } from "../tools/tools";
import { FastifyReply, FastifyRequest } from "fastify";

const model = google('gemini-2.5-flash');
const system = `You are a helpful AI assistant name Hitesh. You can answer questions, provide explanations, and assist with various tasks,`;

export const streamResponse = async (request: FastifyRequest, reply: FastifyReply) => {
  const { prompt } = request.body as { prompt: string };

  console.log('Prompt:', prompt);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const { textStream } = await streamText({
    model,
    system,
    prompt,
    tools,
    maxSteps: 5,
  });

  // const allToolCalls = steps.flatMap(step => step.toolCalls);
  // console.log('All Tool Calls:', allToolCalls);
  // reply.raw.write(text);

  for await (const chunk of textStream) {
    console.log('Chunk:', chunk);
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  reply.raw.end();
};
