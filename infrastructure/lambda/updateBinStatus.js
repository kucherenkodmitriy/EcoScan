const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient();
const { v4: uuidv4 } = require('uuid');

// Environment variables that will be set in Lambda configuration
const BINS_TABLE = process.env.BINS_TABLE;
const STATUS_UPDATES_TABLE = process.env.STATUS_UPDATES_TABLE;

exports.handler = async (event) => {
  try {
    // Parse the incoming request
    const binId = event.pathParameters.id;
    const { status } = JSON.parse(event.body);
    
    // Validate input
    if (!binId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Bin ID is required' }),
      };
    }
    
    if (!status || !['OK', 'FULL'].includes(status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Status must be either OK or FULL' }),
      };
    }
    
    // Get current timestamp
    const timestamp = new Date().toISOString();
    
    // Update bin status in DynamoDB
    const updateBinParams = {
      TableName: BINS_TABLE,
      Key: { id: binId },
      UpdateExpression: 'set #status = :status, lastUpdated = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':timestamp': timestamp,
      },
      ReturnValues: 'ALL_NEW',
    };
    
    // Create status update record
    const statusUpdateParams = {
      TableName: STATUS_UPDATES_TABLE,
      Item: {
        id: uuidv4(),
        binId: binId,
        status: status,
        timestamp: timestamp,
      },
    };
    
    // Execute the DynamoDB operations
    const [updateBinResult, ] = await Promise.all([
      documentClient.update(updateBinParams).promise(),
      documentClient.put(statusUpdateParams).promise(),
    ]);
    
    // Check if bin exists
    if (!updateBinResult.Attributes) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Bin not found' }),
      };
    }
    
    // Return the updated bin
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(updateBinResult.Attributes),
    };
  } catch (error) {
    console.error('Error updating bin status:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Error updating bin status', error: error.message }),
    };
  }
}; 