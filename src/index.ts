#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import {
	generateImageSD35,
	GenerateImageSD35Args,
	generateImageSD35ToolDefinition,
	removeBackground,
	RemoveBackgroundArgs,
	removeBackgroundToolDefinition,
	upscaleCreative,
	UpscaleCreativeArgs,
	upscaleCreativeToolDefinition,
	controlStructure,
	ControlStructureArgs,
	controlStructureToolDefinition,
} from "./tools/index.js";
import {
	initializeResourceClient,
	ResourceClientConfig,
	getResourceClient,
} from "./resources/resourceClientFactory.js";
import { prompts, injectPromptTemplate } from "./prompts/index.js";
import { runSSEServer } from "./sse.js";
import { runStdioServer } from "./stdio.js";
import { ResourceContext } from "./resources/resourceClient.js";

dotenv.config();

if (!process.env.IMAGE_STORAGE_DIRECTORY) {
	if (process.platform === "win32") {
		// Windows
		process.env.IMAGE_STORAGE_DIRECTORY =
			"C:\\Windows\\Temp\\mcp-tatttyai";
	} else {
		// macOS or Linux
		process.env.IMAGE_STORAGE_DIRECTORY =
			"/tmp/tadasant-mcp-tatttyai";
	}
}

// Set default values for metadata saving
if (process.env.SAVE_METADATA === undefined) {
	process.env.SAVE_METADATA = "true";
}

if (process.env.SAVE_METADATA_FAILED === undefined) {
	process.env.SAVE_METADATA_FAILED = "true";
}

if (!process.env.STABILITY_AI_API_KEY) {
	throw new Error("STABILITY_AI_API_KEY is a required environment variable");
}

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

server.setRequestHandler(ListPromptsRequestSchema, async () => {
	return {
		prompts: prompts.map((p) => ({
			name: p.name,
			description: p.description,
		})),
	};
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	const prompt = prompts.find((p) => p.name === name);
	if (!prompt) {
		throw new Error(`Prompt not found: ${name}`);
	}

	const result = injectPromptTemplate(prompt.template, args);
	return {
		messages: [
			{
				role: "user",
				content: {
					type: "text",
					text: result,
				},
			},
		],
	};
});

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
	const meta = request.params?._meta;
	const ipAddress = meta?.ip as string;
	const context: ResourceContext = {
		requestorIpAddress: ipAddress,
	};

	const resourceClient = getResourceClient();
	const resources = await resourceClient.listResources(context);

	return {
		resources,
	};
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
	const { _meta: meta } = request.params;
	const ipAddress = meta?.ip as string;
	const context: ResourceContext = {
		requestorIpAddress: ipAddress,
	};

	const resourceClient = getResourceClient();
	const resource = await resourceClient.readResource(
		request.params.uri,
		context
	);

	return {
		contents: [resource],
	};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args, _meta: meta } = request.params;

	const ipAddress = meta?.ip as string;
	const context: ResourceContext = {
		requestorIpAddress: ipAddress,
	};

	try {
		switch (name) {
			case generateImageSD35ToolDefinition.name:
				return generateImageSD35(args as GenerateImageSD35Args, context);
			case removeBackgroundToolDefinition.name:
				return removeBackground(args as RemoveBackgroundArgs, context);
			case upscaleCreativeToolDefinition.name:
				return upscaleCreative(args as UpscaleCreativeArgs, context);
			case controlStructureToolDefinition.name:
				return controlStructure(args as ControlStructureArgs, context);
			default:
				throw new Error(`Unknown tool: ${name}`);
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new Error(
				`Invalid arguments: ${error.errors
					.map((e) => `${e.path.join(".")}: ${e.message}`)
					.join(", ")}`
			);
		}
		throw error;
	}
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			generateImageSD35ToolDefinition,
			removeBackgroundToolDefinition,
			upscaleCreativeToolDefinition,
			controlStructureToolDefinition,
		],
	};
});

function printUsage() {
	console.error("Usage: node build/index.js [--sse]");
	console.error("Options:");
	console.error("  --sse    Use SSE transport instead of stdio");
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length > 1 || (args.length === 1 && args[0] !== "--sse")) {
		printUsage();
		throw new Error("Invalid arguments");
	}

	const useSSE = args.includes("--sse");

	const resourceClientConfig: ResourceClientConfig = useSSE
		? {
				type: "gcs",
				gcsConfig: {
					privateKey: process.env.GCS_PRIVATE_KEY,
					clientEmail: process.env.GCS_CLIENT_EMAIL,
					projectId: process.env.GCS_PROJECT_ID,
					bucketName: process.env.GCS_BUCKET_NAME,
				},
			}
		: {
				type: "filesystem",
				imageStorageDirectory: process.env.IMAGE_STORAGE_DIRECTORY!,
			};

	initializeResourceClient(resourceClientConfig);

	if (useSSE) {
		await runSSEServer(server);
	} else {
		await runStdioServer(server);
	}
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});

// Vercel serverless function export
export default async function handler(req: any, res: any) {
	// Initialize resource client for Vercel (filesystem-based since GCS might not work in serverless)
	const resourceClientConfig: ResourceClientConfig = {
		type: "filesystem",
		imageStorageDirectory: process.env.IMAGE_STORAGE_DIRECTORY || "/tmp/mcp-stability-ai",
	};
	initializeResourceClient(resourceClientConfig);

	const context: ResourceContext = {
		requestorIpAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
	};

	if (req.method === 'GET') {
		res.status(200).json({
			name: "stability-ai",
			version: "0.0.1",
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		});
		return;
	}

	if (req.method === 'POST') {
		// Handle MCP requests
		const { method, params } = req.body;

		try {
			switch (method) {
				case 'tools/list':
					res.status(200).json({
						tools: [
							generateImageSD35ToolDefinition,
							removeBackgroundToolDefinition,
							upscaleCreativeToolDefinition,
							controlStructureToolDefinition,
						],
					});
					break;
				case 'tools/call':
					const { name, arguments: args } = params;
					let result;
					switch (name) {
						case generateImageSD35ToolDefinition.name:
							result = await generateImageSD35(args as GenerateImageSD35Args, context);
							break;
						case removeBackgroundToolDefinition.name:
							result = await removeBackground(args as RemoveBackgroundArgs, context);
							break;
						case upscaleCreativeToolDefinition.name:
							result = await upscaleCreative(args as UpscaleCreativeArgs, context);
							break;
						case controlStructureToolDefinition.name:
							result = await controlStructure(args as ControlStructureArgs, context);
							break;
						default:
							res.status(404).json({ error: "Tool not found" });
							return;
					}
					res.status(200).json(result);
					break;
				default:
					res.status(404).json({ error: "Method not supported" });
			}
		} catch (error) {
			console.error('Error processing request:', error);
			res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
		}
		return;
	}

	res.status(405).json({ error: "Method not allowed" });
}
