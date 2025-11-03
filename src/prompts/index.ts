import { controlStructureToolDefinition } from "../tools/controlStructure.js";
import { upscaleCreativeToolDefinition } from "../tools/upscaleCreative.js";

// Expect template to have {{variable}} entries and replace them with args[variable]
export const injectPromptTemplate = (
	template: string,
	args: Record<string, string> | undefined
) => {
	if (!args) {
		return template;
	}

	return template.replace(/{{(.*?)}}/g, (match, p1) => args[p1] || match);
};

export const prompts = [
	{
		name: "generate-image-from-text",
		description:
			"Generate a new image with configurable description, style, and aspect ratio",
		template: `Generate an image for the user using generate_image_sd35. Make sure to ask the user for feedback after the generation.`,
	},
	{
		name: "generate-image-using-structure",
		description:
			"Generate an image while maintaining the structure (i.e. background, context) of a reference image",
		template: `The user should provide an image name or location that matches a resource from list_resources (if the results from this tool are not in recent conversation history, run it again so you have an up-to-date list of resources). Try using ${controlStructureToolDefinition.name} to generate an image that maintains the structure of the indicated image. Make sure to ask the user for feedback after the generation.`,
	},
	{
		name: "upscale-image",
		description: "Upscale the quality of an image",
		template: `The user should provide an image name or location that matches a resource from list_resources (if the results from this tool are not in recent conversation history, run it again so you have an up-to-date list of resources). Try using ${upscaleCreativeToolDefinition.name} to upscale the indicated image. Make sure to ask the user for feedback after the upscaling.`,
	},
	{
		name: "edit-image",
		description: "Make a minor modification to an existing image",
		template: `The user should provide an image name or location that matches a resource from list_resources (if the results from this tool are not in recent conversation history, run it again so you have an up-to-date list of resources).

    At this time, we can only perform two kinds of changes:
    - "remove background": self explanatory; we attempt to make the background of the image transparent

    Examples of invalid changes we cannot perform at this time:
    - Add {object} (without removing anything)
    - Tweak {object} (in a way we cannot rephrase to replace it altogether)

    If the user provided something like this, then we should not proceed; inform the user we can only do "remove background" changes.

    Make sure to ask the user for feedback after any generation attempt.`,
	},
];
