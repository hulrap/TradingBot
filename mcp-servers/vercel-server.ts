#!/usr/bin/env node

/**
 * Vercel MCP Server
 * Provides access to Vercel deployments, logs, and project management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface VercelConfig {
  token: string;
  teamId: string | undefined;
  projectId: string | undefined;
}

class VercelMCPServer {
  private server: Server;
  private config: VercelConfig;

  constructor() {
    this.server = new Server(
      {
        name: "vercel-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = {
      token: process.env['VERCEL_TOKEN'] || "",
      teamId: process.env['VERCEL_TEAM_ID'],
      projectId: process.env['VERCEL_PROJECT_ID'],
    };

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_deployments",
            description: "List deployments for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectId: {
                  type: "string",
                  description: "Project ID (optional, uses default if not provided)",
                },
                limit: {
                  type: "number",
                  description: "Number of deployments to return (default: 10)",
                  default: 10,
                },
              },
            },
          },
          {
            name: "get_deployment_logs",
            description: "Get logs for a specific deployment",
            inputSchema: {
              type: "object",
              properties: {
                deploymentId: {
                  type: "string",
                  description: "Deployment ID",
                },
                follow: {
                  type: "boolean",
                  description: "Follow logs in real-time",
                  default: false,
                },
              },
              required: ["deploymentId"],
            },
          },
          {
            name: "get_deployment_status",
            description: "Get status of a specific deployment",
            inputSchema: {
              type: "object",
              properties: {
                deploymentId: {
                  type: "string",
                  description: "Deployment ID",
                },
              },
              required: ["deploymentId"],
            },
          },
          {
            name: "create_deployment",
            description: "Create a new deployment",
            inputSchema: {
              type: "object",
              properties: {
                projectId: {
                  type: "string",
                  description: "Project ID (optional, uses default if not provided)",
                },
                gitSource: {
                  type: "object",
                  properties: {
                    ref: {
                      type: "string",
                      description: "Git branch or commit SHA",
                      default: "main",
                    },
                  },
                },
                env: {
                  type: "object",
                  description: "Environment variables for deployment",
                },
              },
            },
          },
          {
            name: "list_projects",
            description: "List all projects in the team/account",
            inputSchema: {
              type: "object",
              properties: {
                search: {
                  type: "string",
                  description: "Search term to filter projects",
                },
              },
            },
          },
          {
            name: "get_project_env",
            description: "Get environment variables for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectId: {
                  type: "string",
                  description: "Project ID (optional, uses default if not provided)",
                },
                target: {
                  type: "string",
                  enum: ["production", "preview", "development"],
                  description: "Environment target",
                  default: "production",
                },
              },
            },
          },
          {
            name: "update_project_env",
            description: "Update environment variables for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectId: {
                  type: "string",
                  description: "Project ID (optional, uses default if not provided)",
                },
                target: {
                  type: "string",
                  enum: ["production", "preview", "development"],
                  description: "Environment target",
                  default: "production",
                },
                env: {
                  type: "object",
                  description: "Environment variables to set",
                },
              },
              required: ["env"],
            },
          },
          {
            name: "get_analytics",
            description: "Get analytics data for a project",
            inputSchema: {
              type: "object",
              properties: {
                projectId: {
                  type: "string",
                  description: "Project ID (optional, uses default if not provided)",
                },
                from: {
                  type: "string",
                  description: "Start date (ISO string)",
                },
                to: {
                  type: "string",
                  description: "End date (ISO string)",
                },
                granularity: {
                  type: "string",
                  enum: ["hour", "day"],
                  default: "day",
                },
              },
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_deployments":
            return await this.listDeployments(args);
          case "get_deployment_logs":
            return await this.getDeploymentLogs(args);
          case "get_deployment_status":
            return await this.getDeploymentStatus(args);
          case "create_deployment":
            return await this.createDeployment(args);
          case "list_projects":
            return await this.listProjects(args);
          case "get_project_env":
            return await this.getProjectEnv(args);
          case "update_project_env":
            return await this.updateProjectEnv(args);
          case "get_analytics":
            return await this.getAnalytics(args);
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

  private async makeVercelRequest(endpoint: string, options: RequestInit = {}) {
    const url = `https://api.vercel.com${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.config.token}`,
      "Content-Type": "application/json",
      ...(this.config.teamId && { "X-Vercel-Team-Id": this.config.teamId }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async listDeployments(args: any) {
    const projectId = args.projectId || this.config.projectId;
    const limit = args.limit || 10;

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const data = await this.makeVercelRequest(
      `/v6/deployments?projectId=${projectId}&limit=${limit}`
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

  private async getDeploymentLogs(args: any) {
    const { deploymentId, follow } = args;

    const data = await this.makeVercelRequest(
      `/v2/deployments/${deploymentId}/events${follow ? "?follow=1" : ""}`
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

  private async getDeploymentStatus(args: any) {
    const { deploymentId } = args;

    const data = await this.makeVercelRequest(`/v13/deployments/${deploymentId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async createDeployment(args: any) {
    const projectId = args.projectId || this.config.projectId;
    const gitSource = args.gitSource || { ref: "main" };
    const env = args.env || {};

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const payload = {
      projectId,
      gitSource,
      env,
    };

    const data = await this.makeVercelRequest("/v13/deployments", {
      method: "POST",
      body: JSON.stringify(payload),
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

  private async listProjects(args: any) {
    const search = args.search ? `&search=${encodeURIComponent(args.search)}` : "";
    const data = await this.makeVercelRequest(`/v9/projects?limit=100${search}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getProjectEnv(args: any) {
    const projectId = args.projectId || this.config.projectId;
    const target = args.target || "production";

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const data = await this.makeVercelRequest(
      `/v9/projects/${projectId}/env?target=${target}`
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

  private async updateProjectEnv(args: any) {
    const projectId = args.projectId || this.config.projectId;
    const target = args.target || "production";
    const env = args.env;

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const envVars = Object.entries(env).map(([key, value]) => ({
      key,
      value: String(value),
      target: [target],
      type: "encrypted",
    }));

    const results = [];
    for (const envVar of envVars) {
      const data = await this.makeVercelRequest(`/v10/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify(envVar),
      });
      results.push(data);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  private async getAnalytics(args: any) {
    const projectId = args.projectId || this.config.projectId;
    const from = args.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = args.to || new Date().toISOString();
    const granularity = args.granularity || "day";

    if (!projectId) {
      throw new Error("Project ID is required");
    }

    const data = await this.makeVercelRequest(
      `/v1/analytics?projectId=${projectId}&from=${from}&to=${to}&granularity=${granularity}`
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Vercel MCP server running on stdio");
  }
}

const server = new VercelMCPServer();
server.run().catch(console.error); 