const response = await fetch('http://localhost:5000/api/lookup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phoneNumber: '7866302522'
  })
});

const data = await response.json();
console.log('API Response structure:');
console.log('encLoyaltyId:', data.encLoyaltyId);
console.log('profile:', data.profile);
console.log('rawLookupData present:', !!data.rawLookupData);
console.log('rawMemberData present:', !!data.rawMemberData);
console.log('phoneNumber:', data.phoneNumber);