import fastify from 'fastify';
import { config } from 'dotenv';
import cors from "@fastify/cors";
import { generateResponse } from './controllers/ai';
config();

const app = fastify();
app.register(cors, {
    origin: true,
});

app.get('/', async (request, reply) => {
    reply.status(200).send({ message: 'Hello, World!' });
})

app.post('/generate', generateResponse);

const PORT = 3000;

app.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});