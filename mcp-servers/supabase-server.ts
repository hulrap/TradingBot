#!/usr/bin/env node

/**
 * Supabase MCP Server
 * Provides access to Supabase projects, database management, and logs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  projectRef: string;
  accessToken: string | undefined; // For management API
}

class SupabaseMCPServer {
  private server: Server;
  private config: SupabaseConfig;

  constructor() {
    this.server = new Server(
      {
        name: "supabase-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = {
      url: process.env['SUPABASE_URL'] || "",
      serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || "",
      projectRef: process.env['SUPABASE_PROJECT_REF'] || "",
      accessToken: process.env['SUPABASE_ACCESS_TOKEN'],
    };

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_sql",
            description: "Execute SQL query against the database",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "SQL query to execute",
                },
                params: {
                  type: "array",
                  description: "Query parameters",
                  default: [],
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_table_data",
            description: "Get data from a specific table",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name",
                },
                select: {
                  type: "string",
                  description: "Columns to select (default: *)",
                  default: "*",
                },
                filter: {
                  type: "object",
                  description: "Filter conditions",
                },
                limit: {
                  type: "number",
                  description: "Number of rows to return",
                  default: 100,
                },
                offset: {
                  type: "number",
                  description: "Number of rows to skip",
                  default: 0,
                },
              },
              required: ["table"],
            },
          },
          {
            name: "get_database_schema",
            description: "Get database schema information",
            inputSchema: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Specific table name (optional)",
                },
              },
            },
          },
          {
            name: "get_project_logs",
            description: "Get project logs from Supabase dashboard",
            inputSchema: {
              type: "object",
              properties: {
                level: {
                  type: "string",
                  enum: ["error", "warn", "info", "debug"],
                  description: "Log level filter",
                },
                from: {
                  type: "string",
                  description: "Start timestamp (ISO string)",
                },
                to: {
                  type: "string",
                  description: "End timestamp (ISO string)",
                },
                limit: {
                  type: "number",
                  description: "Number of log entries to return",
                  default: 100,
                },
              },
            },
          },
          {
            name: "get_auth_users",
            description: "Get authentication users",
            inputSchema: {
              type: "object",
              properties: {
                page: {
                  type: "number",
                  description: "Page number",
                  default: 1,
                },
                perPage: {
                  type: "number",
                  description: "Users per page",
                  default: 50,
                },
              },
            },
          },
          {
            name: "get_realtime_stats",
            description: "Get real-time connection statistics",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_database_stats",
            description: "Get database performance statistics",
            inputSchema: {
              type: "object",
              properties: {
                metric: {
                  type: "string",
                  enum: ["connections", "queries", "size", "performance"],
                  description: "Specific metric to retrieve",
                },
              },
            },
          },
          {
            name: "execute_rpc",
            description: "Execute a stored procedure/function",
            inputSchema: {
              type: "object",
              properties: {
                functionName: {
                  type: "string",
                  description: "Name of the function to execute",
                },
                params: {
                  type: "object",
                  description: "Function parameters",
                  default: {},
                },
              },
              required: ["functionName"],
            },
          },
          {
            name: "get_edge_functions",
            description: "List edge functions and their status",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "invoke_edge_function",
            description: "Invoke an edge function",
            inputSchema: {
              type: "object",
              properties: {
                functionName: {
                  type: "string",
                  description: "Name of the edge function",
                },
                body: {
                  type: "object",
                  description: "Request body",
                  default: {},
                },
                headers: {
                  type: "object",
                  description: "Request headers",
                  default: {},
                },
              },
              required: ["functionName"],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "execute_sql":
            return await this.executeSQL(args);
          case "get_table_data":
            return await this.getTableData(args);
          case "get_database_schema":
            return await this.getDatabaseSchema(args);
          case "get_project_logs":
            return await this.getProjectLogs(args);
          case "get_auth_users":
            return await this.getAuthUsers(args);
          case "get_realtime_stats":
            return await this.getRealtimeStats(args);
          case "get_database_stats":
            return await this.getDatabaseStats(args);
          case "execute_rpc":
            return await this.executeRPC(args);
          case "get_edge_functions":
            return await this.getEdgeFunctions(args);
          case "invoke_edge_function":
            return await this.invokeEdgeFunction(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async makeSupabaseRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.url}/rest/v1${endpoint}`;
    const headers = {
      apikey: this.config.serviceRoleKey,
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Supabase API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async makeManagementRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.config.accessToken) {
      throw new Error("Access token required for management API");
    }

    const url = `https://api.supabase.com/v1${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Supabase Management API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async executeSQL(args: any) {
    const { query, params = [] } = args;

    // For security, we'll use the RPC approach with a custom function
    // This would require a stored procedure in your database
    const data = await this.makeSupabaseRequest("/rpc/execute_sql", {
      method: "POST",
      body: JSON.stringify({ sql_query: query, parameters: params }),
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getTableData(args: any) {
    const { table, select = "*", filter = {}, limit = 100, offset = 0 } = args;

    let endpoint = `/${table}?select=${select}&limit=${limit}&offset=${offset}`;

    // Add filters
    Object.entries(filter).forEach(([key, value]) => {
      endpoint += `&${key}=eq.${value}`;
    });

    const data = await this.makeSupabaseRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getDatabaseSchema(args: any) {
    const { table } = args;

    let query = `
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `;

    if (table) {
      query += ` AND table_name = '${table}'`;
    }

    query += " ORDER BY table_name, ordinal_position";

    const data = await this.makeSupabaseRequest("/rpc/execute_schema_query", {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getProjectLogs(args: any) {
    const { level, from, to, limit = 100 } = args;

    let endpoint = `/projects/${this.config.projectRef}/logs`;
    const params = new URLSearchParams();

    if (level) params.append("level", level);
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    params.append("limit", limit.toString());

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const data = await this.makeManagementRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getAuthUsers(args: any) {
    const { page = 1, perPage = 50 } = args;

    const data = await this.makeSupabaseRequest(
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.serviceRoleKey}`,
        },
      }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getRealtimeStats(args: any) {
    const data = await this.makeManagementRequest(
      `/projects/${this.config.projectRef}/realtime/stats`
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getDatabaseStats(args: any) {
    const { metric } = args;

    let endpoint = `/projects/${this.config.projectRef}/database`;
    if (metric) {
      endpoint += `/${metric}`;
    }

    const data = await this.makeManagementRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async executeRPC(args: any) {
    const { functionName, params = {} } = args;

    const data = await this.makeSupabaseRequest(`/rpc/${functionName}`, {
      method: "POST",
      body: JSON.stringify(params),
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getEdgeFunctions(args: any) {
    const data = await this.makeManagementRequest(
      `/projects/${this.config.projectRef}/functions`
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async invokeEdgeFunction(args: any) {
    const { functionName, body = {}, headers = {} } = args;

    const response = await fetch(
      `${this.config.url}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.serviceRoleKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: response.status,
            data,
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Supabase MCP server running on stdio");
  }
}

const server = new SupabaseMCPServer();
server.run().catch(console.error); 