#!/usr/bin/env node

/**
 * Render MCP Server
 * Provides access to Render services, deployments, and logs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface RenderConfig {
  apiKey: string;
  ownerId?: string | undefined;
}

class RenderMCPServer {
  private server: Server;
  private config: RenderConfig;

  constructor() {
    this.server = new Server(
      {
        name: "render-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = {
      apiKey: process.env['RENDER_API_KEY'] || "",
      ownerId: process.env['RENDER_OWNER_ID'],
    };

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "list_services",
            description: "List all services",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["web_service", "private_service", "background_worker", "cron_job"],
                  description: "Filter by service type",
                },
                env: {
                  type: "string",
                  enum: ["docker", "node", "python", "ruby", "go", "rust"],
                  description: "Filter by environment",
                },
                limit: {
                  type: "number",
                  description: "Number of services to return",
                  default: 20,
                },
              },
            },
          },
          {
            name: "get_service",
            description: "Get details of a specific service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "get_service_logs",
            description: "Get logs for a specific service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
                startTime: {
                  type: "string",
                  description: "Start time (ISO string)",
                },
                endTime: {
                  type: "string",
                  description: "End time (ISO string)",
                },
                limit: {
                  type: "number",
                  description: "Number of log entries to return",
                  default: 100,
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "list_deploys",
            description: "List deployments for a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
                limit: {
                  type: "number",
                  description: "Number of deployments to return",
                  default: 10,
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "get_deploy",
            description: "Get details of a specific deployment",
            inputSchema: {
              type: "object",
              properties: {
                deployId: {
                  type: "string",
                  description: "Deployment ID",
                },
              },
              required: ["deployId"],
            },
          },
          {
            name: "get_deploy_logs",
            description: "Get logs for a specific deployment",
            inputSchema: {
              type: "object",
              properties: {
                deployId: {
                  type: "string",
                  description: "Deployment ID",
                },
                limit: {
                  type: "number",
                  description: "Number of log entries to return",
                  default: 100,
                },
              },
              required: ["deployId"],
            },
          },
          {
            name: "create_deploy",
            description: "Create a new deployment",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
                clearCache: {
                  type: "boolean",
                  description: "Clear build cache",
                  default: false,
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "suspend_service",
            description: "Suspend a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "resume_service",
            description: "Resume a suspended service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "get_service_env_vars",
            description: "Get environment variables for a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "update_service_env_vars",
            description: "Update environment variables for a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
                envVars: {
                  type: "array",
                  description: "Environment variables to update",
                  items: {
                    type: "object",
                    properties: {
                      key: { type: "string" },
                      value: { type: "string" },
                    },
                    required: ["key", "value"],
                  },
                },
              },
              required: ["serviceId", "envVars"],
            },
          },
          {
            name: "get_service_metrics",
            description: "Get metrics for a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
                startTime: {
                  type: "string",
                  description: "Start time (ISO string)",
                },
                endTime: {
                  type: "string",
                  description: "End time (ISO string)",
                },
                step: {
                  type: "number",
                  description: "Step size in seconds",
                  default: 300,
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "list_custom_domains",
            description: "List custom domains for a service",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: {
                  type: "string",
                  description: "Service ID",
                },
              },
              required: ["serviceId"],
            },
          },
          {
            name: "get_owner_info",
            description: "Get information about the account owner",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_services":
            return await this.listServices(args);
          case "get_service":
            return await this.getService(args);
          case "get_service_logs":
            return await this.getServiceLogs(args);
          case "list_deploys":
            return await this.listDeploys(args);
          case "get_deploy":
            return await this.getDeploy(args);
          case "get_deploy_logs":
            return await this.getDeployLogs(args);
          case "create_deploy":
            return await this.createDeploy(args);
          case "suspend_service":
            return await this.suspendService(args);
          case "resume_service":
            return await this.resumeService(args);
          case "get_service_env_vars":
            return await this.getServiceEnvVars(args);
          case "update_service_env_vars":
            return await this.updateServiceEnvVars(args);
          case "get_service_metrics":
            return await this.getServiceMetrics(args);
          case "list_custom_domains":
            return await this.listCustomDomains(args);
          case "get_owner_info":
            return await this.getOwnerInfo();
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

  private async makeRenderRequest(endpoint: string, options: RequestInit = {}) {
    const url = `https://api.render.com/v1${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`Render API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async listServices(args: any) {
    const { type, env, limit = 20 } = args;
    let endpoint = `/services?limit=${limit}`;

    if (type) endpoint += `&type=${type}`;
    if (env) endpoint += `&env=${env}`;
    if (this.config.ownerId) endpoint += `&ownerId=${this.config.ownerId}`;

    const data = await this.makeRenderRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getService(args: any) {
    const { serviceId } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getServiceLogs(args: any) {
    const { serviceId, startTime, endTime, limit = 100 } = args;
    let endpoint = `/services/${serviceId}/logs?limit=${limit}`;

    if (startTime) endpoint += `&startTime=${startTime}`;
    if (endTime) endpoint += `&endTime=${endTime}`;

    const data = await this.makeRenderRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async listDeploys(args: any) {
    const { serviceId, limit = 10 } = args;
    const data = await this.makeRenderRequest(
      `/services/${serviceId}/deploys?limit=${limit}`
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

  private async getDeploy(args: any) {
    const { deployId } = args;
    const data = await this.makeRenderRequest(`/deploys/${deployId}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getDeployLogs(args: any) {
    const { deployId, limit = 100 } = args;
    const data = await this.makeRenderRequest(
      `/deploys/${deployId}/logs?limit=${limit}`
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

  private async createDeploy(args: any) {
    const { serviceId, clearCache = false } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/deploys`, {
      method: "POST",
      body: JSON.stringify({ clearCache }),
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

  private async suspendService(args: any) {
    const { serviceId } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/suspend`, {
      method: "POST",
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

  private async resumeService(args: any) {
    const { serviceId } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/resume`, {
      method: "POST",
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

  private async getServiceEnvVars(args: any) {
    const { serviceId } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/env-vars`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async updateServiceEnvVars(args: any) {
    const { serviceId, envVars } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/env-vars`, {
      method: "PUT",
      body: JSON.stringify(envVars),
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

  private async getServiceMetrics(args: any) {
    const { serviceId, startTime, endTime, step = 300 } = args;
    let endpoint = `/services/${serviceId}/metrics?step=${step}`;

    if (startTime) endpoint += `&startTime=${startTime}`;
    if (endTime) endpoint += `&endTime=${endTime}`;

    const data = await this.makeRenderRequest(endpoint);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async listCustomDomains(args: any) {
    const { serviceId } = args;
    const data = await this.makeRenderRequest(`/services/${serviceId}/custom-domains`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private async getOwnerInfo() {
    const ownerId = this.config.ownerId || "me";
    const data = await this.makeRenderRequest(`/owners/${ownerId}`);

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
    console.error("Render MCP server running on stdio");
  }
}

const server = new RenderMCPServer();
server.run().catch(console.error); 