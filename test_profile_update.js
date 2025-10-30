// Test script to update Jason Fonseca's profile
const encLoyaltyId = "BPscUiXxrfdVkb/KoViaJw==";
const updateData = {
  firstName: "Jason",
  lastName: "Fonseca Updated",
  phoneNumber: "3053954609",
  zipCode: "33186",
  email: "jason.test@example.com"
};

fetch(`http://localhost:5000/api/member/${encodeURIComponent(encLoyaltyId)}/profile`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(updateData)
})
.then(response => response.json())
.then(data => {
  console.log('Update result:', data);
})
.catch(error => {
  console.error('Error:', error);
});
