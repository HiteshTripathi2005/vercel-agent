<template>
  <div style="padding: 2rem; font-family: sans-serif; max-width: 1000px; margin: 0 auto;">
    <h1>🚀 AI Tool - Debug Version</h1>


    <form style="margin-bottom: 1rem; display: flex; align-items: center;" @submit.prevent="handleSubmit">
      <input
        type="text"
        v-model="input"
        placeholder="Ask something..."
        :disabled="status === 'submitted' || status === 'streaming'"
        style="
          padding: 0.5rem;
          font-size: 16px;
          width: 100%;
          max-width: 400px;
          border-radius: 4px;
          border: 1px solid #ccc;
        "
      />
      <button
        type="submit"
        :disabled="status === 'submitted' || status === 'streaming' || !input.trim()"
        :style="{
          marginLeft: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '16px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: '#007bff',
          color: 'white',
          cursor: 'pointer',
          opacity: ((status === 'submitted' || status === 'streaming' || !input.trim()) ? 0.5 : 1)
        }"
      >
        {{ (status === 'submitted' || status === 'streaming') ? 'Generating...' : 'Generate' }}
      </button>
      <span v-if="status === 'error'" style="color: red; margin-left: 1rem;">Error</span>
      <span v-else-if="status === 'streaming'" style="color: #007bff; margin-left: 1rem;">Streaming...</span>
      <span v-else-if="status === 'submitted'" style="color: #007bff; margin-left: 1rem;">Submitting...</span>
      <span v-else-if="status === 'ready'" style="color: green; margin-left: 1rem;">Ready</span>
    </form>

    <div style="display: flex; gap: 1rem;">
      <div style="flex: 1;">
        <h3>Chat History:</h3>
        <div
          style="
            padding: 1rem;
            background: #f4f4f4;
            border-radius: 8px;
            min-height: 100px;
            white-space: pre-wrap;
            border: 1px solid #ddd;
            font-family: monospace;
            max-height: 300px;
            overflow-y: auto;
          "
        >
          <template v-if="messages.length">
            <div v-for="m in messages" :key="m.id" style="margin-bottom: 1em;">
              <div style="font-weight: bold; color: #007bff;">{{ m.role === 'user' ? 'User:' : 'AI:' }}</div>
              <div v-for="(part, idx) in m.parts" :key="idx">
                <span v-if="part.type === 'text'">{{ part.text }}</span>
                <span v-else-if="part.type === 'tool-invocation'">
                  [Tool: {{ (part as any).toolName }}]
                </span>
                <span v-else>[{{ part.type }}]</span>
              </div>
            </div>
          </template>
          <span v-else style="color: #666;">No chat history yet.</span>
        </div>
      </div>

      <div style="flex: 1;">
        <h3>
          Debug Logs:
          <button @click="clearLogs" style="margin-left: 0.5rem; font-size: 12px; padding: 0.25rem 0.5rem;">
            Clear
          </button>
        </h3>
        <div
          style="
            padding: 1rem;
            background: #1e1e1e;
            color: #00ff00;
            border-radius: 8px;
            min-height: 100px;
            max-height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
          "
        >
          <span v-if="debugLogs.length === 0">Debug logs will appear here...</span>
          <span v-else>{{ debugLogs.join('\n') }}</span>
        </div>
      </div>
    </div>

    <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
      <h4>Troubleshooting Steps:</h4>
      <ol>
        <li>Make sure your backend is running on port 3000</li>
        <li>Check if CORS is enabled on your backend</li>
        <li>Open browser DevTools (F12) and check Console and Network tabs</li>
        <li>Try accessing http://localhost:3000/generate directly in your browser</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChat } from '@ai-sdk/vue';

// Point to your Fastify backend endpoint for chat
const {
  messages,
  input,
  handleSubmit,
  status,
} = useChat({
  api: 'http://localhost:3000/generate',
});



import { ref } from 'vue';
const debugLogs = ref([]);
function clearLogs() {
  debugLogs.value = [];
}
</script>