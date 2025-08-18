<template>
  <div style="padding: 2rem; font-family: sans-serif; max-width: 1000px; margin: 0 auto;">
    <h1>🚀 AI Tool - Debug Version</h1>

    <div style="margin-bottom: 1rem;">
      <input
        type="text"
        v-model="inputValue"
        @keypress.enter="!loading && handleButtonClick()"
        placeholder="Ask something..."
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
        @click="handleButtonClick"
        :disabled="loading || !inputValue.trim()"
        :style="{
          marginLeft: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '16px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: '#007bff',
          color: 'white',
          cursor: 'pointer',
          opacity: (loading || !inputValue.trim()) ? 0.5 : 1
        }"
      >
        {{ loading ? 'Generating...' : 'Generate' }}
      </button>
    </div>

    <div style="display: flex; gap: 1rem;">
      <div style="flex: 1;">
        <h3>Response:</h3>
        <div
          style="
            padding: 1rem;
            background: #f4f4f4;
            border-radius: 8px;
            min-height: 100px;
            white-space: pre-wrap;
            border: 1px solid #ddd;
            font-family: monospace;
          "
        >
          <span v-if="responseText">{{ responseText }}</span>
          <span v-else-if="loading" style="color: #666;">Waiting for response...</span>
          <span v-else>Response will appear here.</span>
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

<script setup>
import { ref } from 'vue';

const inputValue = ref('');
const responseText = ref('');
const loading = ref(false);
const debugLogs = ref([]);

function addDebugLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.value.push(`[${timestamp}] ${message}`);
  // Optionally, also log to console
  // console.log(`[${timestamp}] ${message}`);
}

async function handleButtonClick() {
  if (!inputValue.value.trim()) {
    responseText.value = 'Please enter a prompt.';
    return;
  }
  if (loading.value) {
    addDebugLog('Request blocked - already loading');
    return;
  }
  responseText.value = '';
  debugLogs.value = [];
  loading.value = true;
  addDebugLog('Starting request...');
  try {
    addDebugLog('Sending fetch request to http://localhost:3000/generate');
    const response = await fetch('http://localhost:3000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: inputValue.value }),
    });
    addDebugLog(`Response status: ${response.status} ${response.statusText}`);
    addDebugLog(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    if (!response.body) {
      throw new Error('No response body');
    }
    addDebugLog('Got response body, starting to read stream...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let chunkCount = 0;
    try {
      while (true) {
        addDebugLog(`Reading chunk ${chunkCount + 1}...`);
        const { done, value } = await reader.read();
        if (done) {
          addDebugLog('Stream completed');
          break;
        }
        if (value) {
          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          addDebugLog(`Chunk ${chunkCount} received: "${chunk}" (${chunk.length} chars)`);
          responseText.value += chunk;
          addDebugLog(`Total text length: ${responseText.value.length}`);
        }
      }
    } catch (streamError) {
      addDebugLog(`Stream error: ${streamError.message}`);
      throw streamError;
    }
  } catch (error) {
    addDebugLog(`Fetch error: ${error.name} - ${error.message}`);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      responseText.value = 'Error: Unable to connect to server. Make sure the backend is running on port 3000 and CORS is enabled.';
    } else {
      responseText.value = 'Error: ' + error.message;
    }
  } finally {
    loading.value = false;
    addDebugLog('Request completed');
  }
}

function clearLogs() {
  debugLogs.value = [];
}
</script>