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
  description: "Performs an accurate, VS Code-like search for a given text string, regex, or whole word in all text files in the client folder (excluding node_modules and binary files). Supports case sensitivity, regex, whole word, and context lines. Returns matches with file path, line number, line text, and context. Use this tool to find all references to a keyword, code snippet, or pattern in the client codebase.",
  parameters: z.object({
    text: z.string().min(1).describe("The text string or regex pattern to search for in the client folder."),
    isRegex: z.boolean().optional().default(false).describe("Whether to treat the text as a regex pattern."),
    caseSensitive: z.boolean().optional().default(false).describe("Whether the search is case sensitive."),
    wholeWord: z.boolean().optional().default(false).describe("Whether to match the whole word only."),
    contextLines: z.number().optional().default(0).describe("Number of context lines to include before and after each match."),
  }),
  execute: async ({ text, isRegex = false, caseSensitive = false, wholeWord = false, contextLines = 0 }) => {
    try {
      // Use fast-glob for file listing
      let fg;
      try {
        fg = (await import('fast-glob')).default;
      } catch (e) {
        return { error: 'fast-glob is required. Please install it with `npm install fast-glob` in the server directory.' };
      }
      const clientPath = path.resolve(process.cwd(), '..', 'client');
      // Check if client directory exists
      try {
        const stat = await fs.stat(clientPath);
        if (!stat.isDirectory()) {
          return { error: `Client path ${clientPath} exists but is not a directory.` };
        }
      } catch (e) {
        return { error: `Client directory not found at ${clientPath}.` };
      }
      // List all files except node_modules and common binary extensions
      const files = await fg(["**/*", "!node_modules/**", "!**/*.png", "!**/*.jpg", "!**/*.jpeg", "!**/*.gif", "!**/*.ico", "!**/*.exe", "!**/*.dll", "!**/*.bin", "!**/*.pdf", "!**/*.zip", "!**/*.tar", "!**/*.gz", "!**/*.mp3", "!**/*.mp4", "!**/*.mov", "!**/*.avi", "!**/*.woff*", "!**/*.ttf", "!**/*.eot", "!**/*.otf", "!**/*.svg"], { cwd: clientPath, dot: true, onlyFiles: true });
      if (!files.length) {
        return { error: `No files found in client directory (${clientPath}).` };
      }

      // Prepare regex
      let pattern;
      if (isRegex) {
        pattern = text;
      } else {
        pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

      // Helper to check if file is text (simple heuristic)
      function isText(content: string) {
        // If >30% non-printable, treat as binary
        const nonPrintable = (content.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
        return nonPrintable < content.length * 0.3;
      }

      const matches = [];
      for (const file of files) {
        let content;
        try {
          content = await fs.readFile(path.join(clientPath, file), 'utf8');
        } catch (e) {
          continue;
        }
        if (!isText(content)) continue;
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; ++i) {
          if (regex.test(lines[i])) {
            // Collect context
            const before = [];
            const after = [];
            for (let j = Math.max(0, i - contextLines); j < i; ++j) before.push(lines[j]);
            for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); ++j) after.push(lines[j]);
            matches.push({
              filePath: file,
              line: i + 1,
              text: lines[i],
              contextBefore: before,
              contextAfter: after
            });
          }
        }
      }
      if (!matches.length) {
        return { message: `No matches found for '${text}' in ${files.length} files in client directory.` };
      }
      return { matches, filesScanned: files.length, matchesFound: matches.length };
    } catch (err) {
      return { error: (err as Error).message || 'Unknown error occurred in searchTextInClient.' };
    }
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