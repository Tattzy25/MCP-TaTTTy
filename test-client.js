import fetch from 'node-fetch';

const SERVER_URL = 'https://mcp-tattty.vercel.app';

async function testImageGeneration() {
  try {
    // First, establish SSE connection by making a GET request to /sse
    console.log('Establishing SSE connection...');
    const sseResponse = await fetch(`${SERVER_URL}/sse`);
    console.log('SSE connection status:', sseResponse.status);

    if (!sseResponse.ok) {
      console.error('Failed to establish SSE connection');
      return;
    }

    // The SSE endpoint should return an event stream, but for testing we'll use the messages endpoint
    // Send a tool call request for SD 3.5 Large image generation
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'stability-ai-generate-image-sd35',
        arguments: {
          prompt: 'A beautiful sunset over mountains with vibrant colors',
          model: 'sd3.5-large',
          outputImageFileName: 'sunset-test'
        }
      }
    };

    console.log('Sending tool call request...');
    const response = await fetch(`${SERVER_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toolCallRequest)
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        console.log('Tool call result:', JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.log('Response is not JSON, raw response:', responseText);
      }
    } else {
      console.error('Request failed with status:', response.status);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testImageGeneration();
