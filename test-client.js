import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

const SERVER_URL = 'http://localhost:3020';

async function testImageGeneration() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Establishing SSE connection...');

      // Create EventSource for SSE connection
      const eventSource = new EventSource(`${SERVER_URL}/sse`);

      eventSource.onopen = () => {
        console.log('SSE connection established');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received SSE message:', JSON.stringify(data, null, 2));

          if (data.id === 1) { // Our tool call ID
            eventSource.close();
            resolve(data);
          }
        } catch (parseError) {
          console.log('Received non-JSON SSE message:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        reject(error);
      };

      // Wait a bit for SSE to establish, then send the tool call
      setTimeout(async () => {
        try {
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

          console.log('POST Response status:', response.status);
          const responseText = await response.text();
          console.log('POST Response text:', responseText);

        } catch (postError) {
          console.error('Error sending tool call:', postError);
          eventSource.close();
          reject(postError);
        }
      }, 1000); // Wait 1 second for SSE to establish

    } catch (error) {
      console.error('Test setup failed:', error);
      reject(error);
    }
  });
}

testImageGeneration()
  .then((result) => {
    console.log('Test completed successfully:', result);
  })
  .catch((error) => {
    console.error('Test failed:', error);
  });
