import { z } from 'zod';
import { tool } from "ai"
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';


const getCurrentDateTime = tool({
  description: "Returns the current local time and date. Use this tool when the user asks for the current time or date. Optionally, you can provide a 'format' argument as a BCP 47 language tag (e.g., 'en-US', 'fr-FR') to customize the output format. If not provided, 'en-US' will be used by default.",
  parameters: z.object({
    format: z.string().optional().default('en-US'),
  }),
  execute: async ({ format = 'en-US' }) => {
    return {
      time: new Date().toLocaleTimeString(format),
      date: new Date().toLocaleDateString(format)
    };
  }
})

const getCurrentWeather = tool({
  description: "Returns the current weather information for a specific location. Always provide the 'location' argument as a city name, zip code, or coordinates (latitude,longitude). This tool fetches real-time weather data including temperature, condition, humidity, wind, and more. Example locations: 'London', 'New York', '90210', '48.8566,2.3522'. If the user does not specify a location, ask them to provide one.",
  parameters: z.object({
    location: z.string().min(2).max(100),
  }),
  execute: async ({ location }) => {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('Weather API key not set in WEATHER_API_KEY env variable');
    }
    const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Weather API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return {
        location: data.location ? data.location.name : location,
        region: data.location ? data.location.region : undefined,
        country: data.location ? data.location.country : undefined,
        temperature_c: data.current ? data.current.temp_c : undefined,
        temperature_f: data.current ? data.current.temp_f : undefined,
        condition: data.current && data.current.condition ? data.current.condition.text : undefined,
        icon: data.current && data.current.condition ? data.current.condition.icon : undefined,
        humidity: data.current ? data.current.humidity : undefined,
        wind_kph: data.current ? data.current.wind_kph : undefined,
        wind_dir: data.current ? data.current.wind_dir : undefined,
        last_updated: data.current ? data.current.last_updated : undefined
      };
    } catch (error) {
      return {
        location,
        error: (error as Error).message || 'Failed to fetch weather data'
      };
    }
  }
})

const runTerminalCommand = tool({
  description: "Runs a terminal command on the server and returns the output. Use with caution. Provide the 'command' argument as a string. Optionally, you can provide a 'timeout' in milliseconds (default 10000).",
  parameters: z.object({
    command: z.string().min(1),
    timeout: z.number().optional().default(10000),
  }),
  execute: async ({ command, timeout = 10000 }) => {
    return new Promise((resolve) => {
      exec(command, { timeout }, (error, stdout, stderr) => {
        resolve({
          command,
          stdout,
          stderr,
          error: error ? error.message : undefined
        });
      });
    });
  }
});

const getClientFolderStructure = tool({
  description: "Recursively lists all files and directories in the 'client' folder (excluding 'node_modules'). Use this tool to discover the full path to a file when the user provides only a filename or partial path (e.g., 'main.jsx'). Before calling 'readFileContent', use this tool to find the correct relative path to the file, then pass that path to 'readFileContent' to view its contents. This helps ensure the correct file is accessed even if the user does not specify the full path.",
  parameters: z.object({}),
  execute: async () => {
    return new Promise((resolve) => {
      const clientAbsolutePath = path.resolve(process.cwd(), '..', 'client');
      const command = process.platform === 'win32'
        ? `cmd /c "dir "${clientAbsolutePath}" /s /b | findstr /v "node_modules""`
        : `ls -R "${clientAbsolutePath}" | grep -v node_modules`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({
            error: error.message,
            stderr
          });
          return;
        }

        let structure = stdout;
        const prefix = clientAbsolutePath + path.sep;
        structure = stdout.split('\n')
          .map(line => line.startsWith(prefix) ? line.substring(prefix.length) : line)
          .join('\n');

        resolve({
          structure: structure.trim(),
          stderr
        });
      });
    });
  }
});

const readFileContent = tool({
  description: "Reads and returns the content of a specified file. Use this tool when the user asks to view the content of a particular file. Accepts either 'filePath' or 'path' as the file path, both relative to the client folder.",
  parameters: z.object({
    filePath: z.string().min(1).describe("The path to the file to read, relative to the client folder.").optional(),
    path: z.string().min(1).optional(),
  }),
  execute: async (params) => {
    const filePath = params.filePath || params.path;
    if (!filePath) {
      return { error: "No filePath or path provided." };
    }
    const fullPath = `../client/${filePath}`;
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return { filePath: fullPath, content };
    } catch (error) {
      return { filePath: fullPath, error: (error as Error).message };
    }
  }
});

const findClientLintErrors = tool({
    description: "Finds and returns lint errors in the client folder using ESLint. Use this tool to check for code style and syntax issues in the client codebase. Returns a list of errors and warnings.",
    parameters: z.object({}),
    execute: async () => {
      return new Promise((resolve) => {
        const clientPath = path.resolve(process.cwd(), '..', 'client');
        const command = process.platform === 'win32'
          ? `cmd /c "cd \"${clientPath}\" && npx eslint . --format json"`
          : `cd \"${clientPath}\" && npx eslint . --format json`;
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
          if (error && !stdout) {
            resolve({ error: error.message, stderr });
            return;
          }
          try {
            const results = JSON.parse(stdout);
            const errors = results.flatMap((file: any) => file.messages.map((msg: any) => ({
              filePath: file.filePath,
              ...msg
            })));
            resolve({ errors, stderr });
          } catch (e) {
            resolve({ error: 'Failed to parse ESLint output', details: (e as Error).message, raw: stdout, stderr });
          }
        });
      });
    }
});

const searchTextInClient = tool({
  description: "Searches for a given text string in all files in the client folder (excluding node_modules) and returns a list of matches with file path and line number. Use this tool to find all references to a keyword or code snippet in the client codebase.",
  parameters: z.object({
    text: z.string().min(1).describe("The text string to search for in the client folder."),
  }),
  execute: async ({ text }) => {
    const clientPath = path.resolve(process.cwd(), '..', 'client');
    // Windows and Unix compatible grep/FindStr
    const isWin = process.platform === 'win32';
    const command = isWin
      ? `cmd /c "cd \"${clientPath}\" && findstr /spin /c:"${text.replace(/"/g, '""')}" *.* | findstr /v /i node_modules"`
      : `cd \"${clientPath}\" && grep -rn --exclude-dir=node_modules -- "${text.replace(/"/g, '\"')}" .`;
    return new Promise((resolve) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error && !stdout) {
          resolve({ error: error.message, stderr });
          return;
        }
        // Parse output: file:line:text
        const results = [];
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          if (isWin) {
            // Windows: path:line:text
            const match = line.match(/^(.*?):(\d+):(.*)$/);
            if (match) {
              results.push({ filePath: match[1], line: Number(match[2]), text: match[3] });
            } else {
              // fallback: path:text
              const idx = line.indexOf(':');
              if (idx > 0) {
                results.push({ filePath: line.slice(0, idx), line: null, text: line.slice(idx + 1) });
              }
            }
          } else {
            // Unix: ./path:line:text
            const match = line.match(/^\.?\/?(.*?):(\d+):(.*)$/);
            if (match) {
              results.push({ filePath: match[1], line: Number(match[2]), text: match[3] });
            }
          }
        }
        resolve({ matches: results, stderr });
      });
    });
  }
});

export const tools = {
  getCurrentDateTime,
  getCurrentWeather,
  runTerminalCommand,
  getClientFolderStructure,
  readFileContent,
  findClientLintErrors,
  searchTextInClient
};