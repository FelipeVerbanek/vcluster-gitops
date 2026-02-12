const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const client = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://addon-localstack.localstack-system.svc.cluster.local:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
});

const queueUrl = process.env.QUEUE_URL;

async function sendMessage(message) {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: message
  });
  
  const response = await client.send(command);
  console.log(`Message sent: ${message} - MessageId: ${response.MessageId}`);
}

async function main() {
  if (!queueUrl) {
    console.error('QUEUE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`Sending messages to queue: ${queueUrl}`);
  
  await sendMessage('Hello from Node.js app - Message 1');
  await sendMessage('Hello from Node.js app - Message 2');
  
  console.log('All messages sent successfully');
}

main().catch(console.error);
