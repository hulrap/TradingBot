# Trading Bot MCP Servers

This directory contains Model Context Protocol (MCP) servers for integrating with Vercel, Supabase, and Render platforms. These servers enable direct AI access to deployment logs, service management, and platform controls without manual copy-paste workflows.

## Overview

- **Vercel MCP Server**: Manages deployments, environment variables, analytics, and logs
- **Supabase MCP Server**: Database management, user authentication, edge functions, and logs
- **Render MCP Server**: Service management, deployments, metrics, and logs

## Quick Setup

### 1. Install Dependencies

```bash
cd mcp-servers
pnpm install
```

### 2. Build Servers

```bash
pnpm build
```

### 3. Configure Environment Variables

Create a `.env` file in the `mcp-servers` directory:

```env
# Vercel Configuration
VERCEL_TOKEN=your_vercel_token_here
VERCEL_TEAM_ID=your_team_id_here  # Optional
VERCEL_PROJECT_ID=your_project_id_here  # Optional

# Supabase Configuration  
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_PROJECT_REF=your_project_ref_here
SUPABASE_ACCESS_TOKEN=your_access_token_here  # For management API

# Render Configuration
RENDER_API_KEY=your_render_api_key_here
RENDER_OWNER_ID=your_owner_id_here  # Optional
```

### 4. Configure Claude Desktop

Add the following to your Claude Desktop configuration file:

**Location:**
- **macOS**: `~/.config/claude-desktop/config.json`
- **Windows**: `%APPDATA%\Claude\config.json`

```json
{
  "mcpServers": {
    "vercel": {
      "command": "node",
      "args": ["./path/to/your/project/mcp-servers/dist/vercel-server.js"],
      "env": {
        "VERCEL_TOKEN": "your-vercel-token-here",
        "VERCEL_TEAM_ID": "your-team-id-here",
        "VERCEL_PROJECT_ID": "your-project-id-here"
      }
    },
    "supabase": {
      "command": "node", 
      "args": ["./path/to/your/project/mcp-servers/dist/supabase-server.js"],
      "env": {
        "SUPABASE_URL": "your-supabase-url-here",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key-here",
        "SUPABASE_PROJECT_REF": "your-project-ref-here",
        "SUPABASE_ACCESS_TOKEN": "your-access-token-here"
      }
    },
    "render": {
      "command": "node",
      "args": ["./path/to/your/project/mcp-servers/dist/render-server.js"],
      "env": {
        "RENDER_API_KEY": "your-render-api-key-here",
        "RENDER_OWNER_ID": "your-owner-id-here"
      }
    }
  }
}
```

## Getting API Keys and Tokens

### Vercel
1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Create a new token with appropriate scope
3. Find your Team ID in team settings (if applicable)
4. Find Project ID in project settings

### Supabase
1. **Project URL & Service Role Key**: Available in project settings → API
2. **Project Ref**: Found in project URL or settings
3. **Access Token**: Generate in [Supabase Account Settings](https://supabase.com/dashboard/account/tokens)

### Render
1. Go to [Render Account Settings](https://dashboard.render.com/account)
2. Create a new API key
3. Find Owner ID in account settings (optional)

## Available Tools

### Vercel MCP Server

- `list_deployments` - List project deployments
- `get_deployment_logs` - Get deployment logs
- `get_deployment_status` - Check deployment status
- `create_deployment` - Trigger new deployment
- `list_projects` - List all projects
- `get_project_env` - Get environment variables
- `update_project_env` - Update environment variables
- `get_analytics` - Get project analytics

### Supabase MCP Server

- `execute_sql` - Execute SQL queries
- `get_table_data` - Retrieve table data
- `get_database_schema` - Get schema information
- `get_project_logs` - Get project logs
- `get_auth_users` - List authentication users
- `get_realtime_stats` - Get real-time statistics
- `get_database_stats` - Get database metrics
- `execute_rpc` - Call stored procedures
- `get_edge_functions` - List edge functions
- `invoke_edge_function` - Call edge functions

### Render MCP Server

- `list_services` - List all services
- `get_service` - Get service details
- `get_service_logs` - Get service logs
- `list_deploys` - List deployments
- `get_deploy` - Get deployment details
- `get_deploy_logs` - Get deployment logs
- `create_deploy` - Create new deployment
- `suspend_service` - Suspend service
- `resume_service` - Resume service  
- `get_service_env_vars` - Get environment variables
- `update_service_env_vars` - Update environment variables
- `get_service_metrics` - Get service metrics
- `list_custom_domains` - List custom domains

## Usage Examples

Once configured, you can ask Claude directly:

- "Show me the logs for my latest Vercel deployment"
- "What's the current status of my Render services?"
- "Check the database performance metrics in Supabase"
- "List all failed deployments from the last week"
- "Update environment variables for production"
- "Get the error logs from my latest deployment"

## Development Mode

For development, you can run servers directly:

```bash
# Run Vercel server in development
pnpm dev:vercel

# Run Supabase server in development  
pnpm dev:supabase

# Run Render server in development
pnpm dev:render
```

## Security Notes

- Store API keys securely
- Use environment-specific tokens when possible
- Limit API key permissions to required scopes
- Regularly rotate API keys
- Monitor API usage through platform dashboards

## Troubleshooting

### Connection Issues
- Verify API keys are correct and have proper permissions
- Check that project IDs and references are accurate
- Ensure Claude Desktop configuration paths are correct

### Permission Errors
- Verify API tokens have required scopes
- Check team/organization access permissions
- Ensure service role keys have appropriate database permissions

### Log Access Issues
- Confirm project references are correct
- Verify access tokens for management APIs
- Check time ranges for log queries

## Support

For issues with:
- **MCP Server Code**: Check this repository's issues
- **Claude Desktop Integration**: See Claude Desktop documentation
- **Platform APIs**: Refer to respective platform documentation (Vercel, Supabase, Render) 