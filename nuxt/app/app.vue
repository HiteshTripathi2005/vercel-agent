<template>
  <div style="position: fixed; inset: 0; background: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; min-height: 100vh; width: 100vw; z-index: 0;">
    <div style="flex: 1 1 0; display: flex; flex-direction: column; justify-content: flex-end; max-width: 700px; margin: 0 auto; width: 100%; padding: 0 0 90px 0;">
      <div ref="chatContainer" style="flex: 1 1 0; overflow-y: auto; padding: 2rem 0 0 0; display: flex; flex-direction: column;">
        <template v-if="messages.length">
          <div v-for="(message, messageIndex) in orderedMessages" :key="message.id">
            <template v-if="message.role === 'user'">
              <div style="margin-bottom: 0.5em; display: flex; align-items: flex-start; gap: 0.5em; justify-content: flex-end;">
                <div style="background: #e3f2fd; color: #1565c0; padding: 0.5em 1em; border-radius: 8px 0 8px 8px; font-weight: 500; max-width: 70%; text-align: right; box-shadow: 0 1px 4px #e3eaff;">
                  <span style="font-size: 0.9em; font-weight: bold;">User:</span><br>
                  <span>
                    {{
                      (() => {
                        const part = message.parts.find(p => (p as any).type === 'text');
                        return part && 'text' in part ? (part as any).text : '';
                      })()
                    }}
                  </span>
                </div>
              </div>
              <template v-if="messages[messageIndex+1] && (messages[messageIndex+1]?.parts?.some(p => (p as any).type === 'tool-invocation') || messages[messageIndex+1]?.role === 'assistant')">
                <div style="margin-bottom: 1.5em; display: flex; align-items: flex-start; gap: 0.5em; justify-content: flex-start;">
                  <div style="background: linear-gradient(135deg, #fff5f5 60%, #e8f5e9 100%); color: #222; padding: 0.75em 1.2em; border-radius: 12px 12px 0 12px; font-weight: 500; max-width: 75%; border-left: 4px solid #4caf50; box-shadow: 0 1px 6px #eaffea;">
                    <div v-if="messages[messageIndex+1]?.parts?.some(p => (p as any).type === 'tool-invocation')">
                      <span style="font-size: 0.9em; font-weight: bold; color: #b71c1c;">🔧 Tool Called:</span><br>
                      <template v-for="(part, partIndex) in messages[messageIndex+1]?.parts ?? []" :key="`tool-${messageIndex+1}-${partIndex}`">
                        <div v-if="(part as any).type === 'tool-invocation'">
                          <div><strong>{{ (part as any).toolInvocation?.toolName || 'Unknown Tool' }}</strong></div>
                        </div>
                      </template>
                      <hr style="border: none; border-top: 1px dashed #bdbdbd; margin: 0.5em 0;">
                    </div>
                    <div v-if="messages[messageIndex+1]?.role === 'assistant' && Array.isArray(messages[messageIndex+1]?.parts)">
                      <span style="font-size: 0.9em; font-weight: bold; color: #388e3c;">AI (README):</span><br>
                    <div
                      v-html="renderMarkdown((() => {
                        const parts = messages[messageIndex+1]?.parts ?? [];
                        const part = parts.find(p => (p as any).type === 'text');
                        return part && 'text' in part ? (part as any).text : '';
                      })())"
                      class="ai-readme-response"
                      style="font-size: 1em; color: #222; background: none; padding: 0; margin: 0;"
                    ></div>
                    </div>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </template>
        <span v-else style="color: #666;">No chat history yet.</span>
      </div>
    </div>
    <form style="position: fixed; bottom: 0; left: 0; width: 100vw; background: #fff; border-top: 1px solid #e0e0e0; display: flex; align-items: center; padding: 1rem 0.5rem 1rem 0.5rem; z-index: 10; box-shadow: 0 -2px 8px #e3eaff; max-width: 700px; margin: 0 auto; right: 0;" @submit.prevent="handleSubmit">
      <input
        type="text"
        v-model="input"
        placeholder="Ask something..."
        :disabled="status === 'submitted' || status === 'streaming'"
        style="
          padding: 0.75rem;
          font-size: 18px;
          width: 100%;
          border-radius: 6px;
          border: 1px solid #ccc;
          margin-right: 0.5rem;
        "
      />
      <button
        type="submit"
        :disabled="status === 'submitted' || status === 'streaming' || !input.trim()"
        :style="{
          padding: '0.75rem 1.5rem',
          fontSize: '18px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#007bff',
          color: 'white',
          cursor: 'pointer',
          opacity: ((status === 'submitted' || status === 'streaming' || !input.trim()) ? 0.5 : 1)
        }"
      >
        {{ (status === 'submitted' || status === 'streaming') ? 'Generating...' : 'Send' }}
      </button>
      <span v-if="status === 'error'" style="color: red; margin-left: 1rem;">Error</span>
      <span v-else-if="status === 'streaming'" style="color: #007bff; margin-left: 1rem;">Streaming...</span>
      <span v-else-if="status === 'submitted'" style="color: #007bff; margin-left: 1rem;">Submitting...</span>
      <span v-else-if="status === 'ready'" style="color: green; margin-left: 1rem;">Ready</span>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useChat } from '@ai-sdk/vue';
import { ref, watch, nextTick, computed } from 'vue';
import { marked } from 'marked';

const chatContainer = ref<HTMLElement | null>(null);

// Point to your Fastify backend endpoint for chat
const {
  messages,
  input,
  handleSubmit,
  status,
} = useChat({
  api: 'http://localhost:3001/generate',
});

const orderedMessages = computed(() => [...messages.value]);

const debugLogs = ref<string[]>([]);
function clearLogs() {
  debugLogs.value = [];
}

function renderMarkdown(text: string) {
  return marked.parse(text || '');
}

function addCopyButtons() {
  // Wait for DOM update
  nextTick(() => {
    const codeBlocks = document.querySelectorAll('.ai-readme-response pre');
    codeBlocks.forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return; // Avoid duplicate buttons
      const button = document.createElement('button');
      button.textContent = 'Copy';
      button.className = 'copy-btn';
      button.style.cssText = 'position:absolute;top:8px;right:8px;padding:2px 8px;font-size:0.9em;background:#007bff;color:#fff;border:none;border-radius:4px;cursor:pointer;z-index:2;';
      button.onclick = () => {
        const code = pre.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.textContent || '');
          button.textContent = 'Copied!';
          setTimeout(() => (button.textContent = 'Copy'), 1200);
        }
      };
      (pre as HTMLElement).style.position = 'relative';
      pre.appendChild(button);
    });
  });
}

// Auto-scroll to bottom when streaming or new message
watch([messages, status], async () => {
  await nextTick();
  if (chatContainer.value && (status.value === 'streaming' || status.value === 'submitted' || status.value === 'ready')) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
  // Add copy buttons after new message
  addCopyButtons();
});
</script>
