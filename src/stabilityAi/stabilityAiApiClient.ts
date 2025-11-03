import axios, { AxiosInstance } from "axios";
import FormData from "form-data";
import fs from "fs";
interface UpscaleCreativeOptions {
	prompt: string;
	negativePrompt?: string;
	seed?: number;
	outputFormat?: "png" | "jpeg" | "webp";
	creativity?: number;
}

interface ControlStructureOptions {
	prompt: string;
	controlStrength?: number;
	negativePrompt?: string;
	seed?: number;
	outputFormat?: "png" | "jpeg" | "webp";
}

export class StabilityAiApiClient {
	private readonly apiKey: string;
	private readonly baseUrl = "https://api.stability.ai";
	private readonly axiosClient: AxiosInstance;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
		this.axiosClient = axios.create({
			baseURL: this.baseUrl,
			timeout: 120000,
			maxBodyLength: Infinity,
			maxContentLength: Infinity,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				Accept: "application/json",
			},
		});
	}

	async removeBackground(
		imageFilePath: string
	): Promise<{ base64Image: string }> {
		const payload = {
			image: fs.createReadStream(imageFilePath),
			output_format: "png",
		};

		try {
			const response = await this.axiosClient.postForm(
				`${this.baseUrl}/v2beta/stable-image/edit/remove-background`,
				axios.toFormData(payload, new FormData())
			);
			const base64Image = response.data.image;
			return { base64Image };
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				const data = error.response.data;
				if (error.response.status === 400) {
					throw new Error(`Invalid parameters: ${data.errors.join(", ")}`);
				}
				throw new Error(
					`API error (${error.response.status}): ${JSON.stringify(data)}`
				);
			}
			throw error;
		}
	}

	async fetchGenerationResult(id: string): Promise<{ base64Image: string }> {
		try {
			while (true) {
				const response = await this.axiosClient.get(
					`${this.baseUrl}/v2beta/results/${id}`,
					{
						headers: {
							Accept: "application/json",
						},
					}
				);

				if (response.status === 200) {
					return { base64Image: response.data.result };
				} else if (response.status === 202) {
					// Generation still in progress, wait 10 seconds before polling again
					await new Promise((resolve) => setTimeout(resolve, 10000));
				} else {
					throw new Error(`Unexpected status: ${response.status}`);
				}
			}
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				const data = error.response.data;
				if (error.response.status === 400) {
					throw new Error(`Invalid parameters: ${data.errors.join(", ")}`);
				}
				throw new Error(
					`API error (${error.response.status}): ${JSON.stringify(data)}`
				);
			}
			throw error;
		}
	}

	async upscaleCreative(
		imageFilePath: string,
		options: UpscaleCreativeOptions
	): Promise<{ base64Image: string }> {
		const payload = {
			image: fs.createReadStream(imageFilePath),
			prompt: options.prompt,
			output_format: options.outputFormat || "png",
			...(options.negativePrompt && {
				negative_prompt: options.negativePrompt,
			}),
			...(options.seed !== undefined && { seed: options.seed }),
			...(options.creativity !== undefined && {
				creativity: options.creativity,
			}),
		};

		try {
			const response = await this.axiosClient.postForm(
				`${this.baseUrl}/v2beta/stable-image/upscale/creative`,
				axios.toFormData(payload, new FormData())
			);

			// Get the generation ID from the response
			const generationId = response.data.id;

			// Poll for the result
			return await this.fetchGenerationResult(generationId);
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				const data = error.response.data;
				if (error.response.status === 400) {
					throw new Error(`Invalid parameters: ${data.errors.join(", ")}`);
				}
				throw new Error(
					`API error (${error.response.status}): ${JSON.stringify(data)}`
				);
			}
			throw error;
		}
	}

	async controlStructure(
		imageFilePath: string,
		options: ControlStructureOptions
	): Promise<{ base64Image: string }> {
		const payload = {
			image: fs.createReadStream(imageFilePath),
			prompt: options.prompt,
			output_format: options.outputFormat || "png",
			...(options.controlStrength !== undefined && {
				control_strength: options.controlStrength,
			}),
			...(options.negativePrompt && {
				negative_prompt: options.negativePrompt,
			}),
			...(options.seed !== undefined && { seed: options.seed }),
		};

		try {
			const response = await this.axiosClient.postForm(
				`${this.baseUrl}/v2beta/stable-image/control/structure`,
				axios.toFormData(payload, new FormData())
			);
			const base64Image = response.data.image;
			return { base64Image };
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				const data = error.response.data;
				if (error.response.status === 400) {
					throw new Error(`Invalid parameters: ${data.errors.join(", ")}`);
				}
				throw new Error(
					`API error (${error.response.status}): ${JSON.stringify(data)}`
				);
			}
			throw error;
		}
	}
}
