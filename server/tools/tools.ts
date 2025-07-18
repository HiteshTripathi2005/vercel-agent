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

export const tools = {
  getCurrentDateTime,
  getCurrentWeather,
  runTerminalCommand,
  getClientFolderStructure,
  readFileContent,
};