// Test job execution with real data
const testPhoneNumbers = [
  '3055551234',
  '3055555678',
  '3055559012',
  '3055559999',
  '3055554321'
];

async function testJobExecution() {
  console.log('Testing job execution system...');
  
  try {
    // Start bulk verification
    const response = await fetch('http://localhost:5000/api/bulk-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumbers: testPhoneNumbers })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Job started:', data);
    
    // Monitor job progress
    const jobId = data.jobId;
    let jobStatus = 'processing';
    
    while (jobStatus === 'processing' || jobStatus === 'pending') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`http://localhost:5000/api/bulk-verify/jobs/${jobId}`);
      if (statusResponse.ok) {
        const jobData = await statusResponse.json();
        jobStatus = jobData.status;
        console.log(`Job ${jobId} status: ${jobStatus} (${jobData.progress}%)`);
        
        if (jobData.statistics) {
          console.log('Statistics:', jobData.statistics);
        }
      }
    }
    
    // Get final job results
    const finalResponse = await fetch(`http://localhost:5000/api/bulk-verify/jobs/${jobId}`);
    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      console.log('Final job results:', finalData);
    }
    
    // Check job execution history
    const historyResponse = await fetch('http://localhost:5000/api/job-execution-history');
    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      console.log('Job execution history:', historyData);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testJobExecution().catch(console.error);