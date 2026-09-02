import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const baseUrl = process.env.CALENDAR_API_BASE_URL;
const apiToken = process.env.MCP_API_TOKEN;
if (!baseUrl || !apiToken) throw new Error("CALENDAR_API_BASE_URL and MCP_API_TOKEN are required");

const apiBase = new URL(baseUrl);
if (apiBase.protocol !== "http:" && apiBase.protocol !== "https:") {
  throw new Error("CALENDAR_API_BASE_URL must use http or https");
}

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, "Invalid identifier");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/, "Use ISO 8601 date/time");
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB colour");
const eventFields = {
  category: z.enum(["BUSINESS_TRIP", "ATTENDANCE"]).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  startDate: date.optional(),
  endDate: date.optional(),
  allDay: z.boolean().optional(),
  color: color.optional(),
  overtimeAvailable: z.boolean().optional(),
  isOvertimeOnly: z.boolean().optional(),
  equipmentOnly: z.boolean().optional(),
  personnel: z.string().trim().max(100).nullable().optional(),
  equipment: z.string().trim().max(300).nullable().optional(),
};

function audit(action: string, fields: Record<string, unknown>) {
  // stderr preserves MCP stdio protocol on stdout; Docker collects this as an audit trail.
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), service: "group-calendar-mcp", action, ...fields }));
}

async function callApi(path: string, method = "GET", body?: unknown) {
  const url = new URL(path, apiBase);
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload: unknown = await response.json().catch(() => ({ error: "Web app returned an invalid response" }));
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(`Calendar API ${response.status}: ${message}`);
  }
  return payload;
}

function result(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

async function change(action: string, identifiers: Record<string, string>, fn: () => Promise<unknown>) {
  audit(action, { outcome: "started", ...identifiers });
  try {
    const data = await fn();
    audit(action, { outcome: "succeeded", ...identifiers });
    return result(data);
  } catch (error) {
    audit(action, { outcome: "failed", ...identifiers, error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

const server = new McpServer({ name: "group-calendar", version: "1.0.0" });

server.registerTool("calendar_read_groups", { description: "List groups visible to the configured MCP service account.", inputSchema: {} }, async () => result(await callApi("/api/groups")));
server.registerTool("calendar_read_group", { description: "Get one group including members.", inputSchema: { groupId: id } }, async ({ groupId }) => result(await callApi(`/api/groups/${groupId}`)));
server.registerTool("calendar_read_events", { description: "List personal or group events. Dates filter overlapping events.", inputSchema: { groupId: id.optional(), start: date.optional(), end: date.optional() } }, async (input) => {
  const query = new URLSearchParams();
  if (input.groupId) query.set("groupId", input.groupId);
  if (input.start) query.set("start", input.start);
  if (input.end) query.set("end", input.end);
  return result(await callApi(`/api/events${query.size ? `?${query}` : ""}`));
});

server.registerTool("calendar_write_create_group", { description: "Create a group. Requires the service account to be an operator.", inputSchema: { name: z.string().trim().min(1).max(50), description: z.string().trim().max(200).optional() } }, async (input) => change("calendar_write_create_group", {}, () => callApi("/api/groups", "POST", input)));
server.registerTool("calendar_write_update_group", { description: "Update group settings.", inputSchema: { groupId: id, name: z.string().trim().min(1).max(50).optional(), description: z.string().trim().max(200).nullable().optional(), trackerOptions: z.string().max(1000).nullable().optional(), laptopOptions: z.string().max(1000).nullable().optional(), targetCount: z.number().int().min(0).max(100).optional(), eventDisplayLimit: z.number().int().min(1).max(10).optional() } }, async ({ groupId, ...body }) => change("calendar_write_update_group", { groupId }, () => callApi(`/api/groups/${groupId}`, "PATCH", body)));
server.registerTool("calendar_delete_group", { description: "Permanently delete a group and its related data. Set confirm to true only after user confirmation.", inputSchema: { groupId: id, confirm: z.literal(true) } }, async ({ groupId }) => change("calendar_delete_group", { groupId }, () => callApi(`/api/groups/${groupId}`, "DELETE")));

server.registerTool("calendar_write_create_event", { description: "Create an event. groupId omitted creates a personal event.", inputSchema: { ...eventFields, title: z.string().trim().min(1).max(100), startDate: date, endDate: date, groupId: id.optional() } }, async (input) => change("calendar_write_create_event", input.groupId ? { groupId: input.groupId } : {}, () => callApi("/api/events", "POST", input)));
server.registerTool("calendar_write_update_event", { description: "Update an existing event. Provide at least one field to change.", inputSchema: { eventId: id, ...eventFields } }, async ({ eventId, ...body }) => {
  if (Object.keys(body).length === 0) throw new Error("Provide at least one event field to update");
  return change("calendar_write_update_event", { eventId }, () => callApi(`/api/events/${eventId}`, "PATCH", body));
});
server.registerTool("calendar_delete_event", { description: "Permanently delete an event. Set confirm to true only after user confirmation.", inputSchema: { eventId: id, confirm: z.literal(true) } }, async ({ eventId }) => change("calendar_delete_event", { eventId }, () => callApi(`/api/events/${eventId}`, "DELETE")));

await server.connect(new StdioServerTransport());
audit("server_started", { calendarApi: apiBase.origin });
