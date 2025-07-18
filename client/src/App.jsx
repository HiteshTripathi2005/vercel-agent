import React, { useState } from 'react';

const App = () => {
  const [inputValue, setInputValue] = useState('');
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  const handleButtonClick = async () => {
    if (!inputValue.trim()) {
      setResponseText('Please enter a prompt.');
      return;
    }

    if (loading) {
      addDebugLog('Request blocked - already loading');
      return;
    }

    setResponseText('');
    setDebugLogs([]);
    setLoading(true);
    addDebugLog('Starting request...');

    try {
      addDebugLog('Sending fetch request to http://localhost:3000/generate');
      const response = await fetch('http://localhost:3000/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: inputValue }),
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
            setResponseText((prev) => {
              const newText = prev + chunk;
              addDebugLog(`Total text length: ${newText.length}`);
              return newText;
            });
          }
        }
      } catch (streamError) {
        addDebugLog(`Stream error: ${streamError.message}`);
        throw streamError;
      }
      
    } catch (error) {
      addDebugLog(`Fetch error: ${error.name} - ${error.message}`);
      console.error('Full error:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setResponseText('Error: Unable to connect to server. Make sure the backend is running on port 3000 and CORS is enabled.');
      } else {
        setResponseText('Error: ' + error.message);
      }
    } finally {
      setLoading(false);
      addDebugLog('Request completed');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleButtonClick();
    }
  };

  const clearLogs = () => {
    setDebugLogs([]);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>🚀 AI Tool - Debug Version</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask something..."
          style={{ 
            padding: '0.5rem', 
            fontSize: '16px', 
            width: '100%', 
            maxWidth: '400px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        />
        <button
          onClick={handleButtonClick}
          disabled={loading || !inputValue.trim()}
          style={{ 
            marginLeft: '0.5rem',
            padding: '0.5rem 1rem', 
            fontSize: '16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: loading || !inputValue.trim() ? '#ccc' : '#007bff',
            color: 'white',
            cursor: loading || !inputValue.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3>Response:</h3>
          <div
            style={{
              padding: '1rem',
              background: '#f4f4f4',
              borderRadius: '8px',
              minHeight: '100px',
              whiteSpace: 'pre-wrap',
              border: '1px solid #ddd',
              fontFamily: 'monospace'
            }}
          >
            {responseText || 'Response will appear here.'}
            {loading && !responseText && <span style={{ color: '#666' }}>Waiting for response...</span>}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Debug Logs: 
            <button onClick={clearLogs} style={{ marginLeft: '0.5rem', fontSize: '12px', padding: '0.25rem 0.5rem' }}>
              Clear
            </button>
          </h3>
          <div
            style={{
              padding: '1rem',
              background: '#1e1e1e',
              color: '#00ff00',
              borderRadius: '8px',
              minHeight: '100px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap'
            }}
          >
            {debugLogs.length === 0 ? 'Debug logs will appear here...' : debugLogs.join('\n')}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
        <h4>Troubleshooting Steps:</h4>
        <ol>
          <li>Make sure your backend is running on port 3000</li>
          <li>Check if CORS is enabled on your backend</li>
          <li>Open browser DevTools (F12) and check Console and Network tabs</li>
          <li>Try accessing http://localhost:3000/generate directly in your browser</li>
        </ol>
      </div>
    </div>
  );
};

export default App;