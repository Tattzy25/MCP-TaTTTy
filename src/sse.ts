import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import bodyParser from "body-parser";

function getClientIp(req: Request): string {
	return (
		// Check X-Forwarded-For header first (when behind a proxy/load balancer)
		req.get("x-forwarded-for")?.split(",")[0] ||
		// Check X-Real-IP header (common with Nginx)
		req.get("x-real-ip") ||
		// Check req.ip (Express built-in, respects trust proxy setting)
		req.ip ||
		// Fallback to remoteAddress from the underlying socket
		req.socket.remoteAddress ||
		// Final fallback
		"unknown"
	);
}

export async function runSSEServer(server: Server) {
	let sseTransport: SSEServerTransport | null = null;
	const app = express();

	// Used to allow parsing of the body of the request
	app.use("/*", bodyParser.json());

	app.get("/sse", async (req, res) => {
		sseTransport = new SSEServerTransport("/messages", res);
		await server.connect(sseTransport);

		res.on("close", () => {
			sseTransport = null;
		});
	});

	app.post("/messages", async (req: Request, res) => {
		if (sseTransport) {
			// Parse the body and add the IP address
			const body = req.body;
			const params = req.body.params || {};
			params._meta = {
				ip: getClientIp(req),
				headers: req.headers,
			};
			const enrichedBody = {
				...body,
				params,
			};

			await sseTransport.handlePostMessage(req, res, enrichedBody);
		} else {
			res.status(400).send("No active SSE connection");
		}
	});

	// Handle 404s for all other routes
	app.use((req, res) => {
		res.status(404).json({
			error: "Not Found",
			message: `Route ${req.method} ${req.path} not found`,
			timestamp: new Date().toISOString(),
		});
	});

	const port = process.env.PORT || 3020;
	app.listen(port, () => {
		console.error(
			`stability-ai MCP Server running on SSE at http://localhost:${port}`
		);
	});
}

// Vercel serverless function export
export default async function handler(req: any, res: any) {
	const server = new Server(
		{
			name: "stability-ai",
			version: "0.0.1",
		},
		{
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		}
	);

	// Import and set up the server handlers here
	// This is a simplified version for Vercel - full setup would need to be imported

	if (req.method === 'GET' && req.url === '/sse') {
		// SSE is not supported in serverless functions
		res.status(501).json({
			error: "Not Implemented",
			message: "SSE transport is not supported in serverless environments. Use stdio transport instead.",
			timestamp: new Date().toISOString(),
		});
		return;
	}

	if (req.method === 'POST' && req.url === '/messages') {
		res.status(400).json({ error: "SSE connection required first" });
		return;
	}

	res.status(404).json({
		error: "Not Found",
		message: `Route ${req.method} ${req.url} not found`,
		timestamp: new Date().toISOString(),
	});
}
