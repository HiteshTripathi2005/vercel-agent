import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { tools } from "../tools/tools";
import { FastifyReply, FastifyRequest } from "fastify";

const model = google('gemini-2.5-flash');
const system = `You are an AI coding editor with expert-level knowledge of all programming languages, frameworks, and best practices. You understand both general software concepts and specific client-side architectures. You can explain, generate, and review code, and you know how to use available tools efficiently. Always provide clear, concise, and smart answers tailored to the user’s needs.`;

export const streamResponse = async (request: FastifyRequest, reply: FastifyReply) => {
  const { messages } = request.body as { messages: any[] };
  
  console.log("Received messages:", messages);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      maxSteps: 5,
    });

    console.log("Received result:", result);

    return result.toDataStreamResponse();

  } catch (err) {
    reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    reply.raw.end();
  }
};